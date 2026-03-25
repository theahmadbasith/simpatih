/* ═══════════════════════════════════════════════════════════════════
   SIMPATIH — js/surat.js
   Modul Persuratan
   ───────────────────────────────────────────────────────────────────
   Tanggung jawab:
     • Surat Masuk  (load, render, filter live, tab)
     • Surat Keluar (load, render, filter live)
     • Modal Surat Masuk/Keluar + submit
     • Modal Permohonan + submit
     • Approval (surat & permohonan)
     • Template Kop Surat & Laporan
     • Cetak surat & laporan rekap

   Dependensi: ui.js, api.js
   Load order di index.html:
     api.js → ui.js → surat.js → penduduk.js → peta.js → app.js
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. SURAT MASUK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function loadSuratMasuk() {
  setNav('sm');
  setPage('Surat Masuk', 'Manajemen surat masuk & permohonan warga');
  sbClose(); dAllCharts();

  /* ── Cek cache ── */
  const cached = window._gcGet('suratMasuk');
  if (cached) {
    _suratData = cached.suratRes.data || [];
    _permData  = cached.permRes.data  || [];
    _suratPg   = 1;  _permPg   = 1;
    _suratFQ   = ''; _suratFSts = '';
    _permFQ    = ''; _permFSts  = '';
    _renderSuratMasukPage();
    window._gcRefresh('suratMasuk'); /* update diam-diam di background */
    return;
  }

  /* ── Tidak ada cache → fetch normal ── */
  _suratData = []; _permData  = [];
  _suratPg   = 1;  _permPg    = 1;
  _suratFQ   = ''; _suratFSts = '';
  _permFQ    = ''; _permFSts  = '';
  await pageTransition(async () => {
    showLoad();
    try {
      const [rs, rp] = await Promise.all([
        gasCall('getAllSurat',      { tipe: 'masuk' }),
        gasCall('getAllPermohonan', {}),
      ]);
      hideLoad();
      _suratData = rs.data || [];
      _permData  = rp.data || [];
      /* Simpan ke cache untuk kunjungan berikutnya */
      window._gcSet('suratMasuk', { suratRes: rs, permRes: rp });
      _renderSuratMasukPage();
    } catch (e) { hideLoad(); throw e; }
  });
}

function _renderSuratMasukPage() {
  const tab          = _suratTab || 'surat';
  const permMenunggu = _permData.filter(r => r.status === 'Menunggu Approval').length;

  G('ct').innerHTML = `<div class="fu"><div class="panel">
    <div class="tab-bar">
      <button class="tab-btn${tab==='surat'?' on':''}" id="tab-surat"
        onclick="switchSuratTab('surat')">
        <i class="fas fa-envelope-open-text"></i>Surat Masuk
      </button>
      <button class="tab-btn${tab==='permohonan'?' on':''}" id="tab-perm"
        onclick="switchSuratTab('permohonan')">
        <i class="fas fa-file-circle-plus"></i>Permohonan Warga
        ${permMenunggu?`<span class="nb-badge" style="position:static;margin-left:5px">${permMenunggu}</span>`:''}
      </button>
    </div>
    <div id="tab-content"></div>
  </div></div>`;

  if (tab === 'surat') _renderTabSurat(); else _renderTabPerm();
}

function switchSuratTab(t) {
  _suratTab = t;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  const el = G('tab-' + t); if (el) el.classList.add('on');
  if (t === 'surat') _renderTabSurat(); else _renderTabPerm();
}

