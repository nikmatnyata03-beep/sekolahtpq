# Worklog — SIMADJI: Sistem Informasi Manajemen TPQ Darul Jinan

Project: Fullstack web adaptation of the uploaded blueprint PDF ("Blueprint Sistem Digital Terpadu untuk TPQ").
Original blueprint targeted Expo+Firebase mobile; we adapt to Next.js 16 + Prisma/SQLite + shadcn/ui.
Constraint: user-visible app lives at a single route `/` (SPA with view switching). APIs live under `/api/*`.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Project bootstrap — schema, seed, APIs, UI integration, QA.

Work Log:
- Read uploaded blueprint PDF; extracted feature set (see below).
- Created worklog.md.

Stage Summary:
- Feature set from blueprint to implement:
  1. PUBLIC PORTAL: Tentang Kami (visi/misi/sejarah), Struktur Organisasi, Kurikulum (Kemenag aligned), Kegiatan/Berita (blog mini), Biodata Guru (professional portfolio, Kemenag-style data), PPDB online registration with document info + status tracking.
  2. ADMIN DASHBOARD: user management (ADMIN/GURU/ORANG_TUA), santri management, class & session management, attendance (QR-code concept simulated via session code check-in), hafalan progress recording, teaching materials module, billing & payments, announcements, WhatsApp notification log.
  3. PARENT (WALI) PORTAL: child attendance history, hafalan progress, bills + simulated payment gateway (Midtrans-style: create pending tx -> pay -> webhook -> success + WhatsApp notification), announcements.
- Tech mapping: Expo→Next.js 16 SPA, Firebase Auth→demo email/password auth API, Firestore→Prisma/SQLite, Firebase Storage→mock asset URLs, WhatsApp BSP→Notification log simulation, Midtrans webhook→simulated pay endpoint.
- Design: emerald green (Islamic) + amber gold accents, Indonesian language UI, sticky footer, responsive, shadcn/ui components.
- Single route `/`: role switcher (Portal Publik | Wali Santri | Guru | Admin) with demo login.

## API CONTRACT (implemented & verified via curl)
Shared types: `src/lib/types.ts` — fetch helpers: `src/lib/api-client.ts` (apiGet/apiSend/formatRupiah/formatDate/formatShortDate).
- POST /api/auth/login {email,password} -> {user: AuthUser}
- GET /api/stats -> DashboardStats (students, teachers, classes, registrationsPending, hafalanCount, materialCount, revenue, outstanding, pendingCount, successCount, attendanceToday{HADIR,IZIN,SAKIT,ALPA}, attendanceRate, activeSessions[{code,className,topic,date}], attendanceTrend[{date,hadir,total,rate}], recentRegistrations, recentNotifications, recentPayments, recentHafalan)
- GET/POST/PUT/DELETE /api/users (DELETE ?id=)
- GET/POST/PUT/DELETE /api/teachers (JSON-string fields: formalEducation, nonFormalEducation, certifications; optional account via {email,password})
- GET/POST/PUT/DELETE /api/classes (GET returns studentCount)
- GET/POST/PUT/DELETE /api/students (?parentId= ?classId=; auto-NIS if missing)
- GET/POST/PUT /api/registrations (POST public PPDB form -> regNumber + WA notif; PUT {id,status,reviewNote,classId?} -> DITERIMA auto-creates santri+parent account)
- GET/POST/PUT /api/sessions (POST {classId,topic} generates code + closes old active; ?active=1)
- GET/POST /api/attendance (POST {sessionId, records:[{studentId,status,note}]} bulk upsert + WA notif to parents; GET ?sessionId= ?classId= ?studentId=)
- POST /api/attendance/checkin {code, studentId} -> QR-simulated check-in + WA notif
- GET/POST/DELETE /api/hafalan (POST triggers WA notif with grade)
- GET/POST/DELETE /api/materials
- GET/POST/PUT /api/payments (POST creates invoice + WA notif; PUT {id,status,method} = simulated gateway webhook -> WA confirmation)
- GET/POST/PUT/DELETE /api/posts (?published=1)
- GET/POST/DELETE /api/announcements (POST {priority:'PENTING',broadcast:true} broadcasts WA to all parents)
- GET/POST /api/notifications (?userId=) ; PUT /api/notifications/read {userId}
- GET /api/portal/parent?userId= -> ParentPortalData (students w/ attendanceSummary, attendances, hafalans, payments, billing; notifications; announcements)

