import type { MetadataRoute } from 'next'

// Domain produksi (Cloudflare Workers). Perbarui bila memakai domain kustom.
const SITE = 'https://tpqdarussolah.nikmatnyata03.workers.dev'

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
