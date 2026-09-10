// Shared types — API contract for SIMADJI TPQ Darul Jinan
// All dates come as ISO strings from JSON APIs.

export type Role = 'ADMIN' | 'GURU' | 'ORANG_TUA'

export interface AuthUser {
  id: string
  email: string
  name: string
  phone: string | null
  role: Role
  teacherId: string | null
}

export interface Teacher {
  id: string
  fullName: string
  gender: string // 'L' | 'P'
  birthPlace: string
  birthDate: string
  address: string
  phone: string | null
  photoUrl: string | null
  formalEducation: string // JSON string [{level,institution,year,major?}]
  nonFormalEducation: string | null
  certifications: string | null
  expertise: string
  philosophy: string | null
  bio: string
  joinDate: string
  isActive: boolean
  classes?: { id: string; name: string }[]
  _count?: { materials: number; posts: number }
}

export interface ClassRoom {
  id: string
  name: string
  level: string // IQRA | TAHFIDZ | AL_QURAN | ...
  schedule: string
  room: string | null
  isActive: boolean
  teacherId: string | null
  teacher?: { id: string; fullName: string } | null
  studentCount?: number
  _count?: { sessions: number; materials: number; curricula: number }
}

export interface Student {
  id: string
  nis: string
  fullName: string
  gender: string
  birthDate: string
  address: string
  status: string // AKTIF | NONAKTIF | LULUS
  parentId: string | null
  classId: string | null
  hafalanTarget: string | null
  parent?: { id: string; name: string; phone: string | null; email: string } | null
  class?: { id: string; name: string; level: string; schedule: string } | null
  _count?: { hafalans: number; payments: number; attendances: number }
}

export interface Registration {
  id: string
  regNumber: string
  childName: string
  gender: string
  birthDate: string
  parentName: string
  phone: string
  email: string | null
  address: string
  documents: string // JSON string array
  note: string | null
  status: 'PENDING' | 'VERIFIKASI' | 'DITERIMA' | 'DITOLAK'
  reviewNote: string | null
  createdAt: string
}

export interface SessionItem {
  id: string
  classId: string
  className: string
  classLevel?: string
  date: string
  topic: string | null
  code: string
  isActive: boolean
  total: number
  hadir: number
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  studentId: string
  status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'
  note: string | null
  createdAt: string
  student: { id: string; fullName: string; nis: string }
  className?: string
}

export interface Hafalan {
  id: string
  studentId: string
  surahName: string
  ayatRange: string
  type: 'TAHFIDZ' | 'TAHSHIN' | 'MURAJAAH'
  grade: number | null
  teacherNote: string | null
  createdAt: string
  student?: { id: string; fullName: string; nis: string; className?: string }
}

export interface Material {
  id: string
  title: string
  type: 'PDF' | 'SLIDE' | 'VIDEO' | 'AUDIO'
  url: string
  description: string | null
  category: string // TAJWID | HAFALAN | IBADAH | AKHLAK
  classId: string | null
  class?: { id: string; name: string } | null
  teacherId: string
  teacher: { id: string; fullName: string }
  createdAt: string
}

export interface Payment {
  id: string
  invoiceNo: string
  studentId: string
  title: string
  amount: number
  method: string | null
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  paidAt: string | null
  createdAt: string
  student?: { id: string; fullName: string; nis: string; parent?: { id: string; name: string; phone: string | null } | null }
  studentName?: string
}

export interface Post {
  id: string
  title: string
  slug: string
  content: string
  category: 'BERITA' | 'ARTIKEL' | 'KEGIATAN'
  coverImage: string | null
  published: boolean
  authorId: string | null
  author?: { id: string; fullName: string } | null
  createdAt: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  priority: 'NORMAL' | 'PENTING'
  createdAt: string
}

export interface NotificationLog {
  id: string
  userId: string | null
  channel: string
  phone: string
  message: string
  status: string
  readAt: string | null
  createdAt: string
}

export interface AppUser {
  id: string
  email: string
  name: string
  phone: string | null
  role: Role
  teacherId?: string | null
  createdAt?: string
}

// ==== /api/stats ====
export interface DashboardStats {
  students: number
  teachers: number
  classes: number
  registrationsPending: number
  hafalanCount: number
  materialCount: number
  revenue: number
  outstanding: number
  pendingCount: number
  successCount: number
  attendanceToday: { HADIR: number; IZIN: number; SAKIT: number; ALPA: number }
  attendanceRate: number
  activeSessions: { id: string; code: string; className: string; topic: string | null; date: string }[]
  attendanceTrend: { date: string; hadir: number; total: number; rate: number }[]
  recentRegistrations: Registration[]
  recentNotifications: NotificationLog[]
  recentPayments: (Payment & { studentName?: string })[]
  recentHafalan: (Hafalan & { studentName?: string })[]
}

// ==== /api/portal/parent ====
export interface ParentPortalData {
  parent: { id: string; name: string; email: string; phone: string | null }
  students: {
    id: string
    nis: string
    fullName: string
    gender: string
    hafalanTarget: string | null
    className: string
    classSchedule: string
    teacherName: string
    attendanceSummary: { hadir: number; izin: number; sakit: number; alpa: number; total: number }
    attendances: { id: string; status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'; date: string; topic: string | null; className: string }[]
    hafalans: Hafalan[]
    payments: Payment[]
    billing: { outstanding: number; pendingCount: number }
  }[]
  notifications: NotificationLog[]
  announcements: Announcement[]
}

export interface CurriculumItem {
  id: string
  classId: string | null
  level: string
  subject: string
  description: string
  target: string
  order: number
}
