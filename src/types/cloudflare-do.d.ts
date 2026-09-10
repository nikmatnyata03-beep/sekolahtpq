/**
 * Tipe minimal Cloudflare Durable Objects (SQLite-backed) — hanya API yang
 * benar-benar dipakai SIMADJI, sehingga kita tidak perlu memasang
 * @cloudflare/workers-types global (yang bisa berbenturan dengan lib.dom
 * Next.js di sisi klien).
 */

declare module 'cloudflare:workers' {
  export class DurableObject {
    constructor(state: DurableObjectState, env: unknown)
  }
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<boolean>
}

interface DurableObjectWebSocketAutoResponsePair {
  incoming: string
  outgoing: string
}

interface DurableObjectState {
  waitUntil(promise: Promise<unknown>): void
  acceptWebSocket(ws: WebSocket, tags?: string[]): void
  getWebSockets(tag?: string): WebSocket[]
  setWebSocketAutoResponsePair?(pair: DurableObjectWebSocketAutoResponsePair): void
  storage: DurableObjectStorage
}

/**
 * Pair WebSocket workerd: array-like [client, server] — CATATAN PENTING:
 * properti bernama .client/.server TIDAK ADA di runtime modern; wajib pakai
 * indeks `pair[0]` (client) dan `pair[1]` (server) — sudah diverifikasi
 * empiris dengan workerd (wrangler dev) dan produksi.
 */
declare const WebSocketPair: {
  new (): [WebSocket, WebSocket]
}

interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface DurableObjectNamespace {
  idFromName(name: string): unknown
  get(id: unknown): DurableObjectStub
}