function _renderTabSurat() {
  const flt   = _filterData(_suratData, _suratFQ, _suratFSts, ['perihal','pengirim','nomorSurat','catatan','tembusan','jenis']);
  const tot   = flt.length;
  const pages = Math.max(1, Math.ceil(tot / PER));
  _suratPg    = Math.min(_suratPg, pages);
  const st    = (_suratPg - 1) * PER;
  const sl    = flt.slice(st, st + PER);

  let rows = '', cards = '';
  if (!sl.length) {
    const msg = _suratFQ ? `Tidak ada hasil untuk "${esc(_suratFQ)}"` : 'Tidak ada surat masuk';
    rows  = `<tr><td colspan="10"><div class="empty"><i class="fas fa-envelope"></i><p>${msg}</p></div></td></tr>`;
    cards = `<div class="empty"><i class="fas fa-envelope"></i><p>${msg}</p></div>`;
  } else {
    sl.forEach(r => {
      const ck      = rcSet(r);
      const _sFid  = r.fileUrl?(/\/file\/d\/([^/?#]+)/.exec(r.fileUrl)||[])[1]||'':'';
      const dokBtn  = r.fileUrl ? `<button class="bgreen" title="Preview" onclick="previewFile('${esc(r.fileUrl)}','${esc(r.nomorSurat||r.perihal||'Surat')}')"><i class="fas fa-file-alt"></i> Preview</button> ` : '';
      const _dlBtn  = _sFid ? `<a href="https://drive.google.com/uc?export=download&id=${_sFid}" class="be" title="Download" download><i class="fas fa-download"></i></a> ` : '';
      const drvBtn  = r.fileUrl ? `<a href="${esc(r.fileUrl)}" target="_blank" rel="noopener" class="be" style="text-decoration:none"><i class="fas fa-external-link-alt"></i></a> ` : '';
      let aksi = dokBtn + _dlBtn + `<button class="be" onclick="openModalSurat(rcGet('${ck}'),'masuk')"><i class="fas fa-info-circle"></i></button>`;
      if (isAdmin()) aksi +=
        ` <button class="bgold" onclick="openApproval('surat',rcGet('${ck}'),'keluar')"><i class="fas fa-gavel"></i></button>` +
        ` <button class="bd" onclick="konfirmHapus('surat',rcGet('${ck}')._ri,'masuk')"><i class="fas fa-trash"></i></button>`;
      rows += `<tr>
        <td style="font-size:.58rem;font-family:var(--mono);white-space:nowrap">${esc(r.nomorSurat||'—')}</td>
        <td style="font-size:.62rem;white-space:nowrap">${_fmtTgl(r.tglSurat)}</td>
        <td style="font-size:.62rem;color:var(--muted)">${esc(r.jenis||'—')}</td>
        <td style="font-size:.64rem;font-weight:600">${esc(r.pengirim)}</td>
        <td style="font-size:.63rem;max-width:160px"><span class="truncate">${esc(r.perihal)}</span></td>
        <td style="font-size:.62rem;color:var(--mid);max-width:120px"><span class="truncate">${esc(r.tembusan||'—')}</span></td>
        <td style="font-size:.62rem;color:var(--mid);max-width:100px"><span class="truncate">${esc(r.catatan||'—')}</span></td>
        <td>${stsSuratChip(r.status)}</td>
        <td style="font-size:.6rem;white-space:nowrap">${_fmtTgl(r.tglApproval)}</td>
        <td style="white-space:nowrap">${aksi}</td>
      </tr>`;
      cards += `<div class="mcard-item">
        <div class="mcard-row"><span class="mcard-title">${esc(r.perihal)}</span>${stsSuratChip(r.status)}</div>
        <div class="mcard-meta">
          <i class="fas fa-hashtag" style="width:12px;color:var(--teal)"></i>${esc(r.nomorSurat||'—')}<br>
          <i class="fas fa-user" style="width:12px;color:var(--muted)"></i>${esc(r.pengirim)} · ${_fmtTgl(r.tglSurat)}
          ${r.jenis?`<br><i class="fas fa-tag" style="width:12px;color:var(--muted)"></i>${esc(r.jenis)}`:''}
          ${r.tembusan?`<br><i class="fas fa-forward" style="width:12px;color:var(--muted)"></i>${esc(r.tembusan)}`:''}
          ${r.catatan?`<br><i class="fas fa-sticky-note" style="width:12px;color:var(--muted)"></i>${esc(r.catatan)}`:''}
        </div>
        <div class="mcard-acts">${dokBtn}${drvBtn}${aksi}</div>
      </div>`;
    });
  }

  const addBtn  = isAdmin() ? `<button class="bp" onclick="openModalSurat(null,'masuk')"><i class="fas fa-plus"></i> Tambah</button>` : '';
  const stsOpts = buildStsOpts(_suratFSts, ['Menunggu Approval','Disetujui','Ditolak','Selesai']);

  G('tab-content').innerHTML = `
    <div class="phd" style="border-top:none">
      <span class="ptl">
        <span style="font-family:var(--mono);font-size:.75rem;color:var(--teal)">${tot}</span> surat masuk
        ${_suratFQ ? `<span style="font-size:.6rem;color:var(--muted)"> · "${esc(_suratFQ)}"</span>` : ''}
      </span>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="bp bp-gold" onclick="cetakLaporanSurat('masuk')"><i class="fas fa-print"></i> Cetak</button>
        ${addBtn}
      </div>
    </div>
    <div class="fbar">
      <div class="fsrch">
        <i class="fas fa-search fsi"></i>
        <input class="fctl" type="search" id="su-q"
          placeholder="Ketik lalu tekan Enter atau klik Cari..."
          oninput="_suratMFiltLive(this.value)"
          onkeydown="if(event.key==='Enter'){clearTimeout(_suratMFiltTimer);_renderTabSurat()}"
          value="${esc(_suratFQ)}" autocomplete="off">
      </div>
      <button class="bp bp-teal" onclick="clearTimeout(_suratMFiltTimer);_suratFQ=(G('su-q')||{}).value||'';_suratPg=1;_renderTabSurat()"
              style="flex:0 0 auto;white-space:nowrap"><i class="fas fa-search"></i> Cari</button>
      <select class="fctl" id="su-sts" style="flex:0 0 160px"
              onchange="_suratMFiltSts(this.value)">${stsOpts}</select>
      <button class="bg2" onclick="suratMReset()"><i class="fas fa-rotate-left"></i></button>
    </div>
    <div class="twrap">
      <table class="dtbl dtbl-bordered"><thead><tr>
        <th>No. Surat</th><th>Tanggal</th><th>Jenis</th><th>Pengirim</th><th>Perihal</th>
        <th>Tembusan</th><th>Catatan</th><th>Status</th><th>Tgl Approval</th><th>Aksi</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </div>
    <div class="mcard-list" style="padding:8px 12px">${cards}</div>
    <div class="pgw">
      <span>${pgInfo(st, tot, PER)}</span>
      <div class="pbs">${pgBtns(_suratPg, pages, p => { _suratPg = p; _renderTabSurat(); })}</div>
    </div>`;
}

function _suratMFiltLive(val) {
  _suratFQ = val; _suratPg = 1;
  clearTimeout(_suratMFiltTimer);
  _suratMFiltTimer = setTimeout(() => _renderTabSurat(), 600);
}
function _suratMFiltSts(val) { _suratFSts = val; _suratPg = 1; _renderTabSurat(); }
function suratMFiltDebounce() { _suratMFiltLive((G('su-q')||{}).value||''); }
function suratMFilt() { _suratFSts = (G('su-sts')||{}).value||''; _suratPg = 1; _renderTabSurat(); }
function suratMReset() {
  _suratFQ = ''; _suratFSts = ''; _suratPg = 1;
  const q = G('su-q'), s = G('su-sts');
  if (q) q.value = ''; if (s) s.value = '';
  _renderTabSurat();
}

/* ── Tab Permohonan ── */
function _renderTabPerm() {
  const flt   = _filterData(_permData, _permFQ, _permFSts, ['nama','nik','jenisSurat','keperluan']);
  const tot   = flt.length;
  const pages = Math.max(1, Math.ceil(tot / PER));
  _permPg     = Math.min(_permPg, pages);
  const st    = (_permPg - 1) * PER;
  const sl    = flt.slice(st, st + PER);

  let rows = '', cards = '';
  if (!sl.length) {
    const msg = _permFQ ? `Tidak ada hasil untuk "${esc(_permFQ)}"` : 'Tidak ada permohonan';
    rows  = `<tr><td colspan="7"><div class="empty"><i class="fas fa-file-circle-question"></i><p>${msg}</p></div></td></tr>`;
    cards = `<div class="empty"><i class="fas fa-file-circle-question"></i><p>${msg}</p></div>`;
  } else {
    sl.forEach(r => {
      const ck      = rcSet(r);
      const _pmFid = r.fileUrl?(/\/file\/d\/([^/?#]+)/.exec(r.fileUrl)||[])[1]||'':'';
      const dokBtn  = r.fileUrl ? `<button class="bgreen" title="Preview" onclick="previewFile('${esc(r.fileUrl)}','${esc(r.nama||'Dokumen')}')"><i class="fas fa-eye"></i></button> ` : '';
      const _pmDlBtn = _pmFid ? `<a href="https://drive.google.com/uc?export=download&id=${_pmFid}" class="be" title="Download" download><i class="fas fa-download"></i></a> ` : '';
      const drvBtn  = r.fileUrl ? `<a href="${esc(r.fileUrl)}" target="_blank" rel="noopener" class="be" title="Buka Drive" style="text-decoration:none"><i class="fas fa-external-link-alt"></i></a> ` : '';
      let aksi = `<button class="be" onclick="openModalPerm(rcGet('${ck}'))"><i class="fas fa-info-circle"></i></button>`;
      aksi = dokBtn + _pmDlBtn + drvBtn + aksi;
      if (isAdmin()) aksi += ` <button class="bgold" onclick="openApproval('perm',rcGet('${ck}'))"><i class="fas fa-gavel"></i></button>`;
      if (r.status === 'Disetujui') aksi += ` <button class="bgreen" onclick="cetakSurat(rcGet('${ck}')._ri)"><i class="fas fa-print"></i></button>`;
      if (isAdmin()) aksi += ` <button class="bd" onclick="konfirmHapus('perm',rcGet('${ck}')._ri)"><i class="fas fa-trash"></i></button>`;
      rows += `<tr>
        <td style="font-size:.6rem;font-family:var(--mono)">${esc(r.id)}</td>
        <td style="font-weight:600">${esc(r.nama)}</td>
        <td style="font-size:.62rem">${esc(r.nik)}</td>
        <td>${esc(r.jenisSurat)}</td>
        <td style="font-size:.62rem;color:var(--mid)">${esc((r.ts||'').substring(0,10))}</td>
        <td>${stsSuratChip(r.status)}</td>
        <td style="white-space:nowrap">${dokBtn}${drvBtn}${aksi}</td>
      </tr>`;
      cards += `<div class="mcard-item">
        <div class="mcard-row"><span class="mcard-title">${esc(r.nama)}</span>${stsSuratChip(r.status)}</div>
        <div class="mcard-meta">${esc(r.jenisSurat)}<br>
          <i class="fas fa-id-card" style="width:12px;color:var(--muted)"></i>${esc(r.nik)} · ${esc((r.ts||'').substring(0,10))}
        </div>
        <div class="mcard-acts">${dokBtn}${drvBtn}${aksi}</div>
      </div>`;
    });
  }

  const mnWaiting = _permData.filter(r => r.status === 'Menunggu Approval').length;
  const mnBanner  = isAdmin() && mnWaiting
    ? `<div style="background:rgba(146,88,10,.07);border-bottom:1px solid rgba(146,88,10,.15);
        padding:9px 15px;font-size:.7rem;color:var(--gold);display:flex;align-items:center;gap:7px">
        <i class="fas fa-bell"></i>
        <strong>${mnWaiting} permohonan</strong> menunggu approval Anda.
       </div>` : '';
  const stsOpts = buildStsOpts(_permFSts, ['Menunggu Approval','Disetujui','Ditolak']);

  G('tab-content').innerHTML = `${mnBanner}
    <div class="phd" style="border-top:none">
      <span class="ptl">
        <span style="font-family:var(--mono);font-size:.75rem;color:var(--teal)">${tot}</span> permohonan
        ${_permFQ ? `<span style="font-size:.6rem;color:var(--muted)"> · "${esc(_permFQ)}"</span>` : ''}
      </span>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="bp bp-gold" onclick="cetakLaporanPerm()"><i class="fas fa-print"></i> Cetak Laporan</button>
        <button class="bp bp-green" onclick="openModalPerm(null)"><i class="fas fa-plus"></i> Input Permohonan</button>
      </div>
    </div>
    <div class="fbar">
      <div class="fsrch">
        <i class="fas fa-search fsi"></i>
        <input class="fctl" type="search" id="pm-q"
          placeholder="Ketik lalu Enter atau klik Cari..."
          oninput="_permFiltLive(this.value)"
          onkeydown="if(event.key==='Enter'){clearTimeout(_permFiltTimer);_renderTabPerm()}"
          value="${esc(_permFQ)}" autocomplete="off">
      </div>
      <button class="bp bp-teal" onclick="clearTimeout(_permFiltTimer);_permFQ=(G('pm-q')||{}).value||'';_permPg=1;_renderTabPerm()"
              style="flex:0 0 auto;white-space:nowrap"><i class="fas fa-search"></i> Cari</button>
      <select class="fctl" id="pm-sts" style="flex:0 0 160px"
              onchange="_permFiltSts(this.value)">${stsOpts}</select>
      <button class="bg2" onclick="permReset()"><i class="fas fa-rotate-left"></i></button>
    </div>
    <div class="twrap">
      <table class="dtbl"><thead><tr>
        <th>ID</th><th>Nama</th><th>NIK</th><th>Jenis Surat</th><th>Tanggal</th><th>Status</th><th>Aksi</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </div>
    <div class="mcard-list" style="padding:8px 12px">${cards}</div>
    <div class="pgw">
      <span>${pgInfo(st, tot, PER)}</span>
      <div class="pbs">${pgBtns(_permPg, pages, p => { _permPg = p; _renderTabPerm(); })}</div>
    </div>`;
}

function _permFiltLive(val) {
  _permFQ = val; _permPg = 1;
  clearTimeout(_permFiltTimer);
  _permFiltTimer = setTimeout(() => _renderTabPerm(), 600);
}
function _permFiltSts(val)   { _permFSts = val; _permPg = 1; _renderTabPerm(); }
function permFiltDebounce()  { _permFiltLive((G('pm-q')||{}).value||''); }
function permFilt()          { _permFSts = (G('pm-sts')||{}).value||''; _permPg = 1; _renderTabPerm(); }
function permReset() {
  _permFQ = ''; _permFSts = ''; _permPg = 1;
  const q = G('pm-q'), s = G('pm-sts');
  if (q) q.value = ''; if (s) s.value = '';
  _renderTabPerm();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. SURAT KELUAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function loadSuratKeluar() {
  setNav('sk');
  setPage('Surat Keluar', 'Manajemen surat keluar kelurahan');
  sbClose(); dAllCharts();

  /* ── Cek cache ── */
  const cached = window._gcGet('suratKeluar');
  if (cached) {
    _suratData = cached.suratRes.data || [];
    _suratPg   = 1; _suratFQ = ''; _suratFSts = '';
    _renderSuratKeluar();
    window._gcRefresh('suratKeluar');
    return;
  }

  /* ── Tidak ada cache → fetch normal ── */
  _suratData = []; _suratPg = 1; _suratFQ = ''; _suratFSts = '';
  await pageTransition(async () => {
    showLoad();
    try {
      const res = await gasCall('getAllSurat', { tipe: 'keluar' });
      hideLoad();
      _suratData = res.data || [];
      /* Simpan ke cache */
      window._gcSet('suratKeluar', { suratRes: res });
      _renderSuratKeluar();
    } catch (e) { hideLoad(); throw e; }
  });
}

function _renderSuratKeluar() {
  const flt   = _filterData(_suratData, _suratFQ, _suratFSts, ['perihal','nomorSurat','penerima','catatan','tembusan','jenis','pengirim']);
  const tot   = flt.length;
  const pages = Math.max(1, Math.ceil(tot / PER));
  _suratPg    = Math.min(_suratPg, pages);
  const st    = (_suratPg - 1) * PER;
  const sl    = flt.slice(st, st + PER);

  let rows = '', cards = '';
  if (!sl.length) {
    const msg = _suratFQ ? `Tidak ada hasil untuk "${esc(_suratFQ)}"` : 'Tidak ada surat keluar';
    rows  = `<tr><td colspan="10"><div class="empty"><i class="fas fa-paper-plane"></i><p>${msg}</p></div></td></tr>`;
    cards = `<div class="empty"><i class="fas fa-paper-plane"></i><p>${msg}</p></div>`;
  } else {
    sl.forEach(r => {
      const ck     = rcSet(r);
      const _skFid2 = r.fileUrl?(/\/file\/d\/([^/?#]+)/.exec(r.fileUrl)||[])[1]||'':'';
      const dokBtn = r.fileUrl ? `<button class="bgreen" title="Preview" onclick="previewFile('${esc(r.fileUrl)}','${esc(r.nomorSurat||r.perihal||'Surat')}')"><i class="fas fa-file-alt"></i> Preview</button> ` : '';
      const _skDlBtn = _skFid2 ? `<a href="https://drive.google.com/uc?export=download&id=${_skFid2}" class="be" title="Download" download><i class="fas fa-download"></i></a> ` : '';
      /* FIX: drvBtn didefinisikan lokal di sini (sebelumnya undefined karena hanya ada di scope surat masuk) */
      const drvBtn = r.fileUrl ? `<a href="${esc(r.fileUrl)}" target="_blank" rel="noopener" class="be" style="text-decoration:none"><i class="fas fa-external-link-alt"></i></a> ` : '';
      let aksi = dokBtn + _skDlBtn + drvBtn + `<button class="be" onclick="openModalSurat(rcGet('${ck}'),'keluar')"><i class="fas fa-info-circle"></i></button>`;
      if (isAdmin()) aksi +=
        ` <button class="bgold" onclick="openApproval('surat',rcGet('${ck}'),'keluar')"><i class="fas fa-gavel"></i></button>` +
        ` <button class="bd" onclick="konfirmHapus('surat',rcGet('${ck}')._ri,'keluar')"><i class="fas fa-trash"></i></button>`;
      rows += `<tr>
        <td style="font-size:.58rem;font-family:var(--mono);white-space:nowrap">${esc(r.nomorSurat||'—')}</td>
        <td style="font-size:.62rem;white-space:nowrap">${_fmtTgl(r.tglSurat)}</td>
        <td style="font-size:.62rem;color:var(--muted)">${esc(r.jenis||'—')}</td>
        <td style="font-size:.63rem">${esc(r.penerima)}</td>
        <td style="font-size:.63rem;max-width:160px"><span class="truncate">${esc(r.perihal)}</span></td>
        <td style="font-size:.62rem;color:var(--mid);max-width:120px"><span class="truncate">${esc(r.tembusan||'—')}</span></td>
        <td style="font-size:.62rem;color:var(--mid);max-width:100px"><span class="truncate">${esc(r.catatan||'—')}</span></td>
        <td>${stsSuratChip(r.status)}</td>
        <td style="font-size:.6rem;white-space:nowrap">${_fmtTgl(r.tglApproval)}</td>
        <td style="white-space:nowrap">${aksi}</td>
      </tr>`;
      cards += `<div class="mcard-item">
        <div class="mcard-row"><span class="mcard-title">${esc(r.perihal)}</span>${stsSuratChip(r.status)}</div>
        <div class="mcard-meta">
          <i class="fas fa-hashtag" style="width:12px;color:var(--teal)"></i>${esc(r.nomorSurat||'—')}<br>
          <i class="fas fa-paper-plane" style="width:12px;color:var(--muted)"></i>${esc(r.penerima)} · ${_fmtTgl(r.tglSurat)}
          ${r.jenis?`<br><i class="fas fa-tag" style="width:12px;color:var(--muted)"></i>${esc(r.jenis)}`:''}
          ${r.tembusan?`<br><i class="fas fa-forward" style="width:12px;color:var(--muted)"></i>${esc(r.tembusan)}`:''}
          ${r.catatan?`<br><i class="fas fa-sticky-note" style="width:12px;color:var(--muted)"></i>${esc(r.catatan)}`:''}
        </div>
        <div class="mcard-acts">${dokBtn}${drvBtn}${aksi}</div>
      </div>`;
    });
  }

  const addBtn  = isAdmin() ? `<button class="bp" onclick="openModalSurat(null,'keluar')"><i class="fas fa-plus"></i> Tambah</button>` : '';
  const stsOpts = buildStsOpts(_suratFSts, ['Menunggu Approval','Disetujui','Ditolak','Selesai']);

  G('ct').innerHTML = `<div class="fu"><div class="panel">
    <div class="phd">
      <span class="ptl"><i class="fas fa-paper-plane"></i>Daftar Surat Keluar</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="bp bp-gold" onclick="cetakLaporanSurat('keluar')"><i class="fas fa-print"></i> Cetak</button>
        ${addBtn}
      </div>
    </div>
    <div class="fbar">
      <div class="fsrch">
        <i class="fas fa-search fsi"></i>
        <input class="fctl" type="search" id="sk-q"
          placeholder="Ketik lalu tekan Enter atau klik Cari..."
          oninput="_suratKFiltLive(this.value)"
          onkeydown="if(event.key==='Enter'){clearTimeout(_suratKFiltTimer);_renderSuratKeluar()}"
          value="${esc(_suratFQ)}" autocomplete="off">
      </div>
      <button class="bp bp-teal" onclick="clearTimeout(_suratKFiltTimer);_suratFQ=(G('sk-q')||{}).value||'';_suratPg=1;_renderSuratKeluar()"
              style="flex:0 0 auto;white-space:nowrap"><i class="fas fa-search"></i> Cari</button>
      <select class="fctl" id="sk-sts" style="flex:0 0 160px"
              onchange="_suratKFiltSts(this.value)">${stsOpts}</select>
      <button class="bg2" onclick="suratKReset()"><i class="fas fa-rotate-left"></i></button>
    </div>
    <div class="twrap">
      <table class="dtbl dtbl-bordered"><thead><tr>
        <th>No. Surat</th><th>Tanggal</th><th>Jenis</th><th>Kepada</th><th>Perihal</th>
        <th>Tembusan</th><th>Catatan</th><th>Status</th><th>Tgl Approval</th><th>Aksi</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </div>
    <div class="mcard-list" style="padding:8px 12px">${cards}</div>
    <div class="pgw">
      <span>${pgInfo(st, tot, PER)}</span>
      <div class="pbs">${pgBtns(_suratPg, pages, p => { _suratPg = p; _renderSuratKeluar(); })}</div>
    </div>
  </div></div>`;
}

function _suratKFiltLive(val) {
  _suratFQ = val; _suratPg = 1;
  clearTimeout(_suratKFiltTimer);
  _suratKFiltTimer = setTimeout(() => _renderSuratKeluar(), 600);
}
function _suratKFiltSts(val)  { _suratFSts = val; _suratPg = 1; _renderSuratKeluar(); }
function suratKFiltDebounce() { _suratKFiltLive((G('sk-q')||{}).value||''); }
function suratKFilt()         { _suratFSts = (G('sk-sts')||{}).value||''; _suratPg = 1; _renderSuratKeluar(); }
function suratKReset() {
  _suratFQ = ''; _suratFSts = ''; _suratPg = 1;
  const q = G('sk-q'), s = G('sk-sts');
  if (q) q.value = ''; if (s) s.value = '';
  _renderSuratKeluar();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. MODAL PERMOHONAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function openModalPerm(row) {
  const JENIS = ['Surat Keterangan Domisili','Surat Keterangan Tidak Mampu',
    'Surat Keterangan Usaha','Surat Pengantar','Surat Keterangan Lainnya'];
  const jenisOpts = JENIS.map(j =>
    `<option value="${j}"${row&&row.jenisSurat===j?' selected':''}>${j}</option>`).join('');
  const isEdit = !!row;
  const ro = isEdit ? ' readonly' : '';
  const ds = isEdit ? ' disabled' : '';

  /* FIX: Build upload HTML secara aman tanpa template-literal escape */
  const uploadHtml = !isEdit
    ? (typeof _buildUploadHtml === 'function' ? _buildUploadHtml('pm', '.pdf,.jpg,.jpeg,.png') : '')
    : '';

  let body = `
    <div class="frow2">
      <div class="fgrp"><label class="flbl" for="pm-nama">Nama Pemohon <span class="req">*</span></label>
        <input class="fctl" id="pm-nama" value="${esc(row?row.nama:'')}"${ro} placeholder="Nama lengkap sesuai KTP"></div>
      <div class="fgrp"><label class="flbl" for="pm-nik">NIK <span class="req">*</span></label>
        <input class="fctl" id="pm-nik" value="${esc(row?row.nik:'')}"${ro} placeholder="16 digit NIK" inputmode="numeric"></div>
    </div>
    <div class="frow3">
      <div class="fgrp"><label class="flbl" for="pm-tpt">Tempat Lahir</label>
        <input class="fctl" id="pm-tpt" value="${esc(row?row.tempatLahir:'')}"${ro}></div>
      <div class="fgrp"><label class="flbl" for="pm-tl">Tanggal Lahir</label>
        <input class="fctl" type="date" id="pm-tl" value="${esc(row?row.tglLahir:'')}"${ro}></div>
      <div class="fgrp"><label class="flbl" for="pm-nokk">No. KK</label>
        <input class="fctl" id="pm-nokk" value="${esc(row?row.noKK:'')}"${ro}></div>
    </div>
    <div class="frow3">
      <div class="fgrp"><label class="flbl" for="pm-agama">Agama</label>
        <select class="fctl" id="pm-agama"${ds}>
          ${['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu']
            .map(a=>`<option${row&&row.agama===a?' selected':''}>${a}</option>`).join('')}
        </select></div>
      <div class="fgrp"><label class="flbl" for="pm-rt">RT</label>
        <input class="fctl" id="pm-rt" value="${esc(row?row.rt:'')}"${ro} inputmode="numeric"></div>
      <div class="fgrp"><label class="flbl" for="pm-rw">RW</label>
        <input class="fctl" id="pm-rw" value="${esc(row?row.rw:'')}"${ro} inputmode="numeric"></div>
    </div>
    <div class="fgrp"><label class="flbl" for="pm-alamat">Alamat <span class="req">*</span></label>
      <input class="fctl" id="pm-alamat" value="${esc(row?row.alamat:'')}"${ro} placeholder="Jl. ..."></div>
    <div class="frow2">
      <div class="fgrp"><label class="flbl" for="pm-jenis">Jenis Surat <span class="req">*</span></label>
        <select class="fctl" id="pm-jenis"${ds}>${jenisOpts}</select></div>
      <div class="fgrp"><label class="flbl" for="pm-keperluan">Keperluan <span class="req">*</span></label>
        <input class="fctl" id="pm-keperluan" value="${esc(row?row.keperluan:'')}"${ro}></div>
    </div>`;

  if (!isEdit) {
    body += `<div class="fgrp"><label class="flbl">Dokumen Pendukung</label>${uploadHtml}</div>`;
  }

  if (row) {
    body += `<div style="background:var(--bg);border-radius:8px;padding:9px;font-size:.68rem;color:var(--mid);margin-top:4px">
      <strong>Status:</strong> ${stsSuratChip(row.status)}`;
    if (row.nomorSurat) body += `&emsp;<strong>No. Surat:</strong> <span style="font-family:var(--mono);font-size:.65rem">${esc(row.nomorSurat)}</span>`;
    if (row.catatan)    body += `<br><strong>Catatan:</strong> ${esc(row.catatan)}`;
    body += `</div>`;
    if (row.fileUrl) body +=
      `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:8px">
        <button class="bgreen" onclick="previewFile('${esc(row.fileUrl)}','Dokumen')"><i class="fas fa-eye"></i> Preview</button>
        <a href="${esc(row.fileUrl)}" target="_blank" rel="noopener" class="bg2"><i class="fas fa-external-link-alt"></i>Drive</a>
      </div>`;
  }

  ensureModal('m-perm',
    `<div class="mbox"><div class="mhd">
      <h5><i class="fas fa-file-circle-plus" style="color:var(--green2)"></i>${isEdit?'Detail':'Input'} Permohonan</h5>
      <button class="bx" onclick="cm('m-perm')">&times;</button>
    </div>
    <div class="mbd" id="m-perm-body"></div>
    <div class="mft" id="m-perm-ft"></div></div>`);

  G('m-perm-body').innerHTML = body;
  G('m-perm-ft').innerHTML = `<button class="bg2" onclick="cm('m-perm')">Tutup</button>` +
    (!isEdit ? ` <button class="bp bp-green" onclick="submitPerm()"><i class="fas fa-save"></i> Ajukan</button>` : '');
  setTimeout(() => { if (row && G('pm-agama')) G('pm-agama').value = row.agama||'Islam'; }, 50);
  om('m-perm');
}

async function submitPerm() {
  const fv = id => (G(id)||{}).value||'';
  const nama=fv('pm-nama'), nik=fv('pm-nik'), alamat=fv('pm-alamat'),
        jenis=fv('pm-jenis'), keperluan=fv('pm-keperluan');
  if (!nama||!nik||!alamat||!jenis||!keperluan) { toast('Field wajib belum diisi.','er'); return; }
  const payload = { nama, nik, tempatLahir:fv('pm-tpt'), tglLahir:fv('pm-tl'), noKK:fv('pm-nokk'),
    agama:fv('pm-agama')||'Islam', alamat, rt:fv('pm-rt'), rw:fv('pm-rw'),
    jenisSurat:jenis, keperluan, createdBy:SES.username };
  const fc = (typeof _fileMultiCache!=='undefined' && (_fileMultiCache['pm']||[])[0]) || _fileCache['pm'];
  if (fc) {
    payload.fileData=fc.data; payload.fileMime=fc.mime;
    const ext=(fc.mime||'').split('/')[1]||(fc.name||'').split('.').pop()||'bin';
    payload.fileName=_fmtFileName(jenis, new Date().toISOString().substring(0,10), nama, ext);
  }
  showLoad('Menyimpan...'); cm('m-perm');
  if(typeof _fileMultiCache!=='undefined') _fileMultiCache['pm']=[];
  delete _fileCache['pm'];
  try {
    const res = await gasCall('addPermohonan', payload);
    hideLoad();
    if (res.success) {
      toast('Permohonan berhasil diajukan.','ok');
      window._gcDel('dashboard');
      window._gcDel('suratMasuk');
      window._gcDel('laporan');
      loadSuratMasuk();
    } else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. MODAL SURAT (Masuk & Keluar)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function openModalSurat(row, tipe) {
  const label = tipe==='masuk' ? 'Surat Masuk' : 'Surat Keluar';
  const isNew = !row && isAdmin();
  const JENIS = ['Surat Masuk Dinas','Surat Masuk Umum','Surat Keluar Dinas',
                 'Surat Undangan','Surat Keterangan Resmi','Surat Pengantar'];
  const jenisOpts = JENIS.map(j=>`<option value="${j}"${row&&row.jenis===j?' selected':''}>${j}</option>`).join('');
  const ro = isAdmin() ? '' : ' readonly';
  const ds = isAdmin() ? '' : ' disabled';

  /* FIX: Build upload HTML secara aman tanpa template-literal backslash escape */
  const uploadHtml = isNew
    ? (typeof _buildUploadHtml === 'function' ? _buildUploadHtml('su') : '')
    : '';

  let body = `
    <div class="frow2">
      <div class="fgrp"><label class="flbl" for="su-no">Nomor Surat</label>
        <input class="fctl" id="su-no" value="${esc(row?row.nomorSurat:'')}"${ro} placeholder="Auto jika kosong"></div>
      <div class="fgrp"><label class="flbl" for="su-tgl">Tanggal <span class="req">*</span></label>
        <input class="fctl" type="date" id="su-tgl" value="${esc(row?_toDateInput(row.tglSurat):'')}"${ro}></div>
    </div>
    <div class="frow2">
      <div class="fgrp"><label class="flbl" for="su-jenis">Jenis Surat</label>
        <select class="fctl" id="su-jenis"${ds}>${jenisOpts}</select></div>
      <div class="fgrp"><label class="flbl" for="su-pihak">${tipe==='masuk'?'Pengirim':'Kepada'} <span class="req">*</span></label>
        <input class="fctl" id="su-pihak" value="${esc(row?(tipe==='masuk'?row.pengirim:row.penerima):'')}\"${ro}></div>
    </div>
    <div class="fgrp"><label class="flbl" for="su-perihal">Perihal <span class="req">*</span></label>
      <input class="fctl" id="su-perihal" value="${esc(row?row.perihal:'')}"${ro}></div>
    <div class="fgrp"><label class="flbl" for="su-tembusan">Tembusan</label>
      <input class="fctl" id="su-tembusan" value="${esc(row?row.tembusan:'')}"${ro}></div>
    <div class="fgrp"><label class="flbl" for="su-catatan">Catatan</label>
      <textarea class="fctl" id="su-catatan" rows="2"${ro}>${esc(row?row.catatan:'')}</textarea></div>`;

  /* FIX: sisipkan uploadHtml sebagai variabel JS, bukan template-literal bersarang */
  if (isNew) {
    body += `<div class="fgrp"><label class="flbl">Upload Dokumen</label>${uploadHtml}</div>`;
  }

  if (row && row.fileUrl) {
    const _fid = (/\/file\/d\/([^/?#]+)/.exec(row.fileUrl)||[])[1]||'';
    const _emb = _fid ? 'https://drive.google.com/file/d/'+_fid+'/preview' : '';
    body += `<div class="fgrp">
      <div style="font-size:.62rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">
        <i class="fas fa-paperclip"></i> Dokumen Terlampir
      </div>
      ${_emb ? `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#111;height:180px;margin-bottom:6px">
        <iframe src="${_emb}" style="width:100%;height:180px;border:none" sandbox="allow-same-origin allow-scripts allow-popups"></iframe>
      </div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="bgreen" onclick="previewFile('${esc(row.fileUrl)}','${esc(row.nomorSurat||'Dokumen')}')">
          <i class="fas fa-expand-alt"></i> Buka Preview
        </button>
        <a href="${esc(row.fileUrl)}" target="_blank" rel="noopener" class="bg2" style="text-decoration:none">
          <i class="fas fa-external-link-alt"></i> Drive
        </a>
      </div>
    </div>`;
  }
  if (row) {
    body += `<div style="background:var(--bg);border-radius:8px;padding:9px;font-size:.68rem;color:var(--mid);margin-top:4px">
      <strong>Status:</strong> ${stsSuratChip(row.status)}
      ${row.approvedBy?`&emsp;<strong>Oleh:</strong> ${esc(row.approvedBy)}`:''}
    </div>`;
  }

  const ico = tipe==='masuk' ? 'fa-envelope-open-text' : 'fa-paper-plane';
  ensureModal('m-surat',
    `<div class="mbox"><div class="mhd">
      <h5><i class="fas ${ico}" style="color:var(--teal)"></i>${row?'Detail':'Tambah'} ${label}</h5>
      <button class="bx" onclick="cm('m-surat')">&times;</button>
    </div>
    <div class="mbd" id="m-surat-body"></div>
    <div class="mft" id="m-surat-ft"></div></div>`);

  G('m-surat-body').innerHTML = body;
  G('m-surat-ft').innerHTML = `<button class="bg2" onclick="cm('m-surat')">Tutup</button>` +
    (isNew ? ` <button class="bp bp-teal" onclick="submitSurat('${tipe}')"><i class="fas fa-save"></i> Simpan</button>` : '');
  om('m-surat');
}

async function submitSurat(tipe) {
  const fv = id => (G(id)||{}).value||'';
  const pihak=fv('su-pihak'), perihal=fv('su-perihal'), tgl=fv('su-tgl');
  if (!pihak||!perihal||!tgl) { toast('Field wajib belum diisi.','er'); return; }
  const payload = { tipe, jenis:fv('su-jenis'), nomorSurat:fv('su-no'),
    tglSurat:tgl, perihal, catatan:fv('su-catatan'), tembusan:fv('su-tembusan'), createdBy:SES.username };
  if (tipe==='masuk') { payload.pengirim=pihak; payload.penerima='Kelurahan Kepatihan'; }
  else { payload.pengirim='Kelurahan Kepatihan'; payload.penerima=pihak; }
  const fc = (typeof _fileMultiCache!=='undefined' && (_fileMultiCache['su']||[])[0]) || _fileCache['su'];
  if (fc) {
    payload.fileData=fc.data; payload.fileMime=fc.mime;
    const ext=(fc.mime||'').split('/')[1]||(fc.name||'').split('.').pop()||'bin';
    payload.fileName=_fmtFileName(fv('su-jenis')||tipe, tgl, pihak, ext);
  }
  showLoad('Menyimpan...'); cm('m-surat');
  if(typeof _fileMultiCache!=='undefined') _fileMultiCache['su']=[];
  delete _fileCache['su'];
  try {
    const res = await gasCall('addSurat', payload);
    hideLoad();
    if (res.success) {
      const hasFile = res.fileUrl && !res.fileUrl.startsWith('ERROR:');
      toast(hasFile ? 'Surat disimpan + file terupload.' : 'Surat berhasil disimpan.','ok');
      if (res.fileUrl && res.fileUrl.startsWith('ERROR:'))
        toast('⚠ File gagal upload: '+res.fileUrl.substring(6),'er');
      window._gcDel('dashboard');
      window._gcDel('suratMasuk');
      window._gcDel('suratKeluar');
      window._gcDel('laporan');
      tipe==='masuk' ? loadSuratMasuk() : loadSuratKeluar();
    } else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. APPROVAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function openApproval(mode, row) {
  if (!isAdmin()) { toast('Akses ditolak.','er'); return; }
  _apprMode = mode; _apprRow = row;
  const isSurat = mode==='surat';
  const OPTS = isSurat
    ? ['Menunggu Approval','Disetujui','Ditolak','Selesai']
    : ['Menunggu Approval','Diproses','Disetujui','Ditolak'];
  const stsOpts = OPTS.map(s=>`<option value="${s}"${row&&row.status===s?' selected':''}>${s}</option>`).join('');

  const info = isSurat
    ? `<div class="appr-info"><strong>${esc(row.perihal)}</strong>
        <span style="font-size:.65rem;color:var(--muted)">${esc(row.nomorSurat)} · ${esc(row.pengirim||row.penerima)}</span></div>`
    : `<div class="appr-info"><strong>${esc(row.nama)}</strong>
        <span style="font-size:.65rem;color:var(--muted)">${esc(row.jenisSurat)} · NIK: ${esc(row.nik)}</span></div>`;

  const body = `${info}
    <div class="fgrp"><label class="flbl" for="appr-sts">Status <span class="req">*</span></label>
      <select class="fctl" id="appr-sts">${stsOpts}</select></div>
    ${!isSurat?`<div class="fgrp"><label class="flbl" for="appr-nosurat">Nomor Surat (jika disetujui)</label>
      <input class="fctl" id="appr-nosurat" value="${esc(row.nomorSurat||'')}" placeholder="Nomor surat keluaran"></div>`:''}
    <div class="fgrp"><label class="flbl" for="appr-cat">Catatan Approval</label>
      <textarea class="fctl" id="appr-cat" rows="2" placeholder="Alasan penolakan, catatan, dll.">${esc(row.catatan||'')}</textarea></div>`;

  ensureModal('m-appr',
    `<div class="mbox"><div class="mhd">
      <h5><i class="fas fa-gavel" style="color:var(--gold)"></i>Approval ${isSurat?'Surat':'Permohonan'}</h5>
      <button class="bx" onclick="cm('m-appr')">&times;</button>
    </div>
    <div class="mbd" id="m-appr-body"></div>
    <div class="mft" id="m-appr-ft"></div></div>`);
  G('m-appr-body').innerHTML = body;
  G('m-appr-ft').innerHTML =
    `<button class="bg2" onclick="cm('m-appr')">Batal</button>
     <button class="bgold" onclick="submitApproval()"><i class="fas fa-gavel"></i> Proses</button>`;
  om('m-appr');
}

async function submitApproval() {
  const fv = id => (G(id)||{}).value||'';
  const sts=fv('appr-sts'), cat=fv('appr-cat'), noSurat=fv('appr-nosurat');
  if (!sts) { toast('Status wajib dipilih.','er'); return; }
  const isSurat = _apprMode==='surat';
  const payload = { _ri:_apprRow._ri, status:sts, catatan:cat, approvedBy:SES.username, tipe:_apprRow.tipe||'' };
  if (!isSurat && noSurat) payload.nomorSurat = noSurat;
  showLoad('Memproses...'); cm('m-appr');
  try {
    const res = await gasCall(isSurat?'updateStatusSurat':'updateStatusPermohonan', payload);
    hideLoad();
    if (res.success) {
      toast('Status berhasil diperbarui.','ok');
      window._gcDel('dashboard');
      window._gcDel('suratMasuk');
      window._gcDel('suratKeluar');
      window._gcDel('laporan');
      isSurat ? (_suratTab==='surat' ? loadSuratMasuk() : loadSuratKeluar())
              : (_suratTab='permohonan', loadSuratMasuk());
    } else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   6. TEMPLATE KOP SURAT & CETAK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const _TPL_SURAT_DEFAULT = {
  instansi1:'PEMERINTAH KABUPATEN PONOROGO', instansi2:'KECAMATAN PONOROGO',
  dinas:'KELURAHAN KEPATIHAN',
  alamat:'Jl. Jenderal Sudirman No.76, Kelurahan Kepatihan, Kec. Ponorogo, Kab. Ponorogo, Jawa Timur, 63416',
  logoKanan:'https://upload.wikimedia.org/wikipedia/id/8/8e/Lambang_Kabupaten_Ponorogo.png',
  logoKiri:'', namaTtd:'Husnul Arifandi, S.STP',
  jabatanTtd:'Lurah Kepatihan', nipTtd:'NIP. 19750615 200003 1 005', tembusan:'',
};

function getTplSurat()   { return Object.assign({}, _TPL_SURAT_DEFAULT, _templateSurat); }
function getTplLaporan() { return Object.assign({}, _TPL_SURAT_DEFAULT, _templateLaporan); }

/* _BULAN_ID dan _tglStr → didefinisikan di ui.js (global) */

/* ── Format tanggal dari GAS (bisa string ISO, DD/MM/YYYY, atau Date) ── */
function _fmtTgl(v) {
  if (!v) return '—';
  const s = String(v).trim();
  /* Sudah format yyyy-MM-dd */
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y,m,d] = s.substring(0,10).split('-');
    return `${parseInt(d)} ${_BULAN_ID[parseInt(m)-1]} ${y}`;
  }
  /* Format DD/MM/YYYY */
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [d,m,y] = s.split('/');
    return `${parseInt(d)} ${_BULAN_ID[parseInt(m)-1]} ${y}`;
  }
  /* ISO string dengan T */
  if (s.includes('T')) {
    const dt = new Date(s);
    if (!isNaN(dt)) return _tglStr(dt);
  }
  return s.substring(0, 10) || '—';
}

/* Konversi nilai tanggal ke yyyy-MM-dd untuk input[type=date] */
function _toDateInput(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [d,m,y] = s.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  if (s.includes('T')) {
    const dt = new Date(s);
    if (!isNaN(dt)) return dt.toISOString().substring(0,10);
  }
  return s.substring(0,10);
}

/* Nama file upload: jenisSurat_tanggal_nama.ext */
function _fmtFileName(jenis, tgl, nama, ext) {
  const safe = s => String(s||'').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g,'_').substring(0,30);
  const tglPart = String(tgl||'').substring(0,10).replace(/-/g,'');
  return `${safe(jenis)}_${tglPart}_${safe(nama)}.${ext||'bin'}`;
}

function _buildKopHtml(tpl, extraStyle='') {
  /* ── Logo kiri: pakai dari template, fallback ke assets/icon-full.png ── */
  const logoKiriSrc = tpl.logoKiri || 'assets/icon-full.png';
  const logoL = `<img src="${esc(logoKiriSrc)}"
    style="width:88px;height:88px;object-fit:contain;flex-shrink:0"
    alt="Logo Kiri"
    onerror="this.style.visibility='hidden'">`;

  /* ── Logo kanan: opsional dari template ── */
  const logoR = tpl.logoKanan
    ? `<img src="${esc(tpl.logoKanan)}"
         style="width:88px;height:88px;object-fit:contain;flex-shrink:0"
         alt="Logo Kanan"
         onerror="this.style.visibility='hidden'">`
    : `<div style="width:88px;flex-shrink:0"></div>`;

  /* ── @page size + orientasi dari pilihan di modal ── */
  const _kdim = (typeof _KERTAS_DIM !== 'undefined' && _cetakKertas)
    ? (_KERTAS_DIM[_cetakKertas] || _KERTAS_DIM.a4) : { w: 210, h: 297 };
  const _isLand = (typeof _cetakOrient !== 'undefined' && _cetakOrient === 'landscape');
  const dim = _isLand
    ? { w: Math.max(_kdim.w,_kdim.h), h: Math.min(_kdim.w,_kdim.h) }
    : { w: Math.min(_kdim.w,_kdim.h), h: Math.max(_kdim.w,_kdim.h) };
  const pageStyle = `@page{size:${dim.w}mm ${dim.h}mm;margin:0}`;
  const marginTop = dim.h > 297 ? '1.8cm' : '1.5cm';
  const marginSide = _isLand ? '2cm' : '2.5cm';

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><style>
${pageStyle}
body{font-family:'Times New Roman',serif;font-size:12pt;color:#000;margin:0;padding:0}
.hal{padding:${marginTop} ${marginSide} 2cm;max-width:${dim.w}mm;margin:auto;box-sizing:border-box}
.kop{display:flex;align-items:center;border-bottom:3px double #000;padding-bottom:10px;margin-bottom:14px;gap:10px}
.kop-tengah{flex:1;text-align:center}
.kop-tengah h1,.kop-tengah h2,.kop-tengah h3{font-weight:bold;margin:2px 0;text-transform:uppercase}
.kop-tengah h1{font-size:11pt}.kop-tengah h2{font-size:12pt}.kop-tengah h3{font-size:12pt}
.kop-tengah p{font-size:8.5pt;margin:1px 0}
.judul{text-align:center;font-size:12pt;font-weight:bold;text-decoration:underline;text-transform:uppercase;margin:14px 0 4px}
.no-surat{text-align:center;font-size:10.5pt;margin-bottom:16px}
table.isi{width:100%;font-size:11pt;border-collapse:collapse}
table.isi td{padding:3px 4px;vertical-align:top}
table.isi td:first-child{width:160px;white-space:nowrap}
.ttd-wrap{display:flex;justify-content:flex-end;margin-top:32px}
.ttd-box{text-align:center;font-size:11pt}.ttd-box p{margin:1px 0}
.ttd-nama{font-weight:bold;text-decoration:underline;margin-top:60px!important}
.tembusan-sec{margin-top:20px;font-size:10pt}
${extraStyle}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hal{padding:.8cm 1.5cm 1.2cm!important}
}
@media screen and (max-width:600px){
  .hal{padding:8px 10px 12px!important;max-width:100%!important}
  .kop{gap:6px!important}
  .kop img{width:50px!important;height:50px!important}
  .kop-tengah h1{font-size:9pt!important}
  .kop-tengah h2{font-size:10pt!important}
  .kop-tengah h3{font-size:10pt!important}
  .kop-tengah p{font-size:7pt!important}
  table.isi td:first-child{width:110px!important}
  .ttd-wrap{margin-top:16px!important}
  .ttd-nama{margin-top:36px!important}
}
</style></head><body><div class="hal">
<div class="kop">${logoL}<div class="kop-tengah">
<h1>${esc(tpl.instansi1)}</h1><h2>${esc(tpl.instansi2)}</h2>
<h3>${esc(tpl.dinas)}</h3><p>${esc(tpl.alamat)}</p>
</div>${logoR}</div>`;
}

/**
 * Pasang srcdoc ke iframe cetak, inject @page setelah load,
 * lalu buka modal.
 * Semua fungsi cetak wajib pakai ini agar ukuran kertas ter-apply.
 */
function _setCetakSrcdoc(html) {
  const fr = G('surat-frame');
  if (!fr) return;
  /* Pasang onload sebelum set srcdoc */
  if (typeof _injectPageCssAfterLoad === 'function') {
    _injectPageCssAfterLoad(fr);
  }
  fr.srcdoc = html;
  om('m-cetak');
  /* Reset pilihan kertas ke A4 jika user belum pilih */
  const sel = G('cetak-kertas');
  if (sel && !sel.value) sel.value = 'a4';
}

function _buildKopFooter(tpl, tempat, tanggal, tembusan) {
  const tbs = tembusan || tpl.tembusan;
  let html = `<div class="ttd-wrap"><div class="ttd-box">
    <p>${esc(tempat||'Ponorogo')}, ${esc(tanggal)}</p>
    <p>${esc(tpl.jabatanTtd)}</p>
    <p class="ttd-nama">${esc(tpl.namaTtd)}</p>
    <p>${esc(tpl.nipTtd)}</p>
  </div></div>`;
  if (tbs) html += `<div class="tembusan-sec"><p><strong>Tembusan:</strong></p><p>${esc(tbs).replace(/\n/g,'<br>')}</p></div>`;
  return html + '</div></body></html>';
}

async function cetakLaporanSurat(tipe) {
  showLoad('Menyiapkan laporan...');
  try {
    const res = await gasCall('getAllSurat', { tipe });
    hideLoad();
    if (!res.success) { toast('Gagal: '+res.message,'er'); return; }
    const data=res.data||[], tpl=getTplLaporan(), tglNow=_tglStr(new Date());
    const judul = tipe==='masuk' ? 'REKAPAN SURAT MASUK' : 'REKAPAN SURAT KELUAR';
    const rows = data.map((r,i)=>`<tr>
      <td style="text-align:center">${i+1}</td>
      <td style="font-family:monospace;font-size:9pt">${esc(r.nomorSurat)}</td>
      <td>${esc(r.tglSurat)}</td>
      <td>${esc(tipe==='masuk'?r.pengirim:r.penerima)}</td>
      <td>${esc(r.perihal)}</td>
      <td style="text-align:center">${esc(r.status)}</td>
      <td>${esc(r.tglApproval||'—')}</td>
    </tr>`).join('');
    let html = _buildKopHtml(tpl,`
      h3.lap-judul{text-align:center;font-size:12pt;text-decoration:underline;text-transform:uppercase;margin:14px 0 4px}
      p.periode{text-align:center;font-size:10pt;margin-bottom:14px}
      table.rekap{width:100%;border-collapse:collapse;margin:10px 0;font-size:9.5pt}
      table.rekap th{background:#e8ecf3;border:1px solid #000;padding:5px 7px;font-size:9pt;text-align:center}
      table.rekap td{border:1px solid #333;padding:4px 7px;vertical-align:top}
      table.rekap tr:nth-child(even) td{background:#f8f9fb}`);
    html += `<h3 class="lap-judul">${judul}</h3>
      <p class="periode">Dicetak: ${tglNow}</p>
      <table class="rekap"><thead><tr>
        <th style="width:30px">No</th><th>Nomor Surat</th><th style="width:80px">Tanggal</th>
        <th>${tipe==='masuk'?'Pengirim':'Kepada'}</th><th>Perihal</th>
        <th style="width:80px">Status</th><th style="width:80px">Tgl Approval</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <p style="font-size:9pt;color:#555;margin-top:8px">Total: ${data.length} surat</p>`;
    html += _buildKopFooter(tpl,'Ponorogo',tglNow,'');
    _setCetakSrcdoc(html);
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}


/* Cetak laporan permohonan warga */
async function cetakLaporanPerm() {
  showLoad('Menyiapkan laporan...');
  try {
    const res = await gasCall('getAllPermohonan', {});
    hideLoad();
    if (!res.success) { toast('Gagal: '+res.message,'er'); return; }
    const data=res.data||[], tpl=getTplLaporan(), tglNow=_tglStr(new Date());
    const rows = data.map((r,i)=>`<tr>
      <td style="text-align:center">${i+1}</td>
      <td style="font-weight:600">${esc(r.nama)}</td>
      <td style="font-size:9pt;font-family:monospace">${esc(r.nik)}</td>
      <td>${esc(r.jenisSurat)}</td>
      <td style="font-size:9pt">${esc((r.ts||r.createdAt||'').substring(0,10))}</td>
      <td style="text-align:center">${esc(r.status)}</td>
      <td style="font-size:9pt">${esc(r.nomorSurat||'—')}</td>
    </tr>`).join('');
    let html = _buildKopHtml(tpl,`
      h3.lap-judul{text-align:center;font-size:12pt;text-decoration:underline;text-transform:uppercase;margin:14px 0 4px}
      p.periode{text-align:center;font-size:10pt;margin-bottom:14px}
      table.rekap{width:100%;border-collapse:collapse;font-size:9.5pt}
      table.rekap th{background:#e8ecf3;border:1px solid #000;padding:5px 7px;font-size:9pt;text-align:center}
      table.rekap td{border:1px solid #333;padding:4px 7px;vertical-align:top}
      table.rekap tr:nth-child(even) td{background:#f8f9fb}`);
    html += `<h3 class="lap-judul">REKAPAN PERMOHONAN WARGA</h3>
      <p class="periode">Dicetak: ${tglNow}</p>
      <table class="rekap"><thead><tr>
        <th style="width:30px">No</th><th>Nama</th><th>NIK</th>
        <th>Jenis Surat</th><th style="width:80px">Tanggal</th>
        <th style="width:90px">Status</th><th style="width:100px">No. Surat</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <p style="font-size:9pt;color:#555;margin-top:8px">Total: ${data.length} permohonan</p>`;
    html += _buildKopFooter(tpl,'Ponorogo',tglNow,'');
    _setCetakSrcdoc(html);
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

async function cetakSurat(ri) {
  showLoad('Menyiapkan surat...');
  try {
    const res = await gasCall('getPermohonanById', { ri });
    hideLoad();
    if (!res.success) { toast('Gagal: '+res.message,'er'); return; }
    const r=res.data, tpl=getTplSurat(), tglNow=_tglStr(new Date());
    let html = _buildKopHtml(tpl);
    html += `<div class="judul">${esc(r.jenisSurat)}</div>
      <div class="no-surat">Nomor: ${esc(r.nomorSurat||'........../..../.....')}</div>
      <p style="margin-bottom:10px;font-size:11pt">Yang bertanda tangan di bawah ini ${esc(tpl.jabatanTtd)} ${esc(tpl.dinas)}, menerangkan bahwa:</p>
      <table class="isi">
        <tr><td>Nama</td><td>: <strong>${esc(r.nama)}</strong></td></tr>
        <tr><td>NIK</td><td>: ${esc(r.nik)}</td></tr>
        ${r.tempatLahir||r.tglLahir?`<tr><td>Tempat / Tgl. Lahir</td><td>: ${esc(r.tempatLahir||'—')} / ${esc(r.tglLahir||'—')}</td></tr>`:''}
        ${r.noKK?`<tr><td>No. KK</td><td>: ${esc(r.noKK)}</td></tr>`:''}
        ${r.agama?`<tr><td>Agama</td><td>: ${esc(r.agama)}</td></tr>`:''}
        <tr><td>Alamat</td><td>: ${esc(r.alamat)}${r.rt?` RT ${esc(r.rt)}`:''}${r.rw?`/RW ${esc(r.rw)}`:''}</td></tr>
        ${r.keperluan?`<tr><td>Keperluan</td><td>: ${esc(r.keperluan)}</td></tr>`:''}
      </table>
      <p style="margin-top:14px;font-size:11pt">Demikian surat keterangan ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.</p>`;
    html += _buildKopFooter(tpl,'Ponorogo',tglNow,r.tembusan||'');
    _setCetakSrcdoc(html);
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}