Demo accounts (seeded): admin@daruljinan.sch.id/admin123 · ustadzah.fatimah@daruljinan.sch.id/guru123 · budi.santoso@gmail.com/ortu123

## Stage 1 complete: backend fully working. Stage 2: parallel UI agents (5-a public, 5-b admin, 5-c parent+login).

---
Task ID: 5-c
Agent: parent-portal (frontend-styling-expert)
Task: Login dialog + parent portal UI

Work Log:
- Read worklog.md API contract, types.ts, api-client.ts; verified live route shapes (portal/parent, sessions, attendance/checkin, payments PUT, notifications/read, auth/login) against component code.
- Skimmed ui primitives (dialog, tabs, dropdown-menu, card, progress, table, radio-group, badge, alert, button, input, label, skeleton, separator) and hooks/use-toast; confirmed lucide-react 0.525 icons (Mosque unavailable -> Landmark/MoonStar used).
- Created src/components/auth/login-dialog.tsx: controlled dialog, emerald gradient brand header (Landmark + custom DialogClose), email/password with show/hide Eye toggle, Loader2 submit, destructive Alert on failure (401 "Email atau password salah"), 3 demo quick-fill chips (Admin/Guru/Wali, Wali featured in emerald with amber WALI tag), note "Data demo — password default per peran". POST /api/auth/login -> onSuccess(user).
- Created src/components/parent/child-panel.tsx: exports ChildPanel + ParentStudent type. Per-child grid (grid-cols-1 lg:grid-cols-2, rounded-2xl white cards): (a) summary card w/ initials avatar, NIS/class badges, jadwal, ustadz, HADIR emerald/IZIN amber/SAKIT orange/ALPA red chips + Progress hadir/total; (b) attendance history max-h-72 scroll w/ formatShortDate + status badges; (c) hafalan list w/ grade circle (>=85 emerald, >=70 amber, <70 red), TAHFIDZ/TAHSHIN teal/MURAJAAH amber badges, italic teacherNote, avg grade + count header; (d) Tagihan card: amber outstanding strip, table (invoiceNo/title/amount/status/paidAt), PENDING -> "Bayar", FAILED -> "Coba Bayar Lagi"; PaymentDialog: invoice summary, RadioGroup QRIS(QrCode)/GoPay(Smartphone)/VA_BCA(Landmark), "Bayar Sekarang" -> 1.8s processing state ("Menghubungi gateway pembayaran...", buttons/dialog-close disabled) -> PUT /api/payments {id,status:'SUCCESS',method} -> success view (CircleCheck + "WhatsApp konfirmasi terkirim ke wali") -> onPaid refresh; timer cleanup on unmount, processing blocks dismiss; (e) QR check-in mini-card: kode input + POST /api/attendance/checkin {code, studentId} w/ toast result, hint chips of active codes.
- Created src/components/parent/parent-portal.tsx: exports ParentPortal({user,onLogout}). Sticky white/blur header (mini brand, refresh, bell DropdownMenu w/ unread amber badge + list + "Tandai semua dibaca" -> PUT /api/notifications/read, user avatar chip, logout), emerald hero "Assalamu'alaikum, {parent.name}" + first-2 announcements (PENTING on amber cards), child Tabs (one per santri, amber dot if pending tagihan), "Kotak Notifikasi WhatsApp" inbox card (*bold* segments rendered via split('*') -> <strong>, relative time, unread amber highlight, mark-all-read). GET /api/portal/parent?userId= with initial Skeleton screen, silent refresh, destructive error Alert + "Coba Lagi"; guarded empty-students state "Belum ada santri terdaftar pada akun ini".
- Decision: portal API students carry className but not classId, so active check-in code hints come from GET /api/sessions?active=1 fetched once in ParentPortal and filtered per child by className match (non-blocking, fails silently to []).
- Verified: bun run lint -> clean; bunx tsc --noEmit -> zero errors in src/components/auth|parent (remaining errors are 5-b admin files + pre-existing skills/prisma seed, untouched).

