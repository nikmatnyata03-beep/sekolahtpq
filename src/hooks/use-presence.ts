'use client'

/**
 * usePresenceFeed — sumber data Panel Presensi Live.
 *
 * Strategi dual-runtime:
 *  1. COBA WebSocket ke /api/realtime/presence (di produksi Cloudflare,
 *     upgrade di-intercept src/worker.ts → Durable Object PresenceHub,
 *     broadcast instan antar dasbor).
 *  2. GAGAL / lokal dev → mode polling REST snapshot (10 dtk; 30 dtk saat
 *     live untuk menyegarkan statistik).
 *
 * Mode dikembalikan agar UI bisa menampilkan badge LIVE vs Polling.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '@/lib/api-client'

export type PresenceEvent = {
  id: string
  type: 'checkin' | 'session_open' | 'session_close'
  sessionId: string
  sessionCode: string
  className: string
  studentId?: string
  studentName?: string
  status?: string
  actor?: string
  at: string
}

export type ActiveSessionInfo = {
  id: string
  className: string
  level: string
  topic: string | null
  total: number
  hadir: number
}

export type PresenceSnapshot = {
  events: PresenceEvent[]
  activeSessions: ActiveSessionInfo[]
  stats: { hadir: number; tercatat: number; santriAktif: number; sesiAktif: number }
  serverTime: string
}

export type PresenceMode = 'connecting' | 'live' | 'polling'

const MAX_EVENTS = 80
const POLL_INTERVAL_LIVE = 30_000
const POLL_INTERVAL_FALLBACK = 10_000
const RETRY_WS_MS = 30_000
const HEARTBEAT_MS = 30_000

export function usePresenceFeed() {
  const [events, setEvents] = useState<PresenceEvent[]>([])
  const [snapshot, setSnapshot] = useState<PresenceSnapshot | null>(null)
  const [mode, setMode] = useState<PresenceMode>('connecting')
  const modeRef = useRef<PresenceMode>('connecting')

  const setModeSafe = useCallback((m: PresenceMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  const fetchSnapshot = useCallback(async () => {
    try {
      const data = await apiGet<PresenceSnapshot>('/api/realtime/presence')
      setSnapshot(data)
      setEvents((prev) => {
        if (modeRef.current !== 'live') return data.events
        // mode live: pertahankan event instan yang mungkin belum masuk snapshot
        const byId = new Map(data.events.map((e) => [e.id, e]))
        for (const e of prev) if (!byId.has(e.id)) byId.set(e.id, e)
        return Array.from(byId.values())
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, MAX_EVENTS)
      })
    } catch {
      /* jaringan sempat gagal — coba lagi di tick berikutnya */
    }
  }, [])

  useEffect(() => {
    let disposed = false
    let ws: WebSocket | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    let waitingPong = false

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    const startPolling = (ms: number) => {
      if (pollTimer) return
      void fetchSnapshot()
      pollTimer = setInterval(() => {
        void fetchSnapshot()
      }, ms)
    }

    const connect = () => {
      if (disposed) return
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        ws = new WebSocket(`${proto}//${window.location.host}/api/realtime/presence`)

        ws.onopen = () => {
          if (disposed) return
          setModeSafe('live')
          stopPolling()
          startPolling(POLL_INTERVAL_LIVE) // statistik tetap segar saat live
        }
        ws.onmessage = (ev) => {
          if (disposed) return
          waitingPong = false
          try {
            const msg = JSON.parse(String(ev.data)) as
              | { kind: 'snapshot'; events: PresenceEvent[] }
              | { kind: 'event'; event: PresenceEvent }
            if (msg.kind === 'snapshot') {
              setEvents(msg.events)
            } else if (msg.kind === 'event') {
              const e = msg.event
              setEvents((prev) => [e, ...prev.filter((x) => x.id !== e.id)].slice(0, MAX_EVENTS))
              // statistik menyusul (delay kecil supaya tidak spam query)
              window.setTimeout(() => {
                if (!disposed) void fetchSnapshot()
              }, 1200)
            }
          } catch {
            /* pesan tidak dikenal */
          }
        }
        ws.onerror = () => {
          /* onclose akan mengikuti */
        }
        ws.onclose = () => {
          if (disposed) return
          ws = null
          setModeSafe('polling')
          stopPolling()
          startPolling(POLL_INTERVAL_FALLBACK)
          if (!retryTimer) {
            retryTimer = setTimeout(() => {
              retryTimer = null
              connect()
            }, RETRY_WS_MS)
          }
        }
      } catch {
        setModeSafe('polling')
        startPolling(POLL_INTERVAL_FALLBACK)
      }
    }

    connect()

    // heartbeat: kirim "ping" — di produksi dijawab runtime (auto-response pair)
    // tanpa membangunkan Durable Object; tanpa balasan → tutup & reconnect.
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        if (waitingPong) {
          try {
            ws.close()
          } catch {
            /* ignore */
          }
        } else {
          waitingPong = true
          try {
            ws.send('ping')
          } catch {
            /* ignore */
          }
        }
      }
    }, HEARTBEAT_MS)

    return () => {
      disposed = true
      stopPolling()
      if (retryTimer) clearTimeout(retryTimer)
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (ws) {
        try {
          ws.onclose = null
          ws.close()
        } catch {
          /* ignore */
        }
      }
    }
  }, [fetchSnapshot, setModeSafe])

  return { events, snapshot, mode }
}
