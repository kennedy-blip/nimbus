import { Activity, CheckCircle2, Columns3, Copy, Database, Gauge, Rows3, TriangleAlert } from 'lucide-react'

const number = new Intl.NumberFormat('en-US')

function formatCell(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'number') return number.format(value)
  return String(value)
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MetricCard({ label, value, hint, icon: Icon, accent = 'indigo' }) {
  const accents = {
    indigo: 'bg-indigo-50 text-indigo-600',
    cyan: 'bg-cyan-50 text-cyan-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${accents[accent]}`}><Icon size={17} /></span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  )
}

function formatStats(stats) {
  if (!stats) return '—'
  return `min ${formatCell(stats.min)} · avg ${formatCell(stats.mean)} · max ${formatCell(stats.max)}`
}

export default function AuditSummary({ report }) {
  const preview = report.preview || []
  const previewColumns = report.column_details.map((column) => column.name)
  const missingTone = report.missing_cells > 0 ? 'amber' : 'emerald'

  return (
    <section className="mx-auto mt-10 max-w-6xl animate-[fadeIn_.45s_ease-out]" aria-labelledby="audit-heading">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            <Activity size={14} /> Audit complete
          </div>
          <h2 id="audit-heading" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Dataset overview</h2>
          <p className="mt-1 text-sm text-slate-500">{report.file_name} <span className="px-1 text-slate-300">/</span> {formatBytes(report.file_size_bytes)}</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 size={14} /> {report.completeness_pct}% complete
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Data rows" value={number.format(report.rows)} hint="Records inspected" icon={Rows3} accent="indigo" />
        <MetricCard label="Data columns" value={number.format(report.columns)} hint="Fields in the dataset" icon={Columns3} accent="cyan" />
        <MetricCard label="Missing values" value={number.format(report.missing_cells)} hint={`${report.completeness_pct}% cell completeness`} icon={report.missing_cells ? TriangleAlert : CheckCircle2} accent={missingTone} />
        <MetricCard label="Processing time" value={`${report.processing_ms} ms`} hint={`${formatBytes(report.file_size_bytes)} analyzed`} icon={Gauge} accent="emerald" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">Quality signals</h3>
              <p className="mt-1 text-sm text-slate-500">A quick read on dataset integrity.</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600"><Database size={17} /></span>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Completeness</span>
              <span className="font-semibold tabular-nums text-slate-900">{report.completeness_pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Dataset completeness" aria-valuenow={report.completeness_pct} aria-valuemin="0" aria-valuemax="100">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, report.completeness_pct))}%` }} />
            </div>
          </div>
          <div className="mt-6 divide-y divide-slate-100">
            <div className="flex items-center justify-between py-3 text-sm">
              <span className="text-slate-600">Duplicate rows</span><span className="font-semibold tabular-nums text-slate-900">{number.format(report.duplicate_rows)}</span>
            </div>
            <div className="flex items-center justify-between py-3 text-sm">
              <span className="text-slate-600">Total cells</span><span className="font-semibold tabular-nums text-slate-900">{number.format(report.total_cells)}</span>
            </div>
            <div className="flex items-center justify-between py-3 text-sm">
              <span className="text-slate-600">Missing cells</span><span className="font-semibold tabular-nums text-slate-900">{number.format(report.missing_cells)}</span>
            </div>
          </div>
        </article>

        <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Column profile</h3>
              <p className="mt-1 text-sm text-slate-500">Missingness, cardinality, and numeric range.</p>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Copy size={16} /></span>
          </div>
          <div className="max-h-[25rem] overflow-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Column</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Missing</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Unique</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Numeric range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.column_details.map((column) => (
                  <tr key={column.name} className="hover:bg-slate-50/70">
                    <th scope="row" className="max-w-48 truncate px-4 py-3 font-medium text-slate-800" title={column.name}>{column.name}</th>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{column.data_type}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{number.format(column.null_count)} <span className="text-xs text-slate-400">({column.missing_pct}%)</span></td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{number.format(column.unique_count)}</td>
                    <td className="max-w-60 truncate px-4 py-3 text-xs tabular-nums text-slate-600" title={formatStats(column.statistics)}>{formatStats(column.statistics)}</td>
                  </tr>
                ))}
                {report.column_details.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">No columns were found in this dataset.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <div className="flex flex-col justify-between gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h3 className="font-semibold text-slate-900">Data preview</h3>
            <p className="mt-1 text-sm text-slate-500">First {preview.length} {preview.length === 1 ? 'row' : 'rows'} of the uploaded dataset.</p>
          </div>
          <span className="text-xs font-medium text-slate-400">Preview only</span>
        </div>
        <div className="max-h-[22rem] overflow-auto">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>{previewColumns.map((column) => <th key={column} scope="col" className="max-w-56 truncate px-4 py-3" title={column}>{column}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50/70">
                  {previewColumns.map((column) => <td key={column} className="max-w-64 truncate px-4 py-3 text-slate-700" title={formatCell(row[column])}>{formatCell(row[column])}</td>)}
                </tr>
              ))}
              {preview.length === 0 && <tr><td colSpan={Math.max(previewColumns.length, 1)} className="px-4 py-8 text-center text-slate-500">No rows to preview.</td></tr>}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}
