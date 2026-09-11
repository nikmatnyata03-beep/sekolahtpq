// Tiny fetch helpers — standard for all components

// ============================================================
// AI FIX BRIDGE — pelaporan error runtime otomatis ke /api/dev/errors.
// Setiap respons bukan JSON, HTTP 5xx, dan error JS tak tertangani
// masuk daftar review developer tanpa perlu klik apa pun. Developer memilih
// laporan yang aman untuk diteruskan ke antrean agen AI.
// ============================================================

const errReported = new Set<string>()
let errReportCount = 0
let errHookInstalled = false

function reportRuntimeError(payload: { type: string; message: string; endpoint?: string; detail?: string }): void {
  try {
    if (typeof window === 'undefined') return
    if (payload.endpoint === '/api/dev/errors') return // anti-loop
    if (errReportCount >= 10) return // batas per sesi halaman
    const sig = `${payload.type}|${payload.endpoint ?? ''}|${payload.message.slice(0, 80)}`
    if (errReported.has(sig)) return // dedupe client
    errReported.add(sig)
    if (errReported.size > 60) errReported.clear()
    errReportCount++
    const body = JSON.stringify({ ...payload, page: window.location.pathname })
    fetch('/api/dev/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* pelapor tidak boleh ikut error */
    })
  } catch {
    /* diamkan */
  }
}

/** Pasang hook global (sekali per halaman): error JS tak tertangani + promise rejection. */
export function installRuntimeErrorHook(): void {
  if (typeof window === 'undefined' || errHookInstalled) return
  errHookInstalled = true
  window.addEventListener('error', (ev) => {
    reportRuntimeError({ type: 'RUNTIME_JS', message: ev.message || 'Error tak diketahui', detail: ev.filename ? `${ev.filename}:${ev.lineno}` : undefined })
  })
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason
    reportRuntimeError({ type: 'RUNTIME_PROMISE', message: r instanceof Error ? r.message : String(r).slice(0, 200) })
  })
}

export async function apiGet<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch (e) {
    reportRuntimeError({ type: 'RUNTIME_FETCH', endpoint: url, message: 'Jaringan gagal: ' + (e instanceof Error ? e.message : 'unknown') })
    throw e instanceof Error ? e : new Error('Gagal terhubung ke server')
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    // klasik "web gagal load json" → otomatis masuk daftar review developer
    reportRuntimeError({ type: 'RUNTIME_FETCH', endpoint: url, message: `Respons bukan JSON (HTTP ${res.status})` })
    throw new Error('Respons server tidak valid (bukan JSON)')
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || 'Gagal memuat data'
    if (res.status >= 500) {
      reportRuntimeError({ type: 'RUNTIME_HTTP5XX', endpoint: url, message: msg, detail: `HTTP ${res.status}` })
    }
    throw new Error(msg)
  }
  return data as T
}

export async function apiSend<T>(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const { data } = await apiSendFull<T>(url, method, body)
  return data
}

/**
 * Varian apiSend yang TIDAK melempar error untuk status 4xx — mengembalikan
 * { status, data } apa adanya. Dipakai alur yang butuh payload terstruktur
 * dari server (mis. Task 42: code 'DUP_DEVICE' + otherName utk dialog
 * konfirmasi "1 HP dipakai 2 santri"). 5xx tetap dilaporkan runtime-error.
 */
export async function apiSendFull<T>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<{ status: number; data: T & { error?: string } }> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (e) {
    reportRuntimeError({ type: 'RUNTIME_FETCH', endpoint: url, message: 'Jaringan gagal: ' + (e instanceof Error ? e.message : 'unknown') })
    throw e instanceof Error ? e : new Error('Gagal terhubung ke server')
  }
  let data: unknown = {}
  try {
    data = await res.json()
  } catch {
    reportRuntimeError({ type: 'RUNTIME_FETCH', endpoint: url, message: `Respons bukan JSON (HTTP ${res.status})` })
    if (!res.ok) throw new Error('Terjadi kesalahan')
    return { status: res.status, data: {} as T & { error?: string } }
  }
  if (res.status >= 500) {
    const msg = (data as { error?: string })?.error || 'Terjadi kesalahan'
    reportRuntimeError({ type: 'RUNTIME_HTTP5XX', endpoint: url, message: msg, detail: `HTTP ${res.status}` })
  }
  return { status: res.status, data: data as T & { error?: string } }
}

export function formatRupiah(n: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

export function formatDate(iso: string | Date, withTime = false): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (!withTime) return date
  return `${date}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
}

export function formatShortDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
