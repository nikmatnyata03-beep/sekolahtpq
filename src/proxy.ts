// Virtual WAF — pertahanan edge untuk SIMADJI (TPQ Darul Jinan).
// Berjalan di Cloudflare Workers edge SEBELUM route/aplikasi dieksekusi.
//
// Fungsi:
//  1. Blokir path khas scanner/penyerang (WordPress, PHP, .env, .git, dll)
//  2. Blokir User-Agent alat serangan otomatis (sqlmap, nikto, nuclei, dll)
//  3. Pasang security headers pada semua respons normal
//
// Catatan operasional:
//  - Blokir dilakukan dengan 403 polos (murah, tidak menyentuh runtime Next).
//  - Tidak memblokir crawler sah (Googlebot, Bingbot, dll) — hanya alat serang.
//  - Endpoint WebSocket (presence) dan API resmi tidak tersentuh aturan blokir.
//  - Pemantauan: `bunx wrangler tail` untuk melihat upaya serangan live.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Path yang hampir pasti adalah scanning otomatis — situs Next.js tidak punya file ini. */
const BLOCKED_PATH_PATTERNS: RegExp[] = [
  // WordPress & CMS scanner
  /\/wp-(admin|login|content|includes|config)/i,
  /\/wordpress(\/|$)/i,
  /\/xmlrpc\.php/i,
  /\/(joomla|drupal|magento|bitrix)(\/|$)/i,
  // File sensitif
  /\/\.(env|git|svn|hg|aws|ssh|npm|htaccess|htpasswd)(\.|$)/i,
  /\.DS_Store$/i,
  /\/(id_rsa|id_dsa|known_hosts|authorized_keys)$/i,
  /\/(backup|dump|database)\.(sql|sql\.gz|zip|tar|rar)$/i,
  /\/(wp-config|configuration|config|settings)\.php$/i,
  // Ekstensi PHP/legacy (situs ini bukan PHP)
  /\.php[45]?($|\?)/i,
  /\/(phpmyadmin|pma|adminer|mysql|sql)(\/|$)/i,
  // Java/.NET explorer
  /\/(actuator|jmx-console|manager\/html|\.aspx?|\.jsp|\.cgi)($|\/)/i,
  // Backdoor/scanner umum
  /\/(shell|wso|alfa|c99|r57|b374k|cmd|eval)(\.php)?$/i,
  /\/(cgi-bin|vendor\/phpunit|eval-stdin)($|\/)/i,
];

/** User-Agent milik tool serangan otomatis. */
const BLOCKED_UA_PATTERN =
  /(sqlmap|nikto|nmap|masscan|zgrab|acunetix|netsparker|dirbuster|dirb|gobuster|wfuzz|ffuf|feroxbuster|nuclei|wpscan|w3af|havij|hydra|metasploit|arachni|whatweb|openvas|qualys)/i;

/** Security headers dipasang di semua respons yang melewati proxy. */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "on",
};

function deny(): NextResponse {
  // 403 polos: biaya minimal, tidak membocorkan detail aplikasi.
  return new NextResponse("Forbidden", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1) Patroli method — blokir method eksotis (TRACE/CONNECT/PATCH…).
  //    GET/HEAD/POST/PUT/DELETE/OPTIONS dibolehkan: API admin memakai
  //    PUT (simpan pengaturan, gateway WA) dan DELETE (hapus komentar/user).
  //    Regresi 2026-09-13: PUT+DELETE sempat diblokir di sini sehingga
  //    editor landing & aksi hapus admin gagal 403 di produksi.
  const method = request.method.toUpperCase();
  const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"]);
  if (!ALLOWED_METHODS.has(method)) {
    return deny();
  }

  // 2) Patroli path scanner.
  if (BLOCKED_PATH_PATTERNS.some((re) => re.test(pathname))) {
    return deny();
  }

  // 3) Patroli User-Agent alat serangan.
  const ua = request.headers.get("user-agent") ?? "";
  if (BLOCKED_UA_PATTERN.test(ua)) {
    return deny();
  }

  // Lolos patroli → teruskan dengan security headers.
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  // Jalankan di semua route KECUALI aset statis internal Next.js.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
