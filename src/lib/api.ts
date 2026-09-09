import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export function ok(data: unknown) {
  return NextResponse.json(data)
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Simulate sending a WhatsApp Business API message (BSP style, per blueprint).
 * In production this would call a provider like YCloud/AiSensy via Cloud Functions.
 * Here we persist the message to the Notification log (WhatsApp log in admin).
 */
export async function sendWhatsApp(opts: { phone?: string | null; message: string; userId?: string | null }) {
  const phone = opts.phone?.trim()
  if (!phone) return
  try {
    await db.notification.create({
      data: { phone, message: opts.message, userId: opts.userId ?? undefined, channel: 'WHATSAPP', status: 'SENT' },
    })
    console.log(`[WHATSAPP] -> ${phone}: ${opts.message.slice(0, 80)}...`)
  } catch (e) {
    console.error('sendWhatsApp failed', e)
  }
}

export function rupiah(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

export { db }
