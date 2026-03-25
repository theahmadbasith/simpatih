/* ═══════════════════════════════════════════════════════════════════
   SIMPATIH — api/proxy.js
   Vercel Serverless Function — Secure Proxy ke Google Apps Script
   ---------------------------------------------------------------
   File ini TIDAK pernah dikirim ke browser.
   Ia berjalan di server Vercel dan menyimpan credential secara aman.

   ── Cara kerja ──────────────────────────────────────────────────
   Browser (js/api.js)
       ↓  POST /api/proxy  { action, params }
   Vercel (api/proxy.js)        ← file ini
       ↓  POST GAS_URL  { action, params }  + header Authorization
   Google Apps Script (Code.gs)
       ↓  return  { success, data, message }
   Vercel
       ↓  forward response
   Browser

   ── Keamanan ────────────────────────────────────────────────────
   • GAS_URL tidak diekspos ke browser sama sekali
   • Setiap request diperiksa header X-Requested-With
   • CORS hanya mengizinkan origin yang sama (atau yang diset CORS_ORIGIN)
   • Request dengan body > 10 MB ditolak
   • Method selain POST ditolak

   ── Environment Variables (Vercel Project Settings) ─────────────
   GAS_URL          Wajib. URL deployment GAS Web App.
                    Contoh: https://script.google.com/macros/s/AKfy.../exec

   API_SECRET_KEY   Opsional tapi direkomendasikan.
                    Jika diset, dikirim ke GAS sebagai header
                    Authorization: Bearer <API_SECRET_KEY>
                    GAS bisa memvalidasi header ini untuk keamanan ekstra.

   CORS_ORIGIN      Opsional. Default: * (semua origin).
                    Set ke domain production:
                    https://simpatih-kepatihan.vercel.app

   ── Setup di Vercel ─────────────────────────────────────────────
   1. Buka Vercel Dashboard → Project → Settings → Environment Variables
   2. Tambah:
        Name: GAS_URL
        Value: https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
        Environment: Production, Preview, Development

        Name: API_SECRET_KEY
        Value: (generate string acak panjang, contoh pakai uuidv4)
        Environment: Production, Preview, Development

   3. Redeploy project setelah menambah env vars.

   ── Local Development ───────────────────────────────────────────
   Buat file .env.local di root project (JANGAN commit ke Git):
     GAS_URL=https://script.google.com/macros/s/.../exec
     API_SECRET_KEY=your-secret-key-here

   Jalankan: vercel dev
   ═══════════════════════════════════════════════════════════════════ */

/* ── Konfigurasi ─────────────────────────────────────────────────── */

/** Timeout untuk request dari proxy ke GAS (ms). */
const GAS_TIMEOUT_MS = 29_000; // Vercel function timeout default 30 detik

/** Ukuran maksimum body request dari browser (10 MB untuk base64 file). */
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Handler utama
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default async function handler(req, res) {
  /* ── CORS headers ── */
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin',  corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options',        'DENY');

  /* ── Preflight OPTIONS ── */
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  /* ── Hanya terima POST ── */
  if (req.method !== 'POST') {
    return _err(res, 405, 'Method tidak diizinkan. Gunakan POST.');
  }

  /* ── Validasi header X-Requested-With ── */
  if (req.headers['x-requested-with'] !== 'SIMPATIH-v3') {
    return _err(res, 403, 'Akses ditolak.');
  }

  /* ── Cek GAS_URL tersedia ── */
  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) {
    console.error('[proxy] GAS_URL tidak di-set di environment variables!');
    return _err(res, 503, 'Konfigurasi server belum lengkap. Hubungi administrator.');
  }

  /* ── Parse body ── */
  let body;
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  } catch (e) {
    return _err(res, 400, 'Format request tidak valid (bukan JSON).');
  }

  const { action, params = {} } = body;

  /* ── Validasi action ── */
  if (!action || typeof action !== 'string') {
    return _err(res, 400, 'Field "action" wajib diisi dan harus berupa string.');
  }

  /* ── Validasi ukuran body (cegah upload terlalu besar) ── */
  const rawBody = JSON.stringify(body);
  if (rawBody.length > MAX_BODY_BYTES) {
    return _err(res, 413,
      `Ukuran request terlalu besar (maks ${MAX_BODY_BYTES / 1024 / 1024} MB).`);
  }

  /* ── Forward ke GAS ── */
  try {
    const gasResult = await _callGAS(GAS_URL, action, params);
    return res.status(200).json(gasResult);
  } catch (e) {
    console.error('[proxy] Error saat memanggil GAS:', e.message);
    return _err(res, 502, 'Gagal menghubungi backend. ' + _sanitizeErrMsg(e.message));
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Internal helpers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Panggil Google Apps Script Web App.
 *
 * ⚠️  Catatan penting tentang GAS Web App & headers:
 *     GAS Web App yang di-deploy sebagai "Execute as: Me / Anyone can access"
 *     TIDAK bisa membaca custom HTTP request headers (seperti Authorization)
 *     dari e.parameter maupun e.postData.
 *
 *     Solusinya: kirim API_SECRET_KEY sebagai field `apiKey` di dalam
 *     body JSON. GAS akan membaca dari body.apiKey dan mencocokkan
 *     dengan Script Properties: API_SECRET_KEY.
 *
 *     Ini tetap aman karena:
 *     - apiKey tidak pernah diekspos ke browser
 *     - Hanya ada di server Vercel (env var) dan GAS (Script Property)
 *     - HTTPS mengenkripsi body request
 */
async function _callGAS(gasUrl, action, params) {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), GAS_TIMEOUT_MS);

  /* Siapkan body — sertakan apiKey jika tersedia di env */
  const requestBody = { action, params };
  const secretKey   = process.env.API_SECRET_KEY;
  if (secretKey) {
    requestBody.apiKey = secretKey;
  }

  let response;
  try {
    response = await fetch(gasUrl, {
      method  : 'POST',
      headers : {
        'Content-Type': 'application/json',
        'User-Agent'  : 'SIMPATIH-Proxy/3.0',
      },
      body    : JSON.stringify(requestBody),
      signal  : controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GAS HTTP ${response.status}: ${text.substring(0, 300)}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    console.error('[proxy] GAS response bukan JSON:', text.substring(0, 500));
    throw new Error('Response dari GAS bukan JSON yang valid.');
  }
}

/**
 * Kirim response error standar.
 */
function _err(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message,
    data   : null,
  });
}

/**
 * Hapus informasi sensitif dari pesan error sebelum dikirim ke browser.
 * Jangan ekspos URL internal, path, atau stack trace.
 */
function _sanitizeErrMsg(msg) {
  if (!msg) return '';
  /* Potong di 200 karakter, hapus URL GAS jika muncul */
  return String(msg)
    .replace(/https?:\/\/script\.google\.com[^\s]*/gi, '[GAS_URL]')
    .replace(/Bearer\s+\S+/gi, '[REDACTED]')
    .substring(0, 200);
}
