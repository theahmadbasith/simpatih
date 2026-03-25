/* ─── Format tanggal untuk penduduk (handle berbagai format GAS) ─── */
function _fmtTglKP(v) {
  if (!v) return '—';
  const s = String(v).trim();
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y,m,d] = s.substring(0,10).split('-');
    return parseInt(d)+' '+bln[parseInt(m)-1]+' '+y;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [d,m,y] = s.split('/');
    return parseInt(d)+' '+bln[parseInt(m)-1]+' '+y;
  }
  if (s.includes('T')) {
    const dt = new Date(s);
    if (!isNaN(dt)) return _fmtTglKP(dt.toISOString().substring(0,10));
  }
  return s.substring(0,10) || '—';
}
function _toDateKP(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [d,m,y] = s.split('/');
    return y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');
  }
  if (s.includes('T')) {
    const dt = new Date(s); if (!isNaN(dt)) return dt.toISOString().substring(0,10);
  }
  return '';
}

/* ═══════════════════════════════════════════════════════════════════
   SIMPATIH — js/penduduk.js
   Modul Kependudukan
   ───────────────────────────────────────────────────────────────────
   Tanggung jawab:
     • Load & render data penduduk (semua kolom)
     • Filter live (nama, NIK, KK, alamat, pekerjaan, dll)
     • Modal detail/tambah/edit penduduk
     • Submit tambah/update penduduk

   Dependensi: ui.js, api.js
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

async function loadKependudukan() {
  setNav('kp');
  setPage('Data Kependudukan', 'Data penduduk Kelurahan Kepatihan');
  sbClose(); dAllCharts();

  /* ── Cek cache ── */
  const cached = window._gcGet('penduduk');
  if (cached) {
    _kpData = cached.res.data || [];
    _kpPg = 1; _kpFQ = ''; _kpFRT = '';
    _renderKependudukan();
    window._gcRefresh('penduduk');
    return;
  }

  /* ── Tidak ada cache → fetch normal ── */
  _kpData = []; _kpPg = 1; _kpFQ = ''; _kpFRT = '';
  await pageTransition(async () => {
    showLoad();
    try {
      const res = await gasCall('getAllPenduduk', {});
      hideLoad();
      _kpData = res.data || [];
      window._gcSet('penduduk', { res }); /* ← simpan ke cache */
      _renderKependudukan();
    } catch(e) { hideLoad(); throw e; }
  });
}

