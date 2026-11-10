import { useRef, useState } from 'react'
import { Activity, ArrowUpRight, Database, FileUp, ShieldCheck, Sparkles } from 'lucide-react'
import AuditSummary from './components/AuditSummary.jsx'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
const MAX_FILE_BYTES = 25 * 1024 * 1024

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function App() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  function chooseFile(candidate) {
    if (!candidate) return
    const ext = candidate.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'parquet'].includes(ext)) {
      setError('Choose a .csv or .parquet file to start an audit.')
      return
    }
    if (candidate.size === 0) {
      setError('That file is empty. Choose a dataset with content.')
      return
    }
    if (candidate.size > MAX_FILE_BYTES) {
      setError('This file is larger than the 25 MiB upload limit.')
      return
    }
    setError('')
    setReport(null)
    setFile(candidate)
  }

  function onDrop(event) {
    event.preventDefault()
    setDragging(false)
    chooseFile(event.dataTransfer.files?.[0])
  }

  async function runAudit(event) {
    event.preventDefault()
    if (!file || loading) return

    setLoading(true)
    setError('')
    setReport(null)
    const payload = new FormData()
    payload.append('file', file)

    try {
      const response = await fetch(`${API_BASE}/api/audit`, { method: 'POST', body: payload })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.detail || `Audit request failed (${response.status}).`)
      }
      setReport(body)
    } catch (requestError) {
      setError(requestError.message || 'Could not reach the audit API. Check the backend URL and try again.')
    } finally {
      setLoading(false)
    }
  }

  function startOver() {
    setFile(null)
    setReport(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fa] text-slate-900">
      <div className="pointer-events-none absolute -top-48 right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-cyan-200/30 blur-3xl" />
      <div className="pointer-events-none absolute left-[-12rem] top-[28rem] h-[28rem] w-[28rem] rounded-full bg-indigo-200/25 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-7 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Signal Audit home">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-indigo-950/15">
              <Activity size={20} strokeWidth={2.4} />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight">SIGNAL AUDIT</span>
              <span className="block text-[11px] font-medium tracking-wide text-slate-500">DATA QUALITY WORKSPACE</span>
            </span>
          </a>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
            FastAPI <span className="text-slate-300">/</span> Polars engine
          </div>
        </header>

        <section id="top" className="mx-auto max-w-4xl pb-10 pt-16 text-center sm:pt-20">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm">
            <Sparkles size={14} /> Fast, focused dataset intelligence
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-6xl">
            Know what your data
            <span className="block bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 bg-clip-text text-transparent">is really saying.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Drop in a dataset to surface missing values, duplicate rows, column-level statistics, and a clean preview in seconds.
          </p>
        </section>

        <section className="mx-auto max-w-4xl" aria-label="Dataset upload">
          <form onSubmit={runAudit}>
            <div
              onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
              onDrop={onDrop}
              className={`rounded-[1.75rem] border border-dashed bg-white/85 p-5 shadow-card backdrop-blur transition sm:p-8 ${dragging ? 'border-indigo-500 bg-indigo-50/80 ring-4 ring-indigo-100' : 'border-slate-300 hover:border-indigo-300'}`}
            >
              <div className="flex flex-col items-center text-center">
                <div className={`mb-4 grid h-14 w-14 place-items-center rounded-2xl ${dragging ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                  <FileUp size={25} />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">Drop your dataset here</h2>
                <p className="mt-1.5 text-sm text-slate-500">CSV or Parquet, up to 25 MiB</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.parquet,text/csv,application/vnd.apache.parquet"
                  className="sr-only"
                  aria-label="Choose a CSV or Parquet dataset"
                  onChange={(event) => chooseFile(event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Database size={16} /> Browse files
                </button>
                {file && (
                  <div className="mt-5 flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{formatBytes(file.size)} · Ready to audit</p>
                    </div>
                    <ShieldCheck className="shrink-0 text-emerald-600" size={20} aria-label="File selected" />
                  </div>
                )}
                {error && <p className="mt-4 max-w-xl text-sm font-medium text-rose-700" role="alert">{error}</p>}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  {file && <button type="submit" disabled={loading} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                    {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Auditing…</> : <>Run audit <ArrowUpRight size={16} /></>}
                  </button>}
                  {report && <button type="button" onClick={startOver} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Audit another file</button>}
                </div>
              </div>
            </div>
          </form>
        </section>

        {report && <AuditSummary report={report} />}

        <footer className="mx-auto mt-14 flex max-w-4xl flex-col items-center justify-between gap-2 border-t border-slate-200/80 pt-5 text-xs text-slate-500 sm:flex-row">
          <span>Files are processed in memory and are not saved by the API.</span>
          <span>Built for reliable, transparent data checks.</span>
        </footer>
      </div>
    </main>
  )
}
