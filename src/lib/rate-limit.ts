/**
 * Rate limiter memori (sliding window) untuk endpoint sensitif.
 *
 * CATATAN Cloudflare Workers: state hidup per-isolate — bukan limit global
 * absolut, tetapi cukup memperlambat brute force & abuse umum dengan biaya
 * nol infrastruktur. Untuk limit global bisa ditambahkan D1/WAF nanti.
 */

type Bucket = { hits: number[] }

const buckets = new Map<string, Bucket>()

/** true = diizinkan; false = melebihi kuota `max` dalam window `windowMs`. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)
  if (bucket.hits.length >= max) {
    buckets.set(key, bucket)
    return false
  }
  bucket.hits.push(now)
  buckets.set(key, bucket)
  // housekeeping ringan: buang bucket basi bila map membengkak
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.hits.length === 0 || now - v.hits[v.hits.length - 1] > windowMs * 2) buckets.delete(k)
    }
  }
  return true
}

/** IP terbaik yang bisa didapat dari request (proxy-aware). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return 'unknown'
}
