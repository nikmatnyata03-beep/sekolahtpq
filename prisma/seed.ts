/* Seed script — SIMADJI TPQ Darul Jinan */
import { PrismaClient, type Teacher, type User, type Student } from '@prisma/client'
import { hashPassword } from '../src/lib/password'

const db = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // wipe
  await db.notification.deleteMany()
  await db.curriculum.deleteMany()
  await db.announcement.deleteMany()
  await db.post.deleteMany()
  await db.payment.deleteMany()
  await db.material.deleteMany()
  await db.hafalan.deleteMany()
  await db.attendance.deleteMany()
  await db.session.deleteMany()
  await db.registration.deleteMany()
  await db.student.deleteMany()
  await db.class.deleteMany()
  await db.teacher.deleteMany()
  await db.user.deleteMany()

  // ===== USERS =====
  const admin = await db.user.create({
    data: { email: 'admin@daruljinan.sch.id', name: 'H. Ahmad Fauzi, S.Pd.I', phone: '081234567890', password: hashPassword('admin123'), role: 'ADMIN' },
  })

  const guruUsers = [
    { email: 'ustadzah.fatimah@daruljinan.sch.id', name: 'Ustadzah Fatimah Az-Zahra, S.Pd.I', phone: '081200000001', password: 'guru123', role: 'GURU' },
    { email: 'ustadz.yusuf@daruljinan.sch.id', name: 'Ustadz Yusuf Rahman, Lc.', phone: '081200000002', password: 'guru123', role: 'GURU' },
    { email: 'ustadzah.khadijah@daruljinan.sch.id', name: 'Ustadzah Khadijah Rahmawati', phone: '081200000003', password: 'guru123', role: 'GURU' },
    { email: 'ustadz.ibrahim@daruljinan.sch.id', name: 'Ustadz Ibrahim Musa, S.Pd.', phone: '081200000004', password: 'guru123', role: 'GURU' },
  ]

  const guruData = [
    {
      fullName: 'Ustadzah Fatimah Az-Zahra, S.Pd.I', gender: 'P', birthPlace: 'Bandung', birthDate: new Date('1988-04-12'),
      address: 'Jl. Melati No. 12, Jakarta Timur', phone: '081200000001',
      formalEducation: JSON.stringify([
        { level: 'S2', institution: 'UIN Syarif Hidayatullah Jakarta', year: '2015', major: 'Pendidikan Agama Islam' },
        { level: 'S1', institution: 'IAIN Syarif Hidayatullah', year: '2011', major: 'Tadris PAI' },
      ]),
      nonFormalEducation: JSON.stringify([
        { program: 'Takhasush Qiroah', institution: 'Ma\'had Ali Darul Jinan', year: '2012' },
        { program: 'Pelatihan Guru TPQ (PGTPQ)', institution: 'Kemenag Jakarta Timur', year: '2019' },
      ]),
      certifications: JSON.stringify([
        { name: 'Sertifikat Kompetensi Guru TPQ', issuer: 'Kemenag RI', year: '2020' },
        { name: 'Uji Kompetensi Tahsin & Tajwid', issuer: 'Dewan Direktur LPQ', year: '2021' },
      ]),
      expertise: 'Tajwid, Tahsin Usia Dini, Metode Qiroati',
      philosophy: 'Anak adalah amanah. Mengajar Al-Qur\'an bukan hanya memindahkan ilmu, tetapi menanamkan cinta kepada Kitabullah sejak dini.',
      bio: 'Pengasuh utama kelas Iqra dengan pengalaman mengajar 12 tahun di lingkungan TPQ. Berfokus pada metode pembelajaran menyenangkan untuk santri usia 5-9 tahun.',
      joinDate: new Date('2012-07-01'),
    },
    {
      fullName: 'Ustadz Yusuf Rahman, Lc.', gender: 'L', birthPlace: 'Surabaya', birthDate: new Date('1990-09-25'),
      address: 'Jl. Kenanga No. 45, Jakarta Timur', phone: '081200000002',
      formalEducation: JSON.stringify([
        { level: 'S1', institution: 'Universitas Islam Madinah', year: '2014', major: 'Syariah Islamiyah' },
      ]),
      nonFormalEducation: JSON.stringify([
        { program: 'Santri Mu\'id Tahfidz 30 Juz', institution: 'Ma\'had Tahfidz Al-Hikmah', year: '2013' },
      ]),
      certifications: JSON.stringify([
        { name: 'Sanad Al-Qur\'an 30 Juz (Hafs)', issuer: 'Majma\' Malik Fahd', year: '2015' },
        { name: 'Sertifikat Penguji Hafalan', issuer: 'BMTQ PNF Jatim', year: '2022' },
      ]),
      expertise: 'Tahfidz 30 Juz, Sanad Qiroah, Penguji Hafalan',
      philosophy: 'Setiap ayat yang terhafal adalah cahaya di akhirat. Konsistensi dan istiqamah adalah kunci, bukan kecepatan.',
      bio: 'Hafizh 30 juz bersanad, pendamping program Tahfidz intensif. Terbiasa memantau setoran hafalan harian santri dengan sistem target harian.',
      joinDate: new Date('2015-02-15'),
    },
    {
      fullName: 'Ustadzah Khadijah Rahmawati', gender: 'P', birthPlace: 'Bekasi', birthDate: new Date('1995-01-18'),
      address: 'Perum Griya Asri Blok C-8, Bekasi', phone: '081200000003',
      formalEducation: JSON.stringify([
        { level: 'S1', institution: 'Universitas Pendidikan Indonesia', year: '2017', major: 'Pendidikan Anak Usia Dini' },
      ]),
      nonFormalEducation: JSON.stringify([
        { program: 'Tahsin & Tajwid', institution: 'TPQ Al-Ikhlas', year: '2018' },
        { program: 'Montessori Islamic Approach', institution: 'IGTI Jakarta', year: '2021' },
      ]),
      certifications: JSON.stringify([
        { name: 'Sertifikat Kompetensi Guru TPQ', issuer: 'Kemenag RI', year: '2022' },
      ]),
      expertise: 'Metode Bermain Sambil Belajar, Akhlak & Adab, Bimbingan Usia Dini',
      philosophy: 'Belajar Islam untuk anak harus terasa seperti bermain di rumahnya sendiri — penuh kasih sayang dan tanpa paksaan.',
      bio: 'Spesialis pembelajaran santri usia dini (4-7 tahun) dengan pendekatan fun learning berbasis nilai-nilai Islam.',
      joinDate: new Date('2018-06-10'),
    },
    {
      fullName: 'Ustadz Ibrahim Musa, S.Pd.', gender: 'L', birthPlace: 'Depok', birthDate: new Date('1985-11-30'),
      address: 'Jl. Cempaka Putih No. 7, Jakarta Timur', phone: '081200000004',
      formalEducation: JSON.stringify([
        { level: 'S1', institution: 'Universitas Islam Negeri Jakarta', year: '2008', major: 'Pendidikan Bahasa Arab' },
      ]),
      nonFormalEducation: JSON.stringify([
        { program: 'Kaderisasi Ulama Muda', institution: 'DDI Jawa Barat', year: '2009' },
      ]),
      certifications: JSON.stringify([
        { name: 'Sertifikat Instruktur Fiqih Ibadah', issuer: 'BIMAS Islam Kemenag', year: '2019' },
      ]),
      expertise: 'Fiqih Ibadah, Praktik Sholat, Kaligrafi',
      philosophy: 'Ibadah yang diajarkan dengan praktik langsung akan membekas lebih lama daripada seribu teori.',
      bio: 'Guru praktik ibadah dan pelatih lomba kaligrafi. Membimbing santri kelas Al-Qur\'an dan materi latihan ibadah harian.',
      joinDate: new Date('2010-08-01'),
    },
  ]

  const teachers: Teacher[] = []
  for (let i = 0; i < guruUsers.length; i++) {
    const teacher = await db.teacher.create({ data: guruData[i] })
    teachers.push(teacher)
    await db.user.create({
      data: {
        email: guruUsers[i].email, name: guruUsers[i].name, phone: guruUsers[i].phone,
        password: hashPassword(guruUsers[i].password), role: 'GURU', teacherId: teacher.id,
      },
    })
  }

  // ===== CLASSES =====
  const classIqra1 = await db.class.create({ data: { name: 'Iqra 1', level: 'IQRA', schedule: 'Senin, Rabu — 15.30-17.00', room: 'Ruang Serambi', teacherId: teachers[2].id } })
  const classIqra4 = await db.class.create({ data: { name: 'Iqra 4', level: 'IQRA', schedule: 'Selasa, Kamis — 15.30-17.00', room: 'Ruang Serambi', teacherId: teachers[0].id } })
  const classTahfidz = await db.class.create({ data: { name: 'Tahfidz A', level: 'TAHFIDZ', schedule: 'Senin-Kamis — 16.00-18.00', room: 'Musholla Utama', teacherId: teachers[1].id } })
  const classQuran = await db.class.create({ data: { name: "Al-Qur'an A", level: 'AL_QURAN', schedule: 'Senin, Rabu, Jumat — 15.30-17.30', room: 'Ruang Utama', teacherId: teachers[3].id } })

  // ===== PARENTS =====
  const parents = [
    { email: 'budi.santoso@gmail.com', name: 'Budi Santoso', phone: '081300000001', password: 'ortu123' },
    { email: 'siti.aminah@gmail.com', name: 'Siti Aminah', phone: '081300000002', password: 'ortu123' },
    { email: 'joko.purnomo@gmail.com', name: 'Joko Purnomo', phone: '081300000003', password: 'ortu123' },
    { email: 'dewi.lestari@gmail.com', name: 'Dewi Lestari', phone: '081300000004', password: 'ortu123' },
    { email: 'ahmad.hidayat@gmail.com', name: 'Ahmad Hidayat', phone: '081300000005', password: 'ortu123' },
    { email: 'ratna.sari@gmail.com', name: 'Ratna Sari', phone: '081300000006', password: 'ortu123' },
  ]
  const parentUsers: User[] = []
  for (const p of parents) {
    parentUsers.push(await db.user.create({ data: { ...p, password: hashPassword(p.password), role: 'ORANG_TUA' } }))
  }

  // ===== STUDENTS =====
  const studentsData = [
    { nis: 'DJ-2024-001', fullName: 'Muhammad Rizky Ramadhan', gender: 'L', birthDate: new Date('2017-03-15'), address: 'Jl. Flamboyan 1 No. 3', classId: classIqra1.id, parentId: parentUsers[0].id },
    { nis: 'DJ-2024-002', fullName: 'Aisyah Putri Kirana', gender: 'P', birthDate: new Date('2016-08-22'), address: 'Jl. Flamboyan 2 No. 15', classId: classIqra4.id, parentId: parentUsers[1].id },
    { nis: 'DJ-2023-014', fullName: 'Ahmad Fathan Habibi', gender: 'L', birthDate: new Date('2013-05-10'), address: 'Jl. Cendana Raya No. 20', classId: classTahfidz.id, parentId: parentUsers[2].id },
    { nis: 'DJ-2024-003', fullName: 'Zahra Nur Aini', gender: 'P', birthDate: new Date('2017-11-02'), address: 'Jl. Anggrek Merah No. 8', classId: classIqra1.id, parentId: parentUsers[3].id },
    { nis: 'DJ-2022-009', fullName: 'Muhammad Alfatih Salim', gender: 'L', birthDate: new Date('2012-01-27'), address: 'Jl. Dahlia No. 33', classId: classTahfidz.id, parentId: parentUsers[4].id },
    { nis: 'DJ-2023-018', fullName: 'Khadija Ayu Safira', gender: 'P', birthDate: new Date('2014-09-09'), address: 'Jl. Teratai No. 11', classId: classQuran.id, parentId: parentUsers[5].id },
    { nis: 'DJ-2023-021', fullName: 'Alika Syakira', gender: 'P', birthDate: new Date('2014-04-17'), address: 'Jl. Mawar Indah No. 2', classId: classQuran.id, parentId: parentUsers[0].id },
    { nis: 'DJ-2024-005', fullName: 'Hamzah Abdurrahman', gender: 'L', birthDate: new Date('2016-12-05'), address: 'Jl. Kenari No. 6', classId: classIqra4.id, parentId: parentUsers[2].id },
  ]
  const students: Student[] = []
  for (const s of studentsData) {
    students.push(await db.student.create({ data: s }))
  }

  // ===== CURRICULUM =====
  const curriculum = [
    { level: 'Iqra 1-2', subject: 'TAJWID', description: 'Pengenalan huruf hijaiyah, harakat fathah-kasrah-dhommah, dan tanwin.', target: 'Santri mampu membaca Iqra jilid 1-2 dengan lancar.', classId: classIqra1.id, order: 1 },
    { level: 'Iqra 3-6', subject: 'TAJWID', description: 'Mad, sukun, tasydid, hukum nun sukun & mim sukun dasar.', target: 'Santri tamat Iqra dan siap beralih ke Al-Qur\'an.', classId: classIqra4.id, order: 2 },
    { level: "Al-Qur'an A", subject: 'TAJWID', description: 'Tilawah Al-Qur\'an dengan tartil, hukum tajwid lengkap, tahsin harfiah.', target: 'Santri membaca Al-Qur\'an sesuai kaidah tajwid.', classId: classQuran.id, order: 3 },
    { level: 'Tahfidz A', subject: 'HAFALAN', description: 'Setoran hafalan juz 30 (Juz \'Amma) dengan target 3-5 ayat/minggu, murajaah pekanan.', target: 'Khatam Juz 30 dengan sanad terverifikasi.', classId: classTahfidz.id, order: 4 },
    { level: 'Semua Kelas', subject: 'IBADAH', description: 'Praktik wudhu, sholat 5 waktu, doa harian, dan dzikir pagi-petang.', target: 'Santri mandiri beribadah dengan tertib.', classId: null, order: 5 },
    { level: 'Semua Kelas', subject: 'AKHLAK', description: 'Adab kepada orang tua, guru, dan teman; sopan santun sehari-hari.', target: 'Pembentukan karakter akhlakul karimah.', classId: null, order: 6 },
  ]
  for (const c of curriculum) await db.curriculum.create({ data: c })

  // ===== SESSIONS & ATTENDANCE (last 3 school days) =====
  const today = new Date()
  const sessionPlans = [
    { classId: classIqra1.id, daysAgo: 2, topic: 'Pengenalan Huruf Hijaiyah' },
    { classId: classIqra4.id, daysAgo: 2, topic: 'Hukum Mad Thabii' },
    { classId: classTahfidz.id, daysAgo: 1, topic: 'Setoran Juz 30: An-Naba' },
    { classId: classQuran.id, daysAgo: 1, topic: 'Tilawah QS Al-Baqarah' },
    { classId: classIqra1.id, daysAgo: 0, topic: 'Latihan Membaca Fathah' },
    { classId: classTahfidz.id, daysAgo: 0, topic: 'Setoran Juz 30: An-Nazi\'at' },
  ]
  const statusPool = ['HADIR', 'HADIR', 'HADIR', 'HADIR', 'IZIN', 'SAKIT', 'ALPA']
  const activeSessions: { session: { id: string; classId: string; code: string }; studentIds: string[] }[] = []
  for (const plan of sessionPlans) {
    const date = new Date(today)
    date.setDate(date.getDate() - plan.daysAgo)
    const code = `DJ-${plan.classId.slice(-4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const session = await db.session.create({ data: { classId: plan.classId, date, topic: plan.topic, code, isActive: plan.daysAgo === 0 } })
    const classStudents = students.filter((s) => s.classId === plan.classId)
    for (const s of classStudents) {
      const status = statusPool[Math.floor(Math.random() * statusPool.length)]
      await db.attendance.create({ data: { sessionId: session.id, studentId: s.id, status } })
    }
    if (plan.daysAgo === 0) activeSessions.push({ session: { id: session.id, classId: plan.classId, code }, studentIds: classStudents.map((s) => s.id) })
  }

  // ===== HAFALAN =====
  const hafalanData = [
    { studentIdx: 2, surahName: 'An-Naba', ayatRange: '1-20', type: 'TAHFIDZ', grade: 88, teacherNote: 'Bagus, perbaiki mad pada ayat 7.' },
    { studentIdx: 2, surahName: 'An-Naba', ayatRange: '21-40', type: 'TAHFIDZ', grade: 92, teacherNote: 'MasyaAllah, sangat lancar.' },
    { studentIdx: 4, surahName: 'An-Nazi\'at', ayatRange: '1-16', type: 'TAHFIDZ', grade: 85, teacherNote: 'Tahsin pelafalan huruf dad.' },
    { studentIdx: 4, surahName: 'Abasa', ayatRange: '1-16', type: 'TAHFIDZ', grade: 90, teacherNote: 'Murajaah rutin ya.' },
    { studentIdx: 2, surahName: 'An-Nazi\'at', ayatRange: '1-10', type: 'MURAJAAH', grade: 95, teacherNote: 'Konsisten, pertahankan.' },
    { studentIdx: 4, surahName: 'An-Naba', ayatRange: '1-40', type: 'MURAJAAH', grade: 89, teacherNote: 'Cukup baik.' },
    { studentIdx: 1, surahName: 'Al-Fatihah', ayatRange: '1-7', type: 'TAHSHIN', grade: 93, teacherNote: 'Tajwid sudah rapi.' },
    { studentIdx: 5, surahName: 'Al-Lail', ayatRange: '1-10', type: 'TAHFIDZ', grade: 87, teacherNote: 'Perhatikan qalqalah.' },
  ]
  for (const h of hafalanData) {
    const { studentIdx, ...rest } = h
    await db.hafalan.create({ data: { ...rest, studentId: students[studentIdx].id } })
  }

  // ===== MATERIALS =====
  const materials = [
    { title: 'Panduan Tajwid Dasar (Iqra 1-2)', type: 'PDF', url: 'https://example.com/materi/tajwid-dasar.pdf', category: 'TAJWID', classId: classIqra1.id, teacherId: teachers[2].id, description: 'Ringkasan materi huruf hijaiyah dan harakat beserta latihan.' },
    { title: 'Slide Hukum Mad (Iqra 4-6)', type: 'SLIDE', url: 'https://example.com/materi/hukum-mad.pptx', category: 'TAJWID', classId: classIqra4.id, teacherId: teachers[0].id, description: 'Presentasi macam-macam mad beserta contoh bacaan.' },
    { title: 'Video Tutorial Tilawah Al-Baqarah 1-20', type: 'VIDEO', url: 'https://example.com/materi/tilawah-baqarah.mp4', category: 'TAJWID', classId: classQuran.id, teacherId: teachers[3].id, description: 'Video bimbingan bacaan dengan penjelasan tajwid per ayat.' },
    { title: 'Audio Qiroah Juz 30 — An-Naba', type: 'AUDIO', url: 'https://example.com/materi/qiroah-naba.mp3', category: 'HAFALAN', classId: classTahfidz.id, teacherId: teachers[1].id, description: 'Contoh qiroah untuk pendampingan setoran di rumah.' },
    { title: 'Praktik Wudhu & Sholat — Panduan Ibu/Bapak', type: 'PDF', url: 'https://example.com/materi/praktik-ibadah.pdf', category: 'IBADAH', classId: null, teacherId: teachers[3].id, description: 'Panduan mendampingi anak berlatih ibadah di rumah.' },
  ]
  for (const m of materials) await db.material.create({ data: m })

  // ===== PAYMENTS =====
  const payments = [
    { studentIdx: 0, title: 'Iuran SPP Bulan Ini', amount: 75000, status: 'PENDING' },
    { studentIdx: 0, title: 'Iuran SPP Bulan Lalu', amount: 75000, status: 'SUCCESS', method: 'QRIS' },
    { studentIdx: 2, title: 'Iuran SPP Bulan Ini', amount: 100000, status: 'SUCCESS', method: 'GOPAY' },
    { studentIdx: 2, title: 'Dana Kegiatan Khataman', amount: 50000, status: 'PENDING' },
    { studentIdx: 1, title: 'Iuran SPP Bulan Ini', amount: 75000, status: 'SUCCESS', method: 'VA_BCA' },
    { studentIdx: 4, title: 'Iuran SPP Bulan Ini', amount: 100000, status: 'FAILED', method: 'GOPAY' },
    { studentIdx: 3, title: 'Iuran SPP Bulan Ini', amount: 75000, status: 'PENDING' },
    { studentIdx: 5, title: 'Uang Majelis Tamat', amount: 150000, status: 'SUCCESS', method: 'QRIS' },
  ]
  let invoiceSeq = 1000
  for (const p of payments) {
    const { studentIdx, ...rest } = p
    invoiceSeq++
    await db.payment.create({
      data: {
        ...rest,
        invoiceNo: `INV-2025-${invoiceSeq}`,
        studentId: students[studentIdx].id,
        paidAt: rest.status === 'SUCCESS' ? new Date(today.getTime() - Math.floor(Math.random() * 20 + 1) * 86400000) : null,
      },
    })
  }

  // ===== POSTS (Berita & Artikel) =====
  const posts = [
    {
      title: 'Khataman Al-Qur\'an Santri Tahfidz Batch 2025', slug: 'khataman-santri-tahfidz-2025', category: 'KEGIATAN',
      content: 'Alhamdulillah, pada hari Ahad lalu TPQ Darul Jinan menyelenggarakan hawaman (khataman) Al-Qur\'an bagi 7 santri Tahfidz yang telah menyelesaikan hafalan 30 juz. Acara berlangsung khidmat di aula TPQ, dihadiri seluruh wali santri, guru, dan tokoh masyarakat sekitar.\n\nKepala TPQ, H. Ahmad Fauzi, S.Pd.I, dalam sambutannya menekankan bahwa pencapaian santri tidak lepas dari peran orang tua yang mendampingi setoran harian di rumah. "Kolaborasi TPQ dan keluarga adalah kunci. Aplikasi digital kami membantu orang tua memantau progres hafalan anak setiap hari," ujarnya.\n\nAcara ditutup dengan penyerahan syahadah, hiburan islami anak, dan ramah tamah bersama.', authorId: teachers[1].id, coverImage: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800&q=80',
    },
    {
      title: 'Perlombaan Tilawah & Hafalan Antar Kelas', slug: 'perlombaan-tilawah-hafalan', category: 'KEGIATAN',
      content: 'Dalam rangka menyambut bulan penuh keberkahan, TPQ Darul Jinan menggelar lomba tilawah dan hafalan juz 30 antar kelas. Lomba diikuti 40+ santri dari 4 kelas dengan kategori: tilawah anak (Iqra), tahfidz juz 30, dan kaligrafi.\n\nPara pemenang akan mendapatkan hadiah pembelajaran (buku iqra, mushaf, dan perlengkapan belajar). Seluruh hasil penilaian dicatat dalam sistem digital dan bisa dipantau orang tua melalui portal wali santri.', authorId: teachers[3].id, coverImage: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?w=800&q=80',
    },
    {
      title: '5 Tips Membimbing Anak Setoran Hafalan di Rumah', slug: 'tips-bimbingan-hafalan-anak', category: 'ARTIKEL',
      content: '1. Tetapkan waktu istiqamah — pilih jam yang sama setiap hari, misalnya setelah subuh atau setelah maghrib.\n\n2. Ulangi bersama — dengarkan anak setoran, ulangi ayat yang keliru dengan lembut 3-5 kali.\n\n3. Gunakan audio qiroah — putar murottal dari ustadz pengampu agar makhraj anak terbentuk benar.\n\n4. Beri apresiasi — pujian kecil, stiker, atau "star" bisa sangat memotivasi anak.\n\n5. Pantau progres di Portal Wali — catatan guru dan nilai setoran tersedia real-time. Jika ada kendala, hubungi ustadz/ustadzah melalui grup WA kelas.\n\nSemoga Allah memudahkan kita mendidik generasi penghafal Al-Qur\'an.', authorId: teachers[1].id, coverImage: 'https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=800&q=80',
    },
    {
      title: 'Pendaftaran Santri Baru (PPDB) Gelombang II Dibuka', slug: 'ppdb-gelombang-2-dibuka', category: 'BERITA',
      content: 'TPQ Darul Jinan membuka Penerimaan Peserta Didik Baru (PPDB) Gelombang II untuk kelas Iqra, Al-Qur\'an, dan Tahfidz.\n\nPendaftaran sepenuhnya online melalui portal ini. Siapkan salinan KTP orang tua, Kartu Keluarga, dan akta kelahiran anak. Biaya pendaftaran Rp 50.000 dapat dibayar melalui QRIS/e-wallet setelah form diisi.\n\nKuota terbatas: 15 santri per kelas. Segera daftar!', authorId: null, coverImage: 'https://images.unsplash.com/photo-1584697964358-3e14ca57658b?w=800&q=80',
    },
  ]
  for (const p of posts) await db.post.create({ data: { ...p, published: true } })

  // ===== ANNOUNCEMENTS =====
  const announcements = [
    { title: 'Libur Idul Adha', content: 'Pembelajaran TPQ diliburkan pada 10-12 Dzulhijjah. Kegiatan rutin dilanjutkan kembali sesuai jadwal.', priority: 'PENTING' },
    { title: 'Rapat Wali Santri', content: 'Rapat wali santri semester ini dilaksanakan hari Sabtu pukul 09.00 di aula TPQ. Mohon kehadirannya.', priority: 'NORMAL' },
    { title: 'Pembayaran Iuran Bulan Ini', content: 'Batas pembayaran iuran tanggal 25. Bayar mudah via QRIS di Portal Wali.', priority: 'NORMAL' },
  ]
  for (const a of announcements) await db.announcement.create({ data: a })

  // ===== REGISTRATIONS (PPDB) =====
  const registrations = [
    { regNumber: 'PPDB-2025-0001', childName: 'Salman Alfarizi', gender: 'L', birthDate: new Date('2018-02-14'), parentName: 'Ridwan Hakim', phone: '081500000001', email: 'ridwan@gmail.com', address: 'Jl. Kebon Jeruk No. 5', documents: JSON.stringify(['KTP.pdf', 'KK.pdf', 'Akta.pdf']), status: 'PENDING' },
    { regNumber: 'PPDB-2025-0002', childName: 'Naura Hana Safitri', gender: 'P', birthDate: new Date('2018-06-30'), parentName: 'Hendra Setiawan', phone: '081500000002', email: 'hendra@gmail.com', address: 'Jl. Cibubur Raya No. 12', documents: JSON.stringify(['KTP.jpg', 'KK.jpg']), status: 'VERIFIKASI' },
    { regNumber: 'PPDB-2025-0003', childName: 'Fathir Naufal', gender: 'L', birthDate: new Date('2017-10-08'), parentName: 'Maya Sopiah', phone: '081500000003', email: 'maya@gmail.com', address: 'Jl. Pondok Bambu No. 21', documents: JSON.stringify(['KTP.pdf', 'KK.pdf', 'Ijazah.pdf']), status: 'DITERIMA' },
  ]
  for (const r of registrations) await db.registration.create({ data: r })

  // ===== NOTIFICATIONS (WhatsApp log) =====
  const notifications = [
    { userId: parentUsers[0].id, phone: '081300000001', message: 'Assalamu\'alaikum Bpk. Budi Santoso, putra Anda *Muhammad Rizky Ramadhan* HADIR di kelas Iqra 1 pada sesi hari ini. Terima kasih. — TPQ Darul Jinan' },
    { userId: parentUsers[2].id, phone: '081300000003', message: 'Assalamu\'alaikum Bpk. Joko Purnomo, Alhamdulillah *Ahmad Fathan Habibi* mendapat nilai 92 untuk setoran An-Naba 21-40. — TPQ Darul Jinan' },
    { userId: parentUsers[0].id, phone: '081300000001', message: 'Pengingat: Tagihan *Iuran SPP Bulan Ini* sebesar Rp 75.000 jatuh tempo tanggal 25. Bayar via Portal Wali. — TPQ Darul Jinan' },
    { userId: parentUsers[4].id, phone: '081300000005', message: 'Pembayaran tagihan INV-2025-1004 sebesar Rp 100.000 GAGAL (GOPAY). Silakan coba metode lain di Portal Wali. — TPQ Darul Jinan' },
  ]
  for (const n of notifications) await db.notification.create({ data: n })

  // counts
  const counts = {
    users: await db.user.count(), teachers: await db.teacher.count(), classes: await db.class.count(),
    students: await db.student.count(), sessions: await db.session.count(), attendance: await db.attendance.count(),
    hafalan: await db.hafalan.count(), materials: await db.material.count(), payments: await db.payment.count(),
    posts: await db.post.count(), notifications: await db.notification.count(),
  }
  console.log('Seed complete:', counts)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
