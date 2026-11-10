"""FastAPI application for the Real-Time Data & Code Audit Dashboard."""
from __future__ import annotations

import os
import time
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from app.auditor import DatasetReadError, audit_dataset

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
CHUNK_BYTES = 1024 * 1024
ALLOWED_EXTENSIONS = {".csv", ".parquet"}

app = FastAPI(
    title="Data & Code Audit API",
    description="In-memory CSV and Parquet dataset auditing powered by Polars.",
    version="1.0.0",
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

service_metrics: dict[str, Any] = {
    "audits_completed": 0,
    "bytes_processed": 0,
    "total_processing_ms": 0.0,
}


def _safe_filename(filename: str | None) -> str:
    cleaned = (filename or "upload").replace("\\", "/").rsplit("/", 1)[-1]
    cleaned = "".join(char for char in cleaned if char.isprintable()).strip()
    return cleaned[:255] or "upload"


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Lightweight liveness check for deployment platforms."""
    return {"status": "ok"}


@app.get("/api/metrics", tags=["metrics"])
async def metrics() -> dict[str, Any]:
    """Return process-local operational counters (not dataset contents)."""
    count = service_metrics["audits_completed"]
    total_ms = service_metrics["total_processing_ms"]
    return {
        **service_metrics,
        "average_processing_ms": round(total_ms / count, 2) if count else 0.0,
    }


@app.post("/api/audit", tags=["audit"])
async def create_audit(file: UploadFile = File(...)) -> dict[str, Any]:
    """Accept one CSV or Parquet file and return its audit report."""
    filename = _safe_filename(file.filename)
    extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        await file.close()
        raise HTTPException(status_code=415, detail="Upload a .csv or .parquet file.")

    chunks: list[bytes] = []
    total_bytes = 0
    try:
        while chunk := await file.read(CHUNK_BYTES):
            total_bytes += len(chunk)
            if total_bytes > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MiB upload limit.",
                )
            chunks.append(chunk)
    finally:
        await file.close()

    if not total_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    payload = b"".join(chunks)
    started = time.perf_counter()
    try:
        report = await run_in_threadpool(audit_dataset, filename, payload)
    except DatasetReadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Dataset audit failed unexpectedly.") from exc

    elapsed_ms = round((time.perf_counter() - started) * 1_000, 2)
    report["processing_ms"] = elapsed_ms
    service_metrics["audits_completed"] += 1
    service_metrics["bytes_processed"] += total_bytes
    service_metrics["total_processing_ms"] += elapsed_ms
    return report
