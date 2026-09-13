import type { MetadataRoute } from 'next'

// Domain produksi (Cloudflare Workers). Perbarui bila memakai domain kustom.
// FIX(SEO): sebelumnya masih domain lama tpqdarussolah.nikmatnyata03.workers.dev —
// robots.txt sudah menunjuk domain baru, isi sitemap ikon backend lama.
const SITE = 'https://tpq.darussolah.workers.dev'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
