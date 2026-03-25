/* ═══════════════════════════════════════════════════════════════════
   SIMPATIH — js/ui.js — UI Core Layer
   PERUBAHAN dari :
   - setNav()    : tambah 'bs' (Buat Surat) di bottom-nav map
   - doRefresh() : tambah 'bs' → loadBuatSurat
   - _currentPage: tetap sama
   Semua fungsi lain IDENTIK dengan versi sebelumnya.
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. GLOBAL STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

let SES          = null;
const PER        = 12;
let _CH          = {};
let _RC          = {}, _rcIdx = 0;
let _currentPage = 'db';
let _suratTab    = 'surat';

let _suratData = [], _suratPg = 1, _suratFQ = '', _suratFSts = '';
let _permData  = [], _permPg  = 1, _permFQ  = '', _permFSts  = '';
let _agData    = [], _agPg    = 1, _agFQ    = '', _agFBulan  = '';
let _arsipData = [], _arsipPg = 1, _arsipFQ = '', _arsipFKat = '';
let _kpData    = [], _kpPg    = 1, _kpFQ    = '', _kpFRT     = '';

let _hpsMode  = '', _hpsRi   = null;
let _apprMode = '', _apprRow = null;
/* Variabel peta — diakses juga oleh peta.js, doRefresh(), doLogout() */
let _petaMap  = null, _petaMarkers = [], _petaTileLayers = {}, _petaCurrentLayer = 'osm';
let _calYear  = 0,   _calMonth     = 0;

let _templateSurat   = {};
let _templateLaporan = {};
let _fileCache       = {};

let _suratMFiltTimer = null;
let _suratKFiltTimer = null;
let _permFiltTimer   = null;
let _kpFiltTimer     = null;
let _agFiltTimer     = null;
let _arsipFiltTimer  = null;

let _pgCb = null;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SHARED CONSTANTS — dipakai app.js, surat.js, peta.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const _BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'];