function _renderKependudukan() {
  const flt = _kpData.filter(r => {
    if (_kpFQ && _kpFQ.trim()) {
      /* Multi-keyword AND: semua kata harus ditemukan */
      const kws = _kpFQ.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const hay = ['nama','nik','alamat','noKK','tempatLahir','pekerjaan','agama',
                   'statusPernikahan','pendidikan','hubunganKeluarga','rt','rw']
                  .map(f => (r[f]||'').toString().toLowerCase()).join(' ');
      if (!kws.every(kw => hay.includes(kw))) return false;
    }
    if (_kpFRT && String(r.rt) !== String(_kpFRT)) return false;
    return true;
  });

  const tot   = flt.length;
  const pages = Math.max(1, Math.ceil(tot / PER));
  _kpPg       = Math.min(_kpPg, pages);
  const st    = (_kpPg - 1) * PER;
  const sl    = flt.slice(st, st + PER);

  let rows = '', cards = '';
  if (!sl.length) {
    const msg = _kpFQ ? `Tidak ada hasil untuk "${esc(_kpFQ)}"` : 'Tidak ada data penduduk';
    rows  = `<tr><td colspan="13"><div class="empty"><i class="fas fa-users"></i><p>${msg}</p></div></td></tr>`;
    cards = `<div class="empty"><i class="fas fa-users"></i><p>${msg}</p></div>`;
  } else {
    sl.forEach(r => {
      /* Normalise: sheet label 'Nama Lengkap' → key 'nama' */
      if (!r.nama && r.namaLengkap)       r.nama = r.namaLengkap;
      if (!r.nama && r['Nama Lengkap'])   r.nama = r['Nama Lengkap'];
      const ck  = rcSet(r);
      const jkC = r.jenisKelamin === 'L' ? 'ch-teal' : 'ch-red';
      let aksi = `<button class="be" onclick="openModalKP(rcGet('${ck}'),false)" title="Detail"><i class="fas fa-eye"></i></button>`;
      if (isAdmin()) aksi +=
        ` <button class="be" onclick="openModalKP(rcGet('${ck}'),true)" title="Edit"><i class="fas fa-pen"></i></button>` +
        ` <button class="bd" onclick="konfirmHapus('kp',rcGet('${ck}')._ri)"><i class="fas fa-trash"></i></button>`;

      rows += `<tr>
        <td style="font-family:var(--mono);font-size:.6rem">${esc(r.nik)}</td>
        <td style="font-family:var(--mono);font-size:.58rem">${esc(r.noKK)}</td>
        <td style="min-width:120px">${esc(r.nama)}</td>
        <td style="text-align:center"><span class="chip ${jkC}">${r.jenisKelamin==='L'?'L':'P'}</span></td>
        <td style="font-size:.62rem">${esc(r.tempatLahir||'—')}</td>
        <td style="font-size:.62rem;white-space:nowrap">${_fmtTglKP(r.tglLahir)}</td>
        <td style="font-size:.62rem">${esc(r.agama||'—')}</td>
        <td style="font-size:.6rem">${esc(r.statusPernikahan||'—')}</td>
        <td style="font-size:.6rem">${esc(r.pendidikan||'—')}</td>
        <td style="font-size:.6rem">${esc(r.pekerjaan||'—')}</td>
        <td style="font-size:.6rem">RT ${esc(r.rt||'?')}/RW ${esc(r.rw||'?')}</td>
        <td style="font-size:.6rem;max-width:160px"><span class="truncate">${esc(r.alamat||'—')}</span></td>
        <td style="white-space:nowrap">${aksi}</td>
      </tr>`;

      cards += `<div class="mcard-item">
        <div class="mcard-row">
          <span class="mcard-title">${esc(r.nama)}</span>
          <span class="chip ${jkC}">${r.jenisKelamin==='L'?'Laki-laki':'Perempuan'}</span>
        </div>
        <div class="mcard-meta" style="display:grid;grid-template-columns:1fr 1fr;gap:2px 10px">
          <span><i class="fas fa-id-card" style="width:12px;color:var(--muted)"></i> ${esc(r.nik||'—')}</span>
          <span><i class="fas fa-address-card" style="width:12px;color:var(--muted)"></i> KK: ${esc(r.noKK||'—')}</span>
          <span><i class="fas fa-birthday-cake" style="width:12px;color:var(--muted)"></i> ${esc(r.tempatLahir||'—')}, ${_fmtTglKP(r.tglLahir)}</span>
          <span><i class="fas fa-praying-hands" style="width:12px;color:var(--muted)"></i> ${esc(r.agama||'—')}</span>
          <span><i class="fas fa-briefcase" style="width:12px;color:var(--muted)"></i> ${esc(r.pekerjaan||'—')}</span>
          <span><i class="fas fa-graduation-cap" style="width:12px;color:var(--muted)"></i> ${esc(r.pendidikan||'—')}</span>
          <span style="grid-column:span 2"><i class="fas fa-location-dot" style="width:12px;color:var(--muted)"></i> ${esc(r.alamat||'—')} RT ${esc(r.rt||'?')}/${esc(r.rw||'?')}</span>
        </div>
        <div class="mcard-acts" style="margin-top:6px">${aksi}</div>
      </div>`;
    });
  }

  const rts    = [...new Set(['', ..._kpData.map(r => r.rt).filter(Boolean)])].sort();
  const rtOpts = rts.map(r => `<option value="${r}"${r===_kpFRT?' selected':''}>${!r?'Semua RT':'RT '+r}</option>`).join('');
  const addBtn = isAdmin() ? `<button class="bp" onclick="openModalKP(null,true)"><i class="fas fa-plus"></i> Tambah</button>` : '';

  G('ct').innerHTML = `<div class="fu"><div class="panel">
    <div class="phd">
      <span class="ptl"><i class="fas fa-id-card"></i>Data Penduduk</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span style="font-family:var(--mono);font-size:.75rem;color:var(--teal)">${tot} jiwa</span>
        ${addBtn}
      </div>
    </div>
    <div class="fbar">
      <div class="fsrch">
        <i class="fas fa-search fsi"></i>
        <input class="fctl" type="search" id="kp-q"
          placeholder="Ketik lalu Enter atau klik Cari..."
          oninput="_kpFiltLive(this.value)"
          onkeydown="if(event.key==='Enter'){clearTimeout(_kpFiltTimer);_renderKependudukan()}"
          value="${esc(_kpFQ)}" autocomplete="off">
      </div>
      <button class="bp bp-teal" onclick="clearTimeout(_kpFiltTimer);_kpFQ=(G('kp-q')||{}).value||'';_kpPg=1;_renderKependudukan()"
              style="flex:0 0 auto;white-space:nowrap"><i class="fas fa-search"></i> Cari</button>
      <select class="fctl" id="kp-rt" style="flex:0 0 120px"
              onchange="_kpFiltRT(this.value)">${rtOpts}</select>
      <button class="bg2" onclick="kpReset()"><i class="fas fa-rotate-left"></i></button>
    </div>
    <div class="twrap">
      <table class="dtbl"><thead><tr>
        <th>NIK</th><th>No. KK</th><th>Nama Lengkap</th><th>JK</th>
        <th>Tempat Lahir</th><th>Tgl Lahir</th><th>Agama</th><th>Status Nikah</th>
        <th>Pendidikan</th><th>Pekerjaan</th><th>RT/RW</th><th>Alamat</th><th>Aksi</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </div>
    <div class="mcard-list" style="padding:8px 12px">${cards}</div>
    <div class="pgw">
      <span>${pgInfo(st, tot, PER)}</span>
      <div class="pbs">${pgBtns(_kpPg, pages, p => { _kpPg = p; _renderKependudukan(); })}</div>
    </div>
  </div></div>`;
}

