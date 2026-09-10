import { getCloudflareContext } from '@opennextjs/cloudflare'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

function getSecret(): string | undefined {
  if (process.env.TURNSTILE_SECRET_KEY) return process.env.TURNSTILE_SECRET_KEY
  try {
    const { env } = getCloudflareContext()
    const secret = (env as Record<string, unknown> | undefined)?.TURNSTILE_SECRET_KEY
    return typeof secret === 'string' ? secret : undefined
  } catch {
    return undefined
  }
}

export async function verifyTurnstileToken(token: unknown, remoteIp?: string): Promise<boolean> {
  const secret = getSecret()

  // Dev bypass: sandbox lokal tidak punya secret Turnstile (dan tidak bisa
  // menyelesaikan widget dari curl/agent). Produksi SELALU punya secret,
  // sehingga pengecualian ini tidak pernah aktif di Cloudflare Workers.
  if (!secret) {
    if (process.env.NODE_ENV !== 'production') return true
    return false
  }
  if (typeof token !== 'string' || token.length < 20) return false

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const response = await fetch(SITEVERIFY_URL, { method: 'POST', body })
    if (!response.ok) return false
    const result = (await response.json()) as { success?: boolean }
    return result.success === true
  } catch {
    return false
  }
}