function _tglStr(d) {
  return d.getDate() + ' ' + _BULAN_ID[d.getMonth()] + ' ' + d.getFullYear();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. ROW-CACHE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function rcSet(r) { const k = 'rc' + (++_rcIdx); _RC[k] = r; return k; }
function rcGet(k) { return _RC[k] || null; }
function rcClear() { _RC = {}; _rcIdx = 0; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. PAGINATION TRAMPOLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function _pgGo(p) { if (typeof _pgCb === 'function') _pgCb(p); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. DOM & ESCAPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function G(id) { return document.getElementById(id); }

function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. LOADING OVERLAY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function showLoad(msg) {
  const el = G('lov-msg');
  if (el) el.textContent = (msg || 'Memuat...').toUpperCase();
  const lov = G('lov');
  if (lov) lov.classList.add('on');
}
function hideLoad() {
  const lov = G('lov');
  if (lov) lov.classList.remove('on');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   6. SKELETON LOADER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function showSkeleton() {
  const sk = G('page-skeleton'), ct = G('ct');
  if (sk) sk.style.display = 'block';
  if (ct) ct.style.display = 'none';
}
function hideSkeleton() {
  const sk = G('page-skeleton'), ct = G('ct');
  if (sk) sk.style.display = 'none';
  if (ct) ct.style.display = '';
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   7. PAGE TRANSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let _transitionBusy = false;

async function pageTransition(loadFn) {
  if (_transitionBusy) return;
  _transitionBusy = true;
  const overlay = G('page-transition');
  showSkeleton();
  rcClear();
  if (overlay) overlay.classList.add('active');
  await new Promise(r => requestAnimationFrame(r));
  if (overlay) overlay.classList.remove('active');
  try {
    await loadFn();
  } catch (e) {
    showErr(e.message);
  } finally {
    hideSkeleton();
    _transitionBusy = false;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   8. TOAST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const _TOAST_ICO = { ok: 'fa-circle-check', er: 'fa-circle-xmark', inf: 'fa-circle-info' };

function toast(msg, type = 'inf') {
  const tco = G('tco'); if (!tco) return;
  const ico = _TOAST_ICO[type] || _TOAST_ICO.inf;
  const el  = document.createElement('div');
  el.className = 'ti ' + type;
  el.innerHTML = `<i class="fas ${ico}" aria-hidden="true"></i><span>${esc(msg)}</span>`;
  tco.appendChild(el);
  setTimeout(() => {
    el.classList.add('tOut');
    setTimeout(() => el.remove(), 240);
  }, 3600);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   9. MODAL HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function om(id) {
  const el = G(id);
  if (el) { el.classList.add('on'); document.body.style.overflow = 'hidden'; }
}
function cm(id) {
  const el = G(id);
  if (el) el.classList.remove('on');
  if (!document.querySelector('.mov.on')) document.body.style.overflow = '';
}
function ensureModal(id, html) {
  let el = G(id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'mov'; el.id = id;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = html;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) cm(id); });
  } else {
    el.innerHTML = html;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   10. CHART HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function dChart(id) {
  if (_CH[id]) { _CH[id].destroy(); delete _CH[id]; }
}
function dAllCharts() { Object.keys(_CH).forEach(dChart); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   11. PRINT & UKURAN KERTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* Dimensi kertas dalam mm */
const _KERTAS_DIM = {
  a4    : { w: 210, h: 297 },
  f4    : { w: 210, h: 330 },
  legal : { w: 216, h: 356 },
  letter: { w: 216, h: 279 },
};
let _cetakKertas  = 'a4';
let _cetakOrient  = 'portrait';  /* portrait | landscape */

function ubahUkuranKertas(ukuran) {
  _cetakKertas = ukuran || 'a4';
  _applyPageCss(G('surat-frame'));
}
function ubahOrientasi(orient) {
  _cetakOrient = orient || 'portrait';
  _applyPageCss(G('surat-frame'));
}

function _getPageCss() {
  const dim = _KERTAS_DIM[_cetakKertas] || _KERTAS_DIM.a4;
  const w   = _cetakOrient === 'landscape' ? Math.max(dim.w,dim.h) : Math.min(dim.w,dim.h);
  const h   = _cetakOrient === 'landscape' ? Math.min(dim.w,dim.h) : Math.max(dim.w,dim.h);
  return {
    css : `@page{size:${w}mm ${h}mm;margin:1.5cm 2cm}` +
          `body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
          /* Mobile: pastikan tidak ada overflow */
          `*{box-sizing:border-box}` +
          `.hal{padding:0!important;max-width:100%!important}`,
    w, h
  };
}

function _applyPageCss(iframe) {
  if (!iframe || !iframe.contentDocument) return;
  const {css,w,h} = _getPageCss();
  let el = iframe.contentDocument.getElementById('_page_size_style');
  if (!el) {
    el = iframe.contentDocument.createElement('style');
    el.id = '_page_size_style';
    (iframe.contentDocument.head || iframe.contentDocument.documentElement).appendChild(el);
  }
  el.textContent = css;
  iframe.style.minHeight = Math.round(h * 3.78) + 'px';
}

function _injectPageCssAfterLoad(iframe) {
  if (!iframe) return;
  iframe.onload = function() { _applyPageCss(iframe); };
}

function doPrint(fid) {
  const fr = G(fid);
  if (!fr || !fr.contentWindow) { toast('Preview belum siap.', 'inf'); return; }
  _applyPageCss(fr);
  fr.contentWindow.focus();
  fr.contentWindow.print();
}

let _cetakZoomPct = 100;
function cetakZoom(delta) {
  if (delta === 0) {
    _cetakZoomPct = 100;
  } else {
    _cetakZoomPct = Math.max(40, Math.min(250, _cetakZoomPct + delta));
  }
  const fr = G('surat-frame');
  if (fr) {
    /* Scale HANYA tampilan visual — konten tidak berubah, hanya zoom view */
    const s = _cetakZoomPct / 100;
    fr.style.transform       = `scale(${s})`;
    fr.style.transformOrigin = 'top center';
    /* Kompensasi tinggi agar wrapper tidak collapse */
    const baseH = fr.style.minHeight || '520px';
    const baseHNum = parseInt(baseH) || 520;
    if (fr.parentElement) {
      fr.parentElement.style.height   = (baseHNum * s) + 'px';
      fr.parentElement.style.overflow = 'hidden';
    }
    /* Lebar: biarkan 100% — transform scale sudah cukup */
    fr.style.width = '100%';
  }
  const lbl = G('cetak-zoom-lbl');
  if (lbl) lbl.textContent = _cetakZoomPct + '%';
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   12. DIGITAL CLOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
(function startClock() {
  function tick() {
    const el = G('tb-clock'); if (!el) return;
    el.textContent = new Date().toLocaleString('id-ID', {
      weekday:'short', day:'2-digit', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit', second:'2-digit',
    });
  }
  tick(); setInterval(tick, 1000);
})();

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   13. KEYBOARD SHORTCUTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.mov.on').forEach(m => m.classList.remove('on'));
    if (!document.querySelector('.mov.on')) document.body.style.overflow = '';
  }
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   14. SWIPE GESTURE SIDEBAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
(function initSwipe() {
  let sx = 0, sy = 0;
  document.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dy) > Math.abs(dx) * 1.2 || Math.abs(dx) < 40) return;
    const sb = G('sidebar'); if (!sb) return;
    if (dx > 0 && !sb.classList.contains('on') && sx < 50) sbToggle();
    else if (dx < 0 && sb.classList.contains('on')) sbClose();
  }, { passive: true });
})();

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   15. REFRESH
   ★ Tambah 'bs' → loadBuatSurat
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function doRefresh() {
  const btn = G('refresh-btn');
  if (btn) { btn.classList.add('spinning'); setTimeout(() => btn.classList.remove('spinning'), 800); }

  const map = {
    db  : loadDashboard,
    bs  : loadBuatSurat,
    sm  : loadSuratMasuk,
    sk  : loadSuratKeluar,
    kp  : loadKependudukan,
    ag  : loadAgenda,
    stat: loadStatistik,
    ar  : loadArsip,
    lap : loadLaporan,
    set : loadPengaturan,
    peta: loadPeta,
  };

  if (_currentPage === 'peta') {
    /* _lfMap ada di peta.js (scope global), _petaMap alias lama tidak dipakai */
    if (typeof refreshLeaflet === 'function') refreshLeaflet();
    else if (typeof _lfMap !== 'undefined' && _lfMap) _lfMap.invalidateSize();
  } else if (map[_currentPage]) {
    map[_currentPage]();
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   16. SIDEBAR & NAVIGASI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function sbToggle() {
  const sb = G('sidebar'), mbb = G('mbb'), ov = G('sb-overlay');
  const isOpen = sb && sb.classList.toggle('on');
  if (mbb) { mbb.classList.toggle('open', isOpen); mbb.setAttribute('aria-expanded', isOpen ? 'true' : 'false'); }
  if (ov) ov.classList.toggle('on', isOpen);
}
function sbClose() {
  const sb = G('sidebar'), mbb = G('mbb'), ov = G('sb-overlay');
  if (sb)  sb.classList.remove('on');
  if (mbb) { mbb.classList.remove('open'); mbb.setAttribute('aria-expanded', 'false'); }
  if (ov)  ov.classList.remove('on');
}

/**
 * Set menu aktif di sidebar dan bottom-nav.
 * ★ Tambah 'bs' (Buat Surat) ke bottom-nav map.
 * @param {string} id  Sufiks ID menu
 */
function setNav(id) {
  _currentPage = id;

  /* Sidebar */
  document.querySelectorAll('.nb').forEach(b => { b.classList.remove('on'); b.removeAttribute('aria-current'); });
  const nb = G('nav-' + id);
  if (nb) { nb.classList.add('on'); nb.setAttribute('aria-current', 'page'); }

  /* ★ Bottom-nav — termasuk 'bs' */
  document.querySelectorAll('.bni').forEach(b => { b.classList.remove('on'); b.removeAttribute('aria-current'); });
  const bn = G('bni-' + id);
  if (bn) { bn.classList.add('on'); bn.setAttribute('aria-current', 'page'); }
}

function setPage(title, sub) {
  const tl = G('pgtl'), sb = G('pgsb');
  if (tl) tl.textContent = title;
  if (sb) sb.textContent = sub || '';
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   17. AUTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function toggleEye() {
  const ip = G('l-pass'), ic = G('eye-ico'); if (!ip) return;
  if (ip.type === 'password') { ip.type = 'text'; if (ic) ic.className = 'fas fa-eye-slash'; }
  else                        { ip.type = 'password'; if (ic) ic.className = 'fas fa-eye'; }
}
function showLErr(msg) { const box = G('lerr'), txt = G('lerrmsg'); if (txt) txt.textContent = msg; if (box) box.classList.add('on'); }
function hideLErr() { const box = G('lerr'); if (box) box.classList.remove('on'); }

async function doLogin() {
  const u = (G('l-user') || {}).value?.trim() || '';
  const p = (G('l-pass') || {}).value || '';
  hideLErr();
  if (!u || !p) { showLErr('Username & password wajib diisi.'); return; }
  const btn = G('l-btn');
  if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Memeriksa...</span>'; btn.disabled = true; }
  try {
    const res = await gasCall('checkLogin', { username: u, password: p });
    if (res.success) {
      let role = res.role;
      if (role === 'lurah' || role === 'admin') role = 'admin'; else role = 'user';
      SES = { username: res.username, role, roleOrig: res.role, namaLengkap: res.namaLengkap, jabatan: res.jabatan };
      try { sessionStorage.setItem('_simpatih_ses', JSON.stringify(SES)); } catch (_) {}
      buildUI();
      G('lp').style.display = 'none';
      G('app').classList.add('on');
      loadDashboard();
      window._prefetchAll(); /* ← di sini, setelah loadDashboard() */
    } else {
      showLErr(res.message || 'Username atau password salah.');
    }
  } catch (e) {
    showLErr('Gagal terhubung ke server. ' + (e.message || ''));
  } finally {
    if (btn) { btn.innerHTML = '<i class="fas fa-right-to-bracket"></i><span>Masuk ke Sistem</span>'; btn.disabled = false; }
  }
}

function doLogout() {
  if (!confirm('Yakin ingin keluar dari sistem?')) return;
  window._gcClear(); /* ← di sini, sebelum reset semua */
  try { sessionStorage.removeItem('_simpatih_ses'); } catch (_) {}
  SES = null;
  dAllCharts(); rcClear();
  if (typeof _destroyLeaflet === 'function') _destroyLeaflet();
  _petaMap = null; _petaTileLayers = {}; _petaCurrentLayer = 'osm';
  G('app').classList.remove('on');
  G('lp').style.display = '';
  const lpass = G('l-pass'); if (lpass) lpass.value = '';
  sbClose(); hideLErr();
  toast('Anda telah keluar dari sistem.', 'inf');
}

function isAdmin() { return !!(SES && SES.role === 'admin'); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   18. BUILD UI
   ★ Tidak ada lagi sb-userinfo — dihapus sesuai index.html baru
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function buildUI() {
  if (!SES) return;
  const nama = SES.namaLengkap || SES.username || '?';
  const ini  = nama.charAt(0).toUpperCase();

  /* Topbar */
  const avEl = G('tb-av-sm'); if (avEl) avEl.textContent = ini;
  const unEl = G('tb-un');    if (unEl) unEl.textContent = nama;
  const badge = G('tb-badge');
  if (badge) {
    badge.textContent = SES.role === 'admin' ? 'Admin' : 'User';
    badge.className   = 'topbar-badge ' + (SES.role === 'admin' ? 'admin' : 'user');
  }
  const tbUser = G('tb-user'); if (tbUser) tbUser.style.display = '';

  /*
   * ★ sb-userinfo TIDAK di-render lagi.
   * Sidebar tidak punya card akun (sudah dihapus dari index.html).
   * Hanya topbar yang punya info user.
   */

  /* Sembunyikan menu Pengaturan untuk non-admin */
  if (SES.role !== 'admin') {
    ['nav-set', 'nav-set-section'].forEach(id => {
      const e = G(id); if (e) e.style.display = 'none';
    });
  }

  /* Tampilkan badge permohonan untuk admin */
  if (isAdmin()) {
    const bd = G('badge-perm'); if (bd) bd.style.display = '';
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   19. FILE PREVIEW (dipindah ke app.js agar konsisten)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* previewFile, handleFileSelect, handleFileDrop → ada di app.js */

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   20. RENDER HELPERS — STATUS CHIP & STAT CARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const _STS_MAP = {
  'Menunggu Approval': '<span class="sts-chip sts-menunggu"><i class="fas fa-clock"></i>Menunggu</span>',
  'Diproses'         : '<span class="sts-chip sts-diproses"><i class="fas fa-spinner"></i>Diproses</span>',
  'Disetujui'        : '<span class="sts-chip sts-disetujui"><i class="fas fa-check"></i>Disetujui</span>',
  'Ditolak'          : '<span class="sts-chip sts-ditolak"><i class="fas fa-times"></i>Ditolak</span>',
  'Selesai'          : '<span class="sts-chip sts-selesai"><i class="fas fa-flag-checkered"></i>Selesai</span>',
  'Aktif'            : '<span class="sts-chip sts-aktif"><i class="fas fa-circle-check"></i>Aktif</span>',
  'Batal'            : '<span class="sts-chip sts-batal"><i class="fas fa-ban"></i>Batal</span>',
};

function stsSuratChip(sts) {
  return _STS_MAP[sts] || `<span class="chip ch-grey">${esc(sts)}</span>`;
}

function scCard(cls, ico, n, lbl) {
  return `<div class="scard ${cls}">
    <div class="sico"><i class="fas ${ico}"></i></div>
    <div class="snum">${n}</div>
    <div class="slbl">${lbl}</div>
  </div>`;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   21. PAGINATION HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function pgInfo(start, total, per) {
  if (!total) return '0 data';
  return `${start + 1}–${Math.min(start + per, total)} dari ${total}`;
}

function pgBtns(cur, pages, cb) {
  if (pages <= 1) return '';
  _pgCb = cb;
  let html = `<button class="pgb"${cur <= 1 ? ' disabled' : ''} onclick="_pgGo(${cur - 1})"><i class="fas fa-chevron-left fa-xs"></i></button>`;
  const range = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= cur - 1 && i <= cur + 1)) range.push(i);
    else if (range[range.length - 1] !== '...') range.push('...');
  }
  range.forEach(p => {
    if (p === '...') html += `<span class="pgb" style="pointer-events:none;opacity:.4">…</span>`;
    else html += `<button class="pgb${p === cur ? ' on' : ''}" onclick="_pgGo(${p})">${p}</button>`;
  });
  html += `<button class="pgb"${cur >= pages ? ' disabled' : ''} onclick="_pgGo(${cur + 1})"><i class="fas fa-chevron-right fa-xs"></i></button>`;
  return html;
}

function buildStsOpts(current, list) {
  return `<option value="">Semua Status</option>` +
    list.map(s => `<option value="${esc(s)}"${s === current ? ' selected' : ''}>${esc(s)}</option>`).join('');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   22. ERROR PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function showErr(msg) {
  const ct = G('ct'); if (!ct) return;
  ct.innerHTML =
    `<div class="fu"><div class="empty" style="padding:56px 20px">
    <i class="fas fa-triangle-exclamation" style="font-size:2.2rem;color:var(--red2);opacity:.7"></i>
    <p style="color:var(--red2);font-weight:700;margin-top:10px;font-size:.82rem">Gagal memuat data</p>
    <p style="font-size:.7rem;color:var(--muted);margin-top:4px;max-width:320px;line-height:1.6">${esc(msg || 'Terjadi kesalahan. Silakan coba lagi.')}</p>
    <button class="bp" onclick="doRefresh()" style="margin-top:18px"><i class="fas fa-rotate-left"></i> Coba Lagi</button>
    </div></div>`;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   23. INIT — RESTORE SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
document.addEventListener('DOMContentLoaded', function initApp() {
  /* Load template dari localStorage */
  try {
    const ts = localStorage.getItem('_tpl_surat');
    const tl = localStorage.getItem('_tpl_laporan');
    if (ts) _templateSurat   = JSON.parse(ts);
    if (tl) _templateLaporan = JSON.parse(tl);
  } catch (_) {}

  /* Init kalender ke bulan sekarang */
  const _now = new Date();
  _calYear   = _now.getFullYear();
  _calMonth  = _now.getMonth();

  /* Restore session */
  try {
    const raw = sessionStorage.getItem('_simpatih_ses');
    if (raw) {
      SES = JSON.parse(raw);
      buildUI();
      G('lp').style.display = 'none';
      G('app').classList.add('on');
      loadDashboard();
      window._prefetchAll(); /* ← tambahkan di sini juga */
      return;
    }
  } catch (_) { SES = null; }

  /* Tampilkan login */
  const lpEl = G('lp'); if (lpEl) lpEl.style.display = '';
  const userEl = G('l-user'); if (userEl) userEl.focus();
});
