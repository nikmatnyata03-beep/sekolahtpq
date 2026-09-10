'use client'

import { useEffect, useRef } from 'react'
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile'

type TurnstileInstance = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string | number
  reset: (widgetId?: string | number) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance
  }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile gagal dimuat')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.turnstile = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile gagal dimuat'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function TurnstileWidget({ onToken, resetSignal = 0 }: { onToken: (token: string) => void; resetSignal?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | number | undefined>(undefined)
  const onTokenRef = useRef(onToken)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    let cancelled = false
    void loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current !== undefined) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        })
      })
      .catch(() => onTokenRef.current(''))

    return () => {
      cancelled = true
      if (widgetIdRef.current !== undefined && window.turnstile) window.turnstile.reset(widgetIdRef.current)
      widgetIdRef.current = undefined
    }
  }, [])

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current !== undefined && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
      onTokenRef.current('')
    }
  }, [resetSignal])

  return <div ref={containerRef} className="min-h-[65px]" aria-label="Verifikasi keamanan" />
}
