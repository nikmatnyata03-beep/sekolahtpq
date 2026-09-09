'use client'

// FAQ portal publik — pertanyaan yang sering diajukan seputar pendaftaran,
// biaya, jadwal, dan layanan Portal Wali. Menggunakan Accordion shadcn/ui.

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { CircleHelp, MessageCircle, Phone } from 'lucide-react'

const FAQ_ITEMS = [
  {
    q: 'Berapa iuran (SPP) per bulan, dan apakah ada uang pangkal?',
    a: "Iuran bulanan (SPP) Rp 75.000 – Rp 100.000 tergantung program yang diikuti (Iqra, Al-Qur'an, atau Tahfidz). Tidak ada uang pangkal — pendaftaran PPDB gratis; santri hanya menyiapkan seragam serta kitab/Al-Qur'an masing-masing.",
  },
  {
    q: 'Kapan jadwal belajar TPQ?',
    a: 'Kegiatan belajar berlangsung Senin sampai Sabtu pukul 15.00 – 18.00 WIB sesuai jadwal kelas masing-masing (Ahad libur). Rincian jadwal per kelas dapat dilihat pada bagian Kurikulum di halaman ini.',
  },
  {
    q: 'Usia berapa anak bisa mendaftar?',
    a: 'Pendaftaran dibuka untuk anak usia 4 – 15 tahun. Anak usia 4 – 6 tahun akan ditempatkan pada kelas Iqra pemula dengan metode bermain sambil belajar agar tetap nyaman.',
  },
  {
    q: 'Program apa saja yang tersedia?',
    a: "Tersedia tiga program utama: Iqra (tahap awal membaca), Al-Qur'an (tahsin/perbaikan bacaan), dan Tahfidz (hafalan Al-Qur'an dengan target juz). Penempatan program mengikuti hasil tes penempatan saat verifikasi.",
  },
  {
    q: 'Bagaimana cara mendaftar?',
    a: 'Isi formulir PPDB online pada bagian PPDB di halaman ini, lalu catat nomor registrasi yang muncul. Selanjutnya bawa dokumen (akta kelahiran, kartu keluarga, dan pas foto) saat verifikasi di sekretariat TPQ.',
  },
  {
    q: 'Bagaimana cara membayar tagihan/SPP?',
    a: 'Pembayaran dilakukan melalui Portal Wali: pilih tagihan lalu bayar via QRIS, GoPay, atau Virtual Account. Setelah transaksi berhasil, konfirmasi pembayaran dikirim otomatis melalui WhatsApp.',
  },
  {
    q: 'Apakah orang tua mendapat laporan perkembangan anak?',
    a: 'Ya. Melalui Portal Wali, orang tua dapat memantau kehadiran (absensi), progres hafalan beserta nilai dan catatan ustadz/ustadzah, serta tagihan bulanan. Rapor perkembangan juga dibagikan setiap akhir semester.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Kolom intro — sticky di desktop */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-24">
              <span className="mb-3 inline-block rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
                FAQ
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-stone-800">
                Pertanyaan yang Sering Diajukan
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Ringkasan jawaban seputar pendaftaran, biaya, jadwal belajar, dan layanan Portal
                Wali. Klik pertanyaan untuk melihat jawabannya.
              </p>

              {/* Kartu kontak */}
              <div className="relative mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 text-white shadow-md">
                <h3 className="text-sm font-bold uppercase tracking-widest text-amber-300">
                  Masih ada pertanyaan?
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-emerald-50/90">
                  Sekretariat siap membantu Senin – Sabtu, pukul 08.00 – 17.00 WIB.
                </p>
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
                  <a
                    href="tel:081234567890"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <Phone className="size-4" aria-hidden="true" />
                    0812-3456-7890
                  </a>
                  <a
                    href="https://wa.me/6281234567890"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm transition-colors hover:bg-amber-400"
                  >
                    <MessageCircle className="size-4" aria-hidden="true" />
                    Chat WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom accordion */}
          <div className="lg:col-span-3">
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem
                  key={item.q}
                  value={`faq-${i}`}
                  className="mb-3 rounded-xl border border-stone-200 bg-white px-5 shadow-sm last:mb-0"
                >
                  <AccordionTrigger className="gap-3 py-4 text-left text-sm font-semibold text-stone-800 hover:no-underline sm:text-base">
                    <span className="flex items-start gap-3">
                      <CircleHelp className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      {item.q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pl-7 text-sm leading-relaxed text-stone-600">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  )
}
