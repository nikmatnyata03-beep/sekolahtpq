/**
 * PresenceHub — Durable Object (SQLite-backed, tier gratis Cloudflare) untuk
 * PANEL PRESENSI LIVE SIMADJI.
 *
 * Alur:
 *  - Route server (check-in QR, buka/tutup sesi) memanggil stub
 *    POST /broadcast lewat binding PRESENCE_HUB (in-process, tanpa self-fetch).
 *  - DO menyimpan event "hari ini" (WIB) di storage (tahan hibernation) dan
 *    menyiarkannya ke semua dasbor admin/guru yang terhubung via WebSocket.
 *  - Koneksi WebSocket di-intercept src/worker.ts SEBELUM masuk OpenNext
 *    (Next.js tidak mendukung upgrade WebSocket) dan diteruskan ke DO ini.
 *  - Session cookie diverifikasi langsung di DO (session-core, tanpa D1) —
 *    hanya ADMIN/GURU/DEVELOPER yang boleh melihat feed.
 *
 * Hemat kuota tier gratis:
 *  - WebSocket HIBERNATION: koneksi idle tidak menghitung durasi aktif DO.
 *  - setWebSocketAutoResponsePair: "ping"→"pong" dijawab runtime tanpa
 *    membangunkan DO.
 */

import { DurableObject } from 'cloudflare:workers'
import { SESSION_COOKIE, readRawCookie, verifySessionTokenWithSecret, type SessionRole } from '@/lib/session-core'
import { wibDateKey } from '@/lib/wib'

export interface PresenceEvent {
  id: string
  type: 'checkin' | 'session_open' | 'session_close'
  sessionId: string
  sessionCode: string
  className: string
  studentId?: string
  studentName?: string
  status?: string
  actor?: string
  at: string // ISO
}

type HubMessage =
  | { kind: 'snapshot'; events: PresenceEvent[] }
  | { kind: 'event'; event: PresenceEvent }

const MAX_EVENTS = 80
const SNAPSHOT_KEY = 'presence_snapshot_v1'
const ALLOWED_ROLES: SessionRole[] = ['ADMIN', 'GURU', 'DEVELOPER']

export class PresenceHub extends DurableObject {
  private st: DurableObjectState
  private env: { SESSION_SECRET?: string }
  private events: PresenceEvent[] = []
  private loaded = false

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env)
    this.st = state
    this.env = (env ?? {}) as { SESSION_SECRET?: string }
    try {
      this.st.setWebSocketAutoResponsePair?.({ incoming: 'ping', outgoing: 'pong' })
    } catch {
      /* runtime lama tanpa fitur ini — abaikan */
    }
  }

  private async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try {
      const snap = await this.st.storage.get<{ date: string; events: PresenceEvent[] }>(SNAPSHOT_KEY)
      if (snap && snap.date === wibDateKey() && Array.isArray(snap.events)) {
        this.events = snap.events
      }
    } catch {
      this.events = []
    }
  }

  private async persist(): Promise<void> {
    try {
      await this.st.storage.put(SNAPSHOT_KEY, { date: wibDateKey(), events: this.events })
    } catch {
      /* penyimpanan gagal — feed tetap hidup di memori */
    }
  }

  private pushToSockets(msg: HubMessage): void {
    const data = JSON.stringify(msg)
    for (const ws of this.st.getWebSockets()) {
      try {
        ws.send(data)
      } catch {
        /* klien menghilang — biarkan hibernation/close menangani */
      }
    }
  }

  /** Tambah event + siarkan ke semua dasbor yang terhubung. */
  async addEvent(event: PresenceEvent): Promise<void> {
    await this.load()
    const today = wibDateKey()
    if (typeof event.at !== 'string' || event.at.slice(0, 10) !== today) return
    // buang sisa event hari lain + dedupe
    this.events = this.events.filter((e) => e.at.slice(0, 10) === today && e.id !== event.id)
    this.events.unshift(event)
    if (this.events.length > MAX_EVENTS) this.events = this.events.slice(0, MAX_EVENTS)
    await this.persist()
    this.pushToSockets({ kind: 'event', event })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // 1) Upgrade WebSocket dari src/worker.ts
    if ((request.headers.get('upgrade') ?? '').toLowerCase() === 'websocket') {
      const secret = this.env.SESSION_SECRET
      if (!secret) return new Response('Server belum terkonfigurasi', { status: 500 })
      const token = readRawCookie(request.headers.get('cookie'), SESSION_COOKIE)
      const user = await verifySessionTokenWithSecret(token, secret)
      if (!user || !ALLOWED_ROLES.includes(user.role)) {
        return new Response('Tidak diizinkan', { status: 401 })
      }
      try {
        await this.load()
        const pair = new WebSocketPair()
        this.st.acceptWebSocket(pair.server)
        try {
          pair.server.send(JSON.stringify({ kind: 'snapshot', events: this.events } satisfies HubMessage))
        } catch {
          /* klien sudah pergi */
        }
        return new Response(null, { status: 101, webSocket: pair.client } as unknown as ResponseInit)
      } catch (e) {
        // Diagnostik: pesan error asli ikut dikirim supaya masalah upgrade
        // terlihat dari uji curl tanpa harus membuka log dashboard.
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        console.error('[presence-hub] upgrade gagal:', msg)
        return new Response(`DO-UPGRADE-ERR: ${msg.slice(0, 280)}`, { status: 500 })
      }
    }

    // 2) Broadcast dari route server (binding internal)
    if (url.pathname.endsWith('/broadcast') && request.method === 'POST') {
      try {
        const ev = (await request.json()) as PresenceEvent
        if (!ev || typeof ev.type !== 'string' || typeof ev.sessionId !== 'string') {
          return new Response('Event tidak valid', { status: 400 })
        }
        await this.addEvent({
          ...ev,
          id: ev.id || crypto.randomUUID(),
          at: ev.at || new Date().toISOString(),
        })
        return Response.json({ ok: true })
      } catch {
        return new Response('Payload tidak valid', { status: 400 })
      }
    }

    // 3) Status internal (debug)
    await this.load()
    return Response.json({ ok: true, clients: this.st.getWebSockets().length, events: this.events.length })
  }

  /** Pesan dari klien: "ping" dijawab otomatis runtime; "hello" minta snapshot ulang. */
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (message === 'hello') {
      void (async () => {
        await this.load()
        try {
          ws.send(JSON.stringify({ kind: 'snapshot', events: this.events } satisfies HubMessage))
        } catch {
          /* abaikan */
        }
      })()
    }
  }

  webSocketClose(_ws: WebSocket): void {
    /* hibernation menangani pembersihan */
  }
}