function _kpFiltLive(val) {
  _kpFQ = val; _kpPg = 1;
  clearTimeout(_kpFiltTimer);
  _kpFiltTimer = setTimeout(() => _renderKependudukan(), 600);
}
function _kpFiltRT(val)     { _kpFRT = val; _kpPg = 1; _renderKependudukan(); }
function kpFiltDebounce()   { _kpFiltLive((G('kp-q')||{}).value||''); }
function kpFilt()           { _kpFRT = (G('kp-rt')||{}).value||''; _kpPg = 1; _renderKependudukan(); }
function kpReset() {
  _kpFQ = ''; _kpFRT = ''; _kpPg = 1;
  const q=G('kp-q'), r=G('kp-rt');
  if (q) q.value=''; if (r) r.value='';
  _renderKependudukan();
}

function openModalKP(row, editable) {
  const ro = !editable ? ' readonly' : '';
  const ds = !editable ? ' disabled' : '';
  const agamaOpts = ['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu']
    .map(a=>`<option${row&&row.agama===a?' selected':''}>${a}</option>`).join('');
  const jkOpts =
    `<option value="L"${!row||row.jenisKelamin==='L'?' selected':''}>Laki-laki</option>` +
    `<option value="P"${row&&row.jenisKelamin==='P'?' selected':''}>Perempuan</option>`;
  const snOpts = ['Belum Menikah','Menikah','Cerai Hidup','Cerai Mati']
    .map(s=>`<option${row&&row.statusPernikahan===s?' selected':''}>${s}</option>`).join('');
  const pendOpts = ['','-','SD','SMP','SMA','D1','D2','D3','D4','S1','S2','S3']
    .map(p=>`<option value="${p}"${row&&row.pendidikan===p?' selected':''}>${!p?'Pilih...':p}</option>`).join('');
  const pkjOpts = ['','PNS/TNI/Polri','Karyawan Swasta','Wiraswasta','Petani','Nelayan',
    'Buruh','Pelajar/Mahasiswa','Ibu Rumah Tangga','Tidak Bekerja','Pensiunan','Lainnya']
    .map(p=>`<option value="${p}"${row&&row.pekerjaan===p?' selected':''}>${!p?'Pilih...':p}</option>`).join('');
  const hubOpts = ['Kepala Keluarga','Istri','Anak','Orang Tua','Mertua','Famili Lain','Lainnya']
    .map(h=>`<option${row&&row.hubunganKeluarga===h?' selected':''}>${h}</option>`).join('');

  const body = `
    <div class="frow2">
      <div class="fgrp"><label class="flbl" for="kp-nik">NIK <span class="req">*</span></label>
        <input class="fctl" id="kp-nik" value="${esc(row?row.nik:'')}"${ro} placeholder="16 digit NIK" inputmode="numeric" maxlength="16"></div>
      <div class="fgrp"><label class="flbl" for="kp-nokk">No. KK <span class="req">*</span></label>
        <input class="fctl" id="kp-nokk" value="${esc(row?row.noKK:'')}"${ro} placeholder="16 digit No. KK" inputmode="numeric" maxlength="16"></div>
    </div>
    <div class="fgrp"><label class="flbl" for="kp-nama">Nama Lengkap <span class="req">*</span></label>
      <input class="fctl" id="kp-nama" value="${esc(row?row.nama:'')}"${ro} placeholder="Nama sesuai KTP"></div>
    <div class="frow3">
      <div class="fgrp"><label class="flbl" for="kp-jk">Jenis Kelamin</label>
        <select class="fctl" id="kp-jk"${ds}>${jkOpts}</select></div>
      <div class="fgrp"><label class="flbl" for="kp-tpt">Tempat Lahir <span class="req">*</span></label>
        <input class="fctl" id="kp-tpt" value="${esc(row?row.tempatLahir:'')}"${ro}></div>
      <div class="fgrp"><label class="flbl" for="kp-tl">Tanggal Lahir <span class="req">*</span></label>
        <input class="fctl" type="date" id="kp-tl" value="${esc(row ? _toDateKP(row.tglLahir) : '')}"${ro}></div>
    </div>
    <div class="frow3">
      <div class="fgrp"><label class="flbl" for="kp-agama">Agama</label>
        <select class="fctl" id="kp-agama"${ds}>${agamaOpts}</select></div>
      <div class="fgrp"><label class="flbl" for="kp-sn">Status Nikah</label>
        <select class="fctl" id="kp-sn"${ds}>${snOpts}</select></div>
      <div class="fgrp"><label class="flbl" for="kp-pend">Pendidikan</label>
        <select class="fctl" id="kp-pend"${ds}>${pendOpts}</select></div>
    </div>
    <div class="fgrp"><label class="flbl" for="kp-alamat">Alamat <span class="req">*</span></label>
      <input class="fctl" id="kp-alamat" value="${esc(row?row.alamat:'')}"${ro} placeholder="Jl. ..."></div>
    <div class="frow4">
      <div class="fgrp"><label class="flbl" for="kp-rt2">RT <span class="req">*</span></label>
        <input class="fctl" id="kp-rt2" value="${esc(row?row.rt:'')}"${ro} inputmode="numeric" maxlength="3" placeholder="01"></div>
      <div class="fgrp"><label class="flbl" for="kp-rw2">RW <span class="req">*</span></label>
        <input class="fctl" id="kp-rw2" value="${esc(row?row.rw:'')}"${ro} inputmode="numeric" maxlength="3" placeholder="01"></div>
      <div class="fgrp" style="grid-column:span 2"><label class="flbl" for="kp-pkj">Pekerjaan</label>
        <select class="fctl" id="kp-pkj"${ds}>${pkjOpts}</select></div>
    </div>
    <div class="frow2">
      <div class="fgrp"><label class="flbl" for="kp-pkj-detail">Pekerjaan Detail</label>
        <input class="fctl" id="kp-pkj-detail" value="${esc(row?row.pekerjaanDetail:'')}"${ro} placeholder="Spesifik pekerjaan"></div>
      <div class="fgrp"><label class="flbl" for="kp-hub">Hub. Dalam Keluarga</label>
        <select class="fctl" id="kp-hub"${ds}>${hubOpts}</select></div>
    </div>`;

  const judul = editable ? (row?'Edit':'Tambah') : 'Detail';
  ensureModal('m-kp',
    `<div class="mbox"><div class="mhd">
      <h5><i class="fas fa-id-card" style="color:var(--teal)"></i>${judul} Penduduk</h5>
      <button class="bx" onclick="cm('m-kp')">&times;</button>
    </div>
    <div class="mbd" id="m-kp-body"></div>
    <div class="mft" id="m-kp-ft"></div></div>`);
  G('m-kp-body').innerHTML = body;
  G('m-kp-ft').innerHTML = `<button class="bg2" onclick="cm('m-kp')">Tutup</button>` +
    (editable ? ` <button class="bp bp-teal" onclick="submitKP(${row?JSON.stringify(row._ri):null})"><i class="fas fa-save"></i> Simpan</button>` : '');
  om('m-kp');
}