Stage Summary:
- Files created: src/components/auth/login-dialog.tsx (export LoginDialog), src/components/parent/parent-portal.tsx (export ParentPortal), src/components/parent/child-panel.tsx (exports ChildPanel, type ParentStudent). No other files touched.
- Design: emerald-700 primary / amber-500 accents / white rounded-2xl cards / stone-50 bg, fully Bahasa Indonesia, all money/dates via formatRupiah/formatDate/formatShortDate, responsive stacking, loading skeletons + empty states + retry alerts throughout.
- Integration: page.tsx (main agent) should render <LoginDialog open onOpenChange onSuccess> for auth and <ParentPortal user onLogout> for role ORANG_TUA; Toaster assumed mounted at app root.

---
Task ID: 5-a
Agent: public-portal (frontend-styling-expert)
Task: Public portal UI components

Work Log:
- Read worklog.md, types.ts, api-client.ts contract + verified API response shapes (registrations, sessions, checkin, students, announcements, curriculum, posts) against route.ts implementations before coding.
- Skimmed shadcn/ui components (button, card, dialog, select, tabs, badge, checkbox, sheet, alert, input, skeleton) to match exact APIs; confirmed Toaster is mounted in root layout and @/hooks/use-toast exists.
- Created 11 client components under src/components/public/: portal (composition + sticky header w/ smooth-scroll nav + mobile Sheet hamburger + Masuk/Cek-in actions), hero (emerald gradient + inline-SVG 8-point star lattice pattern + Bismillah + CTA + /api/stats stat chips with skeleton), announcements-ticker (framer-motion infinite marquee, PENTING in amber, click -> detail Dialog), about-section (visi/misi, 2005-2025 timeline, struktur organisasi hierarchy with connector lines, 4 keunggulan cards), curriculum-section (fetch curriculum+classes, subject-grouped cards TAJWID/HAFALAN/IBADAH/AKHLAK with distinct colors + Capaian line, class schedule chips, scroll area w/ custom webkit scrollbar), teachers-section (initials avatar gender-colored, years-from-joinDate badge, biodata Dialog with safe JSON.parse of formalEducation/nonFormalEducation/certifications, filosofi quote, kelas diampu), materials-section (category chips + class Select filter, type icons PDF/SLIDE/VIDEO/AUDIO, Unduh via <a target=_blank>), news-section (Tabs Semua/BERITA/KEGIATAN/ARTIKEL, featured card + grid, plain <img> with onError fallback over gradient, article Dialog with \n\n paragraph splitting), ppdb-section (2-col validated form, document checkboxes -> documents[], POST /api/registrations, success Dialog with big regNumber + copy + WA next-steps, right column Cek Status widget with status badges + 3-step timeline hint), checkin-section (santri Select grouped by class?.name, active session cards from /api/sessions?active=1 (click fills code), POST /api/attendance/checkin with success/already/error toasts + session refresh, QR-simulation info Alert), footer (emerald-950, 3 columns: brand+address+phone/WA+email, tautan cepat, jam operasional, (c) 2025 line).
- Design system enforced: emerald-700/800 primary, amber-500 gold accents, stone/white alternating section backgrounds, rounded-2xl cards with hover -translate-y-0.5 + shadow-lg, section eyebrow+3xl title+description pattern, py-16 max-w-6xl px-4 containers, scroll-mt-20 on sections, decorative Arabic snippets in font-serif, lucide-react icons only.
- QA: `bun run lint` -> 0 errors 0 warnings (removed one unused eslint-disable directive); `bunx tsc --noEmit` -> 0 errors in src/components/public (remaining 40 errors are pre-existing in prisma/seed.ts, src/components/admin, examples/, skills/ — other agents' scope).

Stage Summary:
- Files created (11): src/components/public/{portal,hero,announcements-ticker,about-section,curriculum-section,teachers-section,materials-section,news-section,ppdb-section,checkin-section,footer}.tsx — all 'use client', all UI text Bahasa Indonesia.
- Exports: PublicPortal({onOpenLogin}) (portal.tsx), Hero, StarLattice (reused by about/footer), AnnouncementsTicker, AboutSection, CurriculumSection, TeachersSection, MaterialsSection, NewsSection, PpdbSection, CheckinSection, Footer({onNavigate}).
- Decisions: framer-motion used for hero entrance + ticker loop (no inline <style> tags); marquee duplicated content x0%->-50% for seamless loop; ticker renders nothing when no announcements; curriculum/materials lists capped with max-h + custom thin webkit scrollbar via tailwind arbitrary selectors; <img> kept for post covers (next/image domain config avoided) with onError gradient fallback; teacher JSON fields parsed via safeParseArray with try/catch; PPDB status check fetches /api/registrations and matches regNumber case-insensitively; section anchors: beranda, tentang, kurikulum, guru, materi, berita, ppdb, checkin; smooth scroll via scrollIntoView (no globals.css change).

---
Task ID: 5-b
Agent: admin-dashboard (frontend-styling-expert)
Task: Admin dashboard UI components

Work Log:
- Read worklog.md API contract, src/lib/types.ts, src/lib/api-client.ts, and skimmed shadcn ui components (dialog/table/badge/sheet/tabs/switch/progress/alert-dialog/alert) + verified deps (recharts 2.15.4, qrcode.react 4.2.0, lucide-react) and exact response shapes of /api/sessions, /api/attendance, /api/posts, /api/announcements, /api/registrations routes before integrating.
- Created src/components/admin/dashboard.tsx: AdminDashboard({user,onLogout}) shell — emerald sidebar (hidden on md, Sheet hamburger on mobile) with 12 icon+label sections, sticky top bar (section title, Portal Publik link, user chip w/ role badge, logout), content area on stone-50. Role filter: ADMIN sees all; GURU only [Ringkasan, Kelas, Absensi, Hafalan, Materi] via GURU_ALLOWED allowlist; default section Ringkasan.
- Created overview.tsx: 6 KPI cards (Santri/Guru/Kelas/Pendaftar/Pemasukan/Tunggakan w/ formatRupiah), Kehadiran Hari Ini card (4 status dots + Progress attendanceRate), Sesi Aktif card (QRCodeSVG size=64, mono code, copy-to-clipboard toast), recharts emerald LineChart of attendanceTrend rate %, 4 recent lists (registrations w/ status badges, payments, hafalan w/ grade colors, WhatsApp notifications). Exports shared statusBadgeClass().
- Created registrations-admin.tsx: status filter Tabs w/ counts, table (regNumber, childName+gender, birthDate, parent+phone, documents JSON-parsed file chips, status badge), actions dropdown: Verifikasi (PUT VERIFIKASI), Terima dialog (optional kelas select → PUT {status:DITERIMA, classId} + toast re: auto-created santri+akun wali), Tolak dialog (reviewNote textarea), Hapus AlertDialog.
- Created students-admin.tsx: search (name/NIS) + class filter + Tambah/Edit dialog (fullName, gender, birthDate date input, address, optional class & parent selects w/ 'none' sentinel), status change menu (AKTIF/NONAKTIF/LULUS), _count chips (hafalan/tagihan/absen), Hapus confirm.
- Created teachers-admin.tsx: card grid w/ avatar initials, expertise badge, kelas diampu chips, isActive switch (PUT), big scrollable dialog form incl. repeatable EduListEditor rows (level/institusi/tahun) for formalEducation/nonFormalEducation/certifications sent via JSON.stringify; create dialog has optional account (email/password); delete shows API error toast (e.g. masih mengampu).
- Created classes-admin.tsx: card grid (level badge colors IQRA/TAHFIDZ/AL_QURAN, schedule, room, teacher, studentCount), Tambah/Edit dialog (name, level select, schedule, room, teacher select), Hapus confirm.
- Created attendance-admin.tsx: QR flow — left "Buka Sesi Kelas" (class select + topic + date default today → POST /api/sessions → BIG code + QRCodeSVG size=128 + copy + Tutup Sesi PUT isActive:false), active sessions list w/ hadir/total; right "Catat Kehadiran" (session select → loads /api/students?classId + /api/attendance?sessionId → per-student HADIR/IZIN/SAKIT/ALPA toggle buttons + note input for IZIN/SAKIT → Simpan POST {sessionId, records} + WA toast); below recent attendance log table.
- Created hafalan-admin.tsx: Catat Setoran card (student select w/ class, surah input + datalist of 31 Juz-30 surah names, ayatRange, type TAHFIDZ/TAHSHIN/MURAJAAH, grade 0-100, teacherNote → POST + WA toast), history table w/ grade coloring (>=85 emerald, >=70 amber, <70 red), delete confirm.
- Created materials-admin.tsx: Unggah Materi form (title, type PDF/SLIDE/VIDEO/AUDIO, url "Tautan file (URL)", category, optional class, teacher select required & locked to own teacherId for GURU via user prop), table w/ type icons, external-link open, delete confirm.
- Created payments-admin.tsx: summary cards (revenue SUCCESS sum, tunggakan PENDING sum+count), search + status filter, Buat Tagihan dialog (student, title "Iuran SPP Bulan Ini" placeholder, amount → POST + WA toast), table (invoiceNo, method chip, status badge, paidAt) w/ dropdown Tandai Berhasil (PUT {status:SUCCESS, method:MANUAL}) / Tandai Gagal / Hapus.
- Created content-admin.tsx: Tabs [Berita & Artikel | Pengumuman] — posts table (category badge, author, published Switch PUT, edit + Tulis Artikel dialogs w/ category/coverImage/content/published checkbox/author select from teachers, delete confirm); announcements cards (PENTING amber badge, delete), Buat Pengumuman dialog w/ priority select + conditional "Broadcast WhatsApp ke semua wali" checkbox → POST {broadcast:true}.
- Created users-admin.tsx (guarded non-ADMIN): table w/ role badges, change-role dropdown (PUT role), reset password dialog (PUT password), Tambah Pengguna dialog, Hapus confirm surfacing API error (last-admin case).
- Created whatsapp-log.tsx (guarded non-ADMIN): teal explainer alert "Simulasi WhatsApp Business API", message cards w/ phone, *bold* → <strong> rendering via split regex, SENT badge + relative time, Kirim Pesan Manual dialog (phone+message → POST /api/notifications), refresh button.
- QA: `bunx eslint src/components/admin/ --max-warnings=0` → clean; `tsc --noEmit` → zero errors in admin files (fixed TS18047 null-narrowing in attendance roster effect and TS2783 spread overwrite in setRecord); did not touch page.tsx/layout.tsx/globals.css/API routes/other agents' files; no new npm packages; did not run dev server.

Stage Summary:
- Files created (exactly 13, all 'use client'): src/components/admin/{dashboard,overview,registrations-admin,students-admin,teachers-admin,classes-admin,attendance-admin,hafalan-admin,materials-admin,payments-admin,content-admin,users-admin,whatsapp-log}.tsx
- Export: AdminDashboard({user,onLogout}) in dashboard.tsx; sections exported as OverviewSection, RegistrationsAdmin, StudentsAdmin, TeachersAdmin, ClassesAdmin, AttendanceAdmin, HafalanAdmin, MaterialsAdmin({user}), PaymentsAdmin, ContentAdmin, UsersAdmin({user}), WhatsAppLog({user}). MaterialsAdmin accepts optional user to lock teacher select for GURU; users/whatsapp re-guard ADMIN internally.
- Section visibility: ADMIN = all 12; GURU = Ringkasan, Kelas, Absensi, Hafalan, Materi (allowlist GURU_ALLOWED; admin-only items unreachable via nav since not rendered).
- Decisions: shared statusBadgeClass lives in overview.tsx (no extra files created beyond the 13 allowed); VERIFIKASI badge = teal (no blue anywhere; sky replaced by teal); Radix Select 'none' sentinel for optional FK selects; documents/education JSON parsed via safe helpers w/ try/catch; sessions fetched once and active list derived client-side (API verified); every fetch has skeleton + destructive alert w/ retry + empty state; all mutations refetch after success, disable submit with Loader2, and confirm destructive via AlertDialog; tables wrapped overflow-x-auto w/ min-w on inner table; long lists use max-h + overflow-y-auto + thin webkit scrollbar utility classes.

---
Task ID: 6-7
Agent: main (Z.ai Code)
Task: Integration + end-to-end browser QA

Work Log:
- Integrated page.tsx: session restore from localStorage, role-based routing (ORANG_TUA→ParentPortal, ADMIN/GURU→AdminDashboard, default→PublicPortal), LoginDialog wiring, loading screen.
- Added `onOpenPublic` SPA prop to AdminDashboard + ParentPortal ("Portal Publik" button switches views without reload).
- layout.tsx: metadata rebranded to SIMADJI — TPQ Darul Jinan, lang="id", favicon /logo.svg.
- Fixed lint error react-hooks/set-state-in-effect in page.tsx (deferred session restore via timer callback).
- Fixed seed.ts TS types (Prisma Teacher/User/Student[] annotations).
- Agent-browser E2E QA (all PASSED):
  1. Public portal full render (hero/tentang/kurikulum/guru/materi/kabar/PPDB/checkin/footer) — desktop 1280px + iPhone 15 emulation.
  2. Login dialog with demo chips: admin, wali.
  3. Admin dashboard: KPI cards, kehadiran hari ini, sesi aktif with QR.
  4. Absensi flow: created session "Ujian Bab Iqra 1" (Iqra 1) → QR rendered → marked Zahra HADIR + Rizky IZIN (note "Acara keluarga") → saved → toast "notifikasi WhatsApp terkirim".
  5. WhatsApp log: shows simulated BSP messages with *bold* rendering.
  6. Parent portal (Budi Santoso): 2 children tabs, outstanding Rp 75.000, announcements.
  7. Payment simulation: QRIS → "Menghubungi gateway pembayaran..." → success → status SUCCESS in table → WA confirmation (bell 1→2).
  8. QR check-in: duplicate prevented ("sudah tercatat IZIN").
  9. PPDB public form: validation toast on missing date → filled → success dialog with regNumber PPDB-2025-0004.
  10. PPDB admin acceptance: Terima + assign Iqra 1 → auto-created santri DJ-2025-009 + parent account ridwan.hakim@gmail.com (verified via API) + WA notif.
  11. Revenue updated live Rp 400.000 → Rp 475.000. Zero console/page errors; dev.log clean.

Stage Summary:
- FULL FEATURE-COMPLETE MVP per blueprint: public portal + PPDB + QR attendance + hafalan + materials + billing w/ simulated gateway + WhatsApp notification engine + parent portal + role-based dashboards.
- Demo accounts: admin@daruljinan.sch.id/admin123 · ustadzah.fatimah@daruljinan.sch.id/guru123 · budi.santoso@gmail.com/ortu123
- Known minor polish items for next iteration: mobile admin KPI card height could be tightened; date input could get friendlier Indonesian formatting hint; no real QR-scan camera (by design, code-typed simulation).
