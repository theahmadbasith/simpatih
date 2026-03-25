/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SIMPATIH — js/api.js
   Layer komunikasi frontend → Vercel /api/proxy → Google Apps Script

   Alur:
     gasCall('namaFungsi', { params })
       → POST /api/proxy  { action, params }
       → Vercel proxy.js  (tambahkan GAS_URL + apiKey dari env)
       → GAS doPost()     → _dispatch(action, params)
       → JSON response    → dikembalikan ke caller

   File ini TIDAK menyimpan GAS_URL atau API key — itu ada di:
     - Vercel: Environment Variables (GAS_URL, API_SECRET_KEY)
     - GAS: Script Properties (API_SECRET_KEY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

'use strict';

/* ─── Konstanta ─────────────────────────────────────────────────── */
const _API_ENDPOINT   = '/api/proxy';
const _API_TIMEOUT_MS = 30_000;   /* 30 detik */
const _API_RETRIES    = 1;        /* 1x retry pada network error */

/* ─── Versi build (bantu debug) ─────────────────────────────────── */
const _API_VERSION = '3.1.0';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   gasCall(action, params?)
   Fungsi utama — dipanggil dari seluruh modul feature.
   Returns: Promise<{ success, data, message, ... }>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
async function gasCall(action, params = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= _API_RETRIES; attempt++) {
    try {
      const res = await _fetchWithTimeout(_API_ENDPOINT, {
        method : 'POST',
        headers: {
          'Content-Type'    : 'application/json',
          'X-Requested-With': 'SIMPATIH-v3',
        },
        body: JSON.stringify({ action, params }),
      }, _API_TIMEOUT_MS);

      /* HTTP error */
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`);
      }

      const data = await res.json();

      /* GAS mengembalikan error terstruktur */
      if (data && data.success === false && data.message) {
        console.warn(`[gasCall] ${action} →`, data.message);
      }

      return data;

    } catch (err) {
      lastErr = err;
      const isNetworkErr = (
        err.name === 'AbortError' ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError')
      );
      /* Hanya retry pada network error, bukan HTTP error */
      if (!isNetworkErr || attempt >= _API_RETRIES) break;
      console.warn(`[gasCall] Retry ${attempt + 1} untuk "${action}"...`);
      await _sleep(600);
    }
  }

  /* Semua attempt gagal */
  const msg = lastErr ? lastErr.message : 'Koneksi gagal';
  console.error(`[gasCall] GAGAL "${action}":`, msg);

  /* Tampilkan toast jika fungsi tersedia (ui.js sudah dimuat) */
  if (typeof toast === 'function') {
    toast(`Gagal menghubungi server: ${msg}`, 'er');
  }

  throw lastErr || new Error(msg);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Helper: fetch dengan timeout via AbortController
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function _fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Helper: sleep
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   gasUpload(action, formData)
   Untuk endpoint yang butuh multipart/form-data (upload file).
   Tidak pakai Content-Type header — browser set boundary otomatis.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
async function gasUpload(action, formData) {
  try {
    const res = await _fetchWithTimeout(_API_ENDPOINT + '?action=' + encodeURIComponent(action), {
      method : 'POST',
      headers: { 'X-Requested-With': 'SIMPATIH-v3' },
      body   : formData,
    }, _API_TIMEOUT_MS);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();

  } catch (err) {
    console.error('[gasUpload] GAGAL:', err.message);
    if (typeof toast === 'function') toast('Upload gagal: ' + err.message, 'er');
    throw err;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   apiHealthCheck()
   Tes koneksi ke proxy — bisa dipanggil dari console browser
   untuk troubleshooting: apiHealthCheck().then(console.log)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
async function apiHealthCheck() {
  try {
    const r = await gasCall('ping', {});
    console.info('[Health] OK →', r);
    return r;
  } catch (e) {
    console.error('[Health] GAGAL →', e.message);
    return { success: false, message: e.message };
  }
}

console.info(`[SIMPATIH] api.js v${_API_VERSION} siap. Endpoint: ${_API_ENDPOINT}`);