async function submitKP(ri) {
  const fv = id => (G(id)||{}).value||'';
  const req = { nik:fv('kp-nik'), noKK:fv('kp-nokk'), nama:fv('kp-nama'),
    tempatLahir:fv('kp-tpt'), tglLahir:fv('kp-tl'), alamat:fv('kp-alamat'),
    rt:fv('kp-rt2'), rw:fv('kp-rw2') };
  if (Object.values(req).some(v=>!v)) { toast('Field wajib belum diisi.','er'); return; }
  const payload = { ...req,
    jenisKelamin    :fv('kp-jk')        ||'L',
    agama           :fv('kp-agama')     ||'Islam',
    statusPernikahan:fv('kp-sn')        ||'Belum Menikah',
    pendidikan      :fv('kp-pend')      ||'',
    pekerjaan       :fv('kp-pkj')       ||'',
    pekerjaanDetail :fv('kp-pkj-detail')||'',
    hubunganKeluarga:fv('kp-hub')       ||'',
    createdBy       :SES.username,
  };
  if (ri!==null && ri!==undefined) payload._ri = ri;
  showLoad('Menyimpan...'); cm('m-kp');
  try {
    const res = await gasCall(ri!==null&&ri!==undefined?'updatePenduduk':'addPenduduk', payload);
    hideLoad();
    if (res.success) { toast('Data penduduk berhasil disimpan.','ok'); window._gcDel('penduduk'); loadKependudukan(); }
    else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}
