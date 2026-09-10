import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'
import { resolveNorm, targetProgress } from '@/lib/hafalan-utils'
import { guard } from '@/lib/session'

/**
 * ==== API CONTRACT — /api/hafalan (Task 14-a) ====
 * GET  ?studentId=   → Hafalan[] (latest 100, student {fullName,nis,className})
 * POST {studentId, surahName, ayatRange, type?, grade?, teacherNote?}
 *   → creates the setoran, sends the standard WA to the parent,
 *     then checks whether this setoran completes the student's hafalanTarget
 *     for the FIRST time (before.targetReached=false → after.targetReached=true,
 *     via targetProgress of lib/hafalan-utils + resolveNorm alias match).
 *     When justReached, an extra celebratory WA is sent to the parent
 *     (silently skipped when the student has no parent account).
 *   → { ...createdHafalan, targetJustReached: boolean, targetName: string | null }
 *     Celebration failures NEVER break record creation (targetJustReached=false).
 * DELETE ?id=        → { success: true }
 */

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if ('res' in g) return g.res
  const studentId = req.nextUrl.searchParams.get('studentId')
  const hafalans = await db.hafalan.findMany({
    where: studentId ? { studentId } : {},
    include: { student: { select: { id: true, fullName: true, nis: true, class: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return ok(hafalans.map((h) => ({ ...h, student: { ...h.student, className: h.student.class?.name || '-' } })))
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.studentId || !b.surahName || !b.ayatRange) return bad('Santri, surah, dan rentang ayat wajib diisi')
    const hafalan = await db.hafalan.create({
      data: {
        studentId: b.studentId,
        surahName: b.surahName,
        ayatRange: b.ayatRange,
        type: b.type || 'TAHFIDZ',
        grade: b.grade ? Number(b.grade) : null,
        teacherNote: b.teacherNote || null,
      },
      include: { student: { include: { parent: true } } },
    })
    // Notify parent about setoran result (per blueprint: parental involvement)
    if (hafalan.student.parent) {
      await sendWhatsApp({
        phone: hafalan.student.parent.phone,
        userId: hafalan.student.parent.id,
        message: `Alhamdulillah, *${hafalan.student.fullName}* menyelesaikan setoran ${b.type === 'MURAJAAH' ? 'murajaah' : 'hafalan'} *QS ${b.surahName} ${b.ayatRange}*${b.grade ? ` dengan nilai ${b.grade}` : ''}. ${b.teacherNote || ''} — TPQ Darul Jinan`,
      })
    }
    // ==== Target celebration (Task 14-a) ====
    // Deteksi "target tercapai PERTAMA kali": bandingkan targetProgress SEBELUM
    // (daftar tanpa setoran baru) vs SESUDAH (dengan setoran baru). Kegagalan
    // deteksi/WA tidak boleh menggagalkan pencatatan setoran.
    let targetJustReached = false
    let targetName: string | null = null
    try {
      const target = hafalan.student.hafalanTarget
      const targetMatchesSetoran = !!target && resolveNorm(b.surahName) === resolveNorm(target)
      if (target && targetMatchesSetoran) {
        const beforeList = await db.hafalan.findMany({
          where: { studentId: hafalan.studentId, id: { not: hafalan.id } },
          select: { surahName: true },
        })
        const before = targetProgress(beforeList, target)
        const after = targetProgress([...beforeList, { surahName: hafalan.surahName }], target)
        if (before?.valid && after?.valid && !before.targetReached && after.targetReached) {
          targetJustReached = true
          targetName = after.targetName
          // WA perayaan ke wali (skip senyap bila santri tanpa akun wali)
          if (hafalan.student.parent) {
            await sendWhatsApp({
              phone: hafalan.student.parent.phone,
              userId: hafalan.student.parent.id,
              message: `🎉 MasyaAllah, tabarakallah! ${hafalan.student.fullName} telah MENYEMPURNAKAN target hafalan *${after.targetName}* (${after.reached}/${after.position} surah Juz 30). Jazakumullahu khairan. — TPQ Darul Jinan`,
            })
          }
        }
      }
    } catch (e) {
      console.error('target celebration check failed', e)
      targetJustReached = false
      targetName = null
    }
    return ok({ ...hafalan, targetJustReached, targetName })
  } catch {
    return bad('Gagal mencatat hafalan')
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  await db.hafalan.delete({ where: { id } })
  return ok({ success: true })
}
