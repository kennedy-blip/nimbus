"""Polars-backed, in-memory dataset auditing utilities."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
import math
from typing import Any

import polars as pl

MAX_COLUMNS = 2_000
PREVIEW_ROWS = 10


class DatasetReadError(ValueError):
    """Raised when a supported dataset cannot be parsed or audited."""


def _json_safe(value: Any) -> Any:
    """Convert Polars/Python scalar values to strict JSON-compatible values."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        value = float(value)
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return str(value)


def _read_frame(filename: str, content: bytes) -> pl.DataFrame:
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        source = BytesIO(content)
        if suffix == "csv":
            frame = pl.read_csv(
                source,
                infer_schema_length=1_000,
                try_parse_dates=True,
                raise_if_empty=True,
            )
        elif suffix == "parquet":
            frame = pl.read_parquet(source)
        else:
            raise DatasetReadError("Only .csv and .parquet files are supported.")
    except DatasetReadError:
        raise
    except Exception as exc:
        raise DatasetReadError(f"Could not read dataset: {exc}") from exc

    if len(frame.columns) > MAX_COLUMNS:
        raise DatasetReadError(f"Dataset has {len(frame.columns)} columns; the limit is {MAX_COLUMNS}.")

    float_columns = [name for name, dtype in frame.schema.items() if dtype in (pl.Float32, pl.Float64)]
    if float_columns:
        frame = frame.with_columns(pl.col(name).fill_nan(None) for name in float_columns)
    return frame


def audit_dataset(filename: str, content: bytes) -> dict[str, Any]:
    """Read a CSV or Parquet byte payload and return a bounded JSON report."""
    frame = _read_frame(filename, content)
    row_count = frame.height
    column_count = frame.width
    total_cells = row_count * column_count
    null_counts = frame.null_count().row(0, named=True) if column_count else {}
    column_reports: list[dict[str, Any]] = []

    for name, dtype in frame.schema.items():
        series = frame.get_column(name)
        null_count = int(null_counts.get(name, 0))
        report: dict[str, Any] = {
            "name": name,
            "data_type": str(dtype),
            "null_count": null_count,
            "missing_pct": round((null_count / row_count * 100), 2) if row_count else 0.0,
            "unique_count": int(series.drop_nulls().n_unique()),
        }
        if dtype.is_numeric() and dtype != pl.Boolean:
            numeric_values = series.drop_nulls()
            report["statistics"] = {
                "min": _json_safe(numeric_values.min()) if len(numeric_values) else None,
                "max": _json_safe(numeric_values.max()) if len(numeric_values) else None,
                "mean": _json_safe(numeric_values.mean()) if len(numeric_values) else None,
                "median": _json_safe(numeric_values.median()) if len(numeric_values) else None,
                "std_dev": _json_safe(numeric_values.std()) if len(numeric_values) > 1 else None,
            }
        column_reports.append(report)

    try:
        duplicate_rows = row_count - frame.unique(maintain_order=True).height if row_count else 0
    except Exception:
        duplicate_rows = 0

    missing_cells = sum(int(value) for value in null_counts.values())
    completeness = ((total_cells - missing_cells) / total_cells * 100) if total_cells else 100.0
    preview = [
        {str(key): _json_safe(value) for key, value in row.items()}
        for row in frame.head(PREVIEW_ROWS).to_dicts()
    ]

    return {
        "file_name": filename,
        "file_size_bytes": len(content),
        "rows": row_count,
        "columns": column_count,
        "total_cells": total_cells,
        "missing_cells": missing_cells,
        "completeness_pct": round(completeness, 2),
        "duplicate_rows": duplicate_rows,
        "column_details": column_reports,
        "preview": preview,
    }
