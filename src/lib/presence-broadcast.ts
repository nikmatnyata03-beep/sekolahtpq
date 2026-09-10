import type { PresenceEvent } from '@/durable/presence-hub'

interface NamespaceLike {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> }
}

/**
 * Kirim event presensi ke PresenceHub (Durable Object) bila binding tersedia
 * (produksi Cloudflare Workers). Panggilan via binding = in-process, aman dari
 * larangan self-fetch Workers. Fire-and-forget (waitUntil) agar tidak menambah
 * latensi respons; lokal (bun run dev) tanpa DO → di-skip senyap, panel tetap
 * hidup lewat snapshot REST (mode polling).
 */
export function broadcastPresence(event: PresenceEvent): void {
  void (async () => {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const cf = getCloudflareContext() as unknown as {
        env?: { PRESENCE_HUB?: NamespaceLike }
        ctx?: { waitUntil(p: Promise<unknown>): void }
      }
      const ns = cf.env?.PRESENCE_HUB
      if (!ns) return
      const stub = ns.get(ns.idFromName('global'))
      const req = new Request('https://presence-hub.internal/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      })
      if (cf.ctx && typeof cf.ctx.waitUntil === 'function') {
        cf.ctx.waitUntil(stub.fetch(req))
      } else {
        await stub.fetch(req)
      }
    } catch {
      /* runtime tanpa binding OpenNext (lokal) — normal */
    }
  })()
}
