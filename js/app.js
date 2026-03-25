/* ═══════════════════════════════════════════════════════════════════
   SIMPATIH — js/app.js  (core + dashboard + buat surat +
                                agenda + arsip + laporan + pengaturan)
   ───────────────────────────────────────────────────────────────────
   Load order di index.html:
     api.js → ui.js → surat.js → penduduk.js → peta.js → app.js
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function loadDashboard() {
  setNav('db');
  setPage('Dashboard', 'Ringkasan data administrasi kelurahan');
  sbClose(); dAllCharts();

  /* ── Cek cache ── */
  const cached = window._gcGet('dashboard');
  if (cached) {
    renderDashboard(cached.d);
    window._gcRefresh('dashboard');
    return;
  }

  /* ── Tidak ada cache → fetch normal ── */
  await pageTransition(async () => {
    showLoad();
    try {
      const d = await gasCall('getDashboardData');
      hideLoad();
      if (!d||!d.success) { showErr(d&&d.message); return; }
      window._gcSet('dashboard', { d }); /* ← simpan ke cache */
      renderDashboard(d);
    } catch(e) { hideLoad(); throw e; }
  });
}

function renderDashboard(d) {
  const s = d.surat || {};
  const bd = G('badge-perm');
  if (bd) { bd.textContent=s.permMenunggu||0; bd.style.display=s.permMenunggu>0?'':'none'; }

  const aprBanner = (isAdmin()&&s.permMenunggu>0)
    ? `<div class="approval-banner">
        <i class="fas fa-bell"></i>
        <p>Ada <strong>${s.permMenunggu}</strong> permohonan menunggu approval.</p>
        <button class="bgold" onclick="loadSuratMasuk()" style="margin-left:auto;flex-shrink:0">
          <i class="fas fa-gavel"></i> Lihat</button>
       </div>` : '';

  G('ct').innerHTML = `<div class="fu">
    ${aprBanner}
    <div class="sgr">
      ${scCard('sc-navy','fa-envelope-open-text',s.totalMasuk ||0,'Surat Masuk')}
      ${scCard('sc-teal','fa-paper-plane',        s.totalKeluar||0,'Surat Keluar')}
      ${scCard('sc-gold','fa-file-circle-plus',   s.totalPerm  ||0,'Permohonan')}
      ${scCard('sc-green','fa-check-circle',      s.disetujui  ||0,'Disetujui')}
      ${scCard('sc-red','fa-clock',              s.menunggu   ||0,'Menunggu')}
    </div>
    <div class="cg2">
      <div>
        <div class="panel">
          <div class="phd"><span class="ptl"><i class="fas fa-chart-line"></i>Tren Surat 6 Bulan</span></div>
          <div class="pbd"><div class="chbox"><canvas id="ch-tren"></canvas></div></div>
        </div>
        ${_buildAgendaHariIni(d.agendaHariIni||[])}
      </div>
      <div>
        ${_buildStatPenduduk(d.penduduk||{})}
        ${_buildRekapBulan(d)}
      </div>
    </div>
    ${_buildPermohonanTerbaru(d.permohonanTerbaru||[])}
    <div id="stat-detail-area"></div>
  </div>`;

  const tren = d.trenSurat||[];
  if (tren.length && G('ch-tren') && typeof Chart!=='undefined') {
    _CH['tren'] = new Chart(G('ch-tren'),{ type:'line',
      data:{ labels:tren.map(t=>t.label),
        datasets:[
          { label:'Surat Masuk', data:tren.map(t=>t.masuk),
            borderColor:'#0a6880', backgroundColor:'rgba(10,104,128,.07)', tension:.35, borderWidth:2.5, pointRadius:4, fill:true },
          { label:'Surat Keluar', data:tren.map(t=>t.keluar),
            borderColor:'#c97b0e', backgroundColor:'rgba(201,123,14,.07)', tension:.35, borderWidth:2.5, pointRadius:4, fill:true },
        ] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}},
        scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{precision:0}}} } });
  }
}

function _buildAgendaHariIni(list) {
  let html = `<div class="panel"><div class="phd">
    <span class="ptl"><i class="fas fa-calendar-check"></i>Agenda Hari Ini</span>
    <span class="pulse-dot"></span>
  </div><div class="pbd">`;
  if (!list.length) {
    html += `<div class="empty" style="padding:18px"><i class="fas fa-calendar-xmark"></i><p>Tidak ada agenda hari ini</p></div>`;
  } else {
    list.forEach(a => {
      html += `<div class="agenda-item">
        <div class="agenda-time-box"><div class="agenda-time">${esc(a.waktu||'—')}</div></div>
        <div><div class="agenda-name">${esc(a.nama)}</div>
        <div class="agenda-loc"><i class="fas fa-location-dot" style="width:11px"></i>${esc(a.lokasi)}</div></div>
      </div>`;
    });
  }
  return html + '</div></div>';
}

function _buildStatPenduduk(p) {
  const total=p.total||0, ll=p.lakiLaki||0, pr=p.perempuan||0, perRT=p.perRT||[];
  let html = `<div class="panel"><div class="phd">
    <span class="ptl"><i class="fas fa-users"></i>Statistik Penduduk</span>
    <button class="be" onclick="toggleStatistikDetail(this)">
      <i class="fas fa-chart-bar"></i>Detail
    </button>
  </div><div class="pbd">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px">
      <div style="text-align:center;background:var(--bg);border-radius:7px;padding:8px">
        <div style="font-family:var(--mono);font-size:1.1rem;font-weight:500;color:var(--navy)">${total}</div>
        <div style="font-size:.52rem;font-weight:700;text-transform:uppercase;color:var(--muted)">Total</div>
      </div>
      <div style="text-align:center;background:var(--tealL);border-radius:7px;padding:8px">
        <div style="font-family:var(--mono);font-size:1.1rem;font-weight:500;color:var(--teal)">${ll}</div>
        <div style="font-size:.52rem;font-weight:700;text-transform:uppercase;color:var(--teal)">Laki-laki</div>
      </div>
      <div style="text-align:center;background:var(--redL);border-radius:7px;padding:8px">
        <div style="font-family:var(--mono);font-size:1.1rem;font-weight:500;color:var(--red2)">${pr}</div>
        <div style="font-size:.52rem;font-weight:700;text-transform:uppercase;color:var(--red2)">Perempuan</div>
      </div>
    </div>`;
  perRT.slice(0,4).forEach(r => {
    const pct = total ? Math.round(r.value/total*100) : 0;
    html += `<div class="pbar-wrap">
      <div class="pbar-lbl"><span>${esc(r.label)}</span><span style="font-family:var(--mono);color:var(--teal)">${r.value}</span></div>
      <div class="pbar-track"><div class="pbar-fill" style="width:${pct}%;background:var(--teal)"></div></div>
    </div>`;
  });
  return html + '</div></div>';
}

async function toggleStatistikDetail(btn) {
  const area = G('stat-detail-area'); if (!area) return;
  if (area.children.length > 0) {
    area.innerHTML = '';
    btn.innerHTML = '<i class="fas fa-chart-bar"></i>Detail';
    return;
  }
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Memuat...';
  btn.disabled  = true;
  try {
    const res = await gasCall('getStatistikDetail');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-chevron-up"></i>Tutup';
    if (!res.success) { toast('Gagal memuat statistik.','er'); return; }
    area.innerHTML = _buildStatistikInline(res.stat);
    _renderStatInlineCharts(res.stat);
    area.scrollIntoView({ behavior:'smooth', block:'start' });
  } catch(e) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-chart-bar"></i>Detail';
    toast('Error: '+e.message,'er');
  }
}

function _buildStatistikInline(s) {
  if (!s) return '';
  return `<div class="panel" style="margin-top:14px">
    <div class="phd">
      <span class="ptl"><i class="fas fa-chart-bar" style="color:var(--teal)"></i>Statistik Detail Kependudukan</span>
      <button class="be" onclick="loadKependudukan()"><i class="fas fa-id-card"></i> Lihat Data Lengkap</button>
    </div>
    <div class="pbd">
      <div class="sgr" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
        ${scCard('sc-navy','fa-users',      s.total||0,    'Total Penduduk')}
        ${scCard('sc-teal','fa-mars',       s.lakiLaki||0, 'Laki-laki')}
        ${scCard('sc-red', 'fa-venus',      s.perempuan||0,'Perempuan')}
        ${scCard('sc-gold','fa-house-user', Object.keys(s.perRT||{}).length,'Jumlah RT')}
      </div>
      <div class="cg2">
        <div>
          <div class="panel">
            <div class="phd"><span class="ptl"><i class="fas fa-chart-bar"></i>Penduduk per RT</span></div>
            <div class="pbd"><div class="chbox"><canvas id="ch-rt-db"></canvas></div></div>
          </div>
        </div>
        <div>
          <div class="panel">
            <div class="phd"><span class="ptl"><i class="fas fa-chart-pie"></i>Kelompok Usia</span></div>
            <div class="pbd"><div class="chbox-sm"><canvas id="ch-usia-db"></canvas></div></div>
          </div>
          <div class="panel">
            <div class="phd"><span class="ptl"><i class="fas fa-praying-hands"></i>Agama</span></div>
            <div class="pbd">${_buildPieList(s.perAgama||{})}</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function _renderStatInlineCharts(s) {
  if (!s) return;
  const rt=s.perRT||{}, rtK=Object.keys(rt).sort();
  if (G('ch-rt-db') && typeof Chart!=='undefined')
    _CH['rt-db'] = new Chart(G('ch-rt-db'),{ type:'bar',
      data:{ labels:rtK, datasets:[{ label:'Penduduk', data:rtK.map(k=>rt[k]),
        backgroundColor:'rgba(10,104,128,.15)', borderColor:'#0a6880', borderWidth:2, borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{precision:0}}} } });
  const usia=s.perUsia||{};
  if (G('ch-usia-db') && typeof Chart!=='undefined')
    _CH['usia-db'] = new Chart(G('ch-usia-db'),{ type:'doughnut',
      data:{ labels:Object.keys(usia), datasets:[{ data:Object.values(usia),
        backgroundColor:['rgba(10,104,128,.7)','rgba(4,120,87,.7)','rgba(201,123,14,.7)','rgba(201,28,59,.7)','rgba(109,40,217,.7)'],
        borderWidth:2 }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:'58%',
        plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}} } });
}

function _buildRekapBulan(d) {
  const s=d.surat||{};
  return `<div class="panel"><div class="phd">
    <span class="ptl"><i class="fas fa-chart-pie"></i>Ringkasan Bulan Ini</span>
  </div><div class="pbd">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${_miniStat('fa-envelope-open-text',s.totalMasuk   ||0,'Surat Masuk', 'var(--teal)')}
      ${_miniStat('fa-paper-plane',       s.totalKeluar  ||0,'Surat Keluar','var(--navy)')}
      ${_miniStat('fa-file-circle-plus',  s.totalPerm    ||0,'Permohonan',  'var(--gold2)')}
      ${_miniStat('fa-check-circle',      s.permDisetujui||0,'Disetujui',   'var(--green2)')}
    </div>
  </div></div>`;
}

function _miniStat(ico,n,lbl,c) {
  return `<div class="mini-stat">
    <div class="mini-stat-ico" style="background:${c}22">
      <i class="fas ${ico}" style="color:${c};font-size:.63rem"></i>
    </div>
    <div><div class="mini-stat-num">${n}</div><div class="mini-stat-lbl">${lbl}</div></div>
  </div>`;
}

function _buildPermohonanTerbaru(list) {
  if (!list.length) return '';
  const rows  = list.map(p=>`<tr>
    <td style="font-weight:600">${esc(p.nama)}</td><td>${esc(p.jenisSurat)}</td>
    <td style="font-size:.63rem;font-family:var(--mono)">${esc(p.ts)}</td>
    <td>${stsSuratChip(p.status)}</td>
  </tr>`).join('');
  const cards = list.map(p=>`<div class="mcard-item">
    <div class="mcard-row"><span class="mcard-title">${esc(p.nama)}</span>${stsSuratChip(p.status)}</div>
    <div class="mcard-meta">${esc(p.jenisSurat)} · ${esc(p.ts)}</div>
  </div>`).join('');
  return `<div class="panel"><div class="phd">
    <span class="ptl"><i class="fas fa-file-circle-plus"></i>Permohonan Terbaru</span>
    <button class="be" onclick="loadSuratMasuk()"><i class="fas fa-arrow-right"></i>Semua</button>
  </div>
  <div class="twrap"><table class="dtbl"><thead><tr>
    <th>Nama</th><th>Jenis Surat</th><th>Tanggal</th><th>Status</th>
  </tr></thead><tbody>${rows}</tbody></table></div>
  <div class="mcard-list" style="padding:8px 12px">${cards}</div>
  </div>`;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. BUAT SURAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function loadBuatSurat() {
  setNav('bs');
  setPage('Buat Surat','Buat surat resmi kelurahan dengan template');
  sbClose(); dAllCharts();
  const tpl = getTplSurat();

  G('ct').innerHTML = `<div class="fu"><div class="cg2e">
    <div><div class="panel">
      <div class="phd"><span class="ptl"><i class="fas fa-file-signature" style="color:var(--teal)"></i>Data Surat</span></div>
      <div class="pbd">
        <div class="fgrp"><label class="flbl" for="bs-jenis">Jenis / Judul Surat <span class="req">*</span></label>
          <select class="fctl" id="bs-jenis" onchange="bsPreview()">
            <option value="">-- Pilih Jenis Surat --</option>
            <option>Surat Keterangan Domisili</option>
            <option>Surat Keterangan Tidak Mampu</option>
            <option>Surat Keterangan Usaha</option>
            <option>Surat Pengantar</option>
            <option>Surat Keterangan Kelahiran</option>
            <option>Surat Keterangan Kematian</option>
            <option>Surat Keterangan Pindah</option>
            <option>Surat Keterangan Lainnya</option>
          </select></div>
        <div class="fgrp"><label class="flbl" for="bs-nomor">Nomor Surat</label>
          <input class="fctl" id="bs-nomor" placeholder="Kosongkan untuk otomatis" oninput="bsPreview()"></div>
        <div class="fgrp"><label class="flbl" for="bs-tanggal">Tanggal Surat <span class="req">*</span></label>
          <input class="fctl" type="date" id="bs-tanggal" oninput="bsPreview()"
                 value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="fgrp"><label class="flbl" for="bs-kepada">Ditujukan Kepada</label>
          <input class="fctl" id="bs-kepada" placeholder="Yth. Kepala Dinas / Instansi..." oninput="bsPreview()"></div>
        <hr style="border:none;border-top:1px solid var(--border);margin:4px 0 10px">
        <div style="font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px">
          Data Penerima / Yang Bersangkutan</div>
        <div class="frow2">
          <div class="fgrp"><label class="flbl" for="bs-nama">Nama Lengkap <span class="req">*</span></label>
            <input class="fctl" id="bs-nama" placeholder="Sesuai KTP" oninput="bsPreview()"></div>
          <div class="fgrp"><label class="flbl" for="bs-nik">NIK</label>
            <input class="fctl" id="bs-nik" placeholder="16 digit NIK" inputmode="numeric" maxlength="16" oninput="bsPreview()"></div>
        </div>
        <div class="frow3">
          <div class="fgrp"><label class="flbl" for="bs-tpt">Tempat Lahir</label>
            <input class="fctl" id="bs-tpt" placeholder="Kota" oninput="bsPreview()"></div>
          <div class="fgrp"><label class="flbl" for="bs-tl">Tanggal Lahir</label>
            <input class="fctl" type="date" id="bs-tl" oninput="bsPreview()"></div>
          <div class="fgrp"><label class="flbl" for="bs-agama">Agama</label>
            <select class="fctl" id="bs-agama" onchange="bsPreview()">
              ${['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu'].map(a=>`<option>${a}</option>`).join('')}
            </select></div>
        </div>
        <div class="frow3">
          <div class="fgrp"><label class="flbl" for="bs-jk">Jenis Kelamin</label>
            <select class="fctl" id="bs-jk" onchange="bsPreview()">
              <option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option>
            </select></div>
          <div class="fgrp"><label class="flbl" for="bs-rt">RT</label>
            <input class="fctl" id="bs-rt" placeholder="01" inputmode="numeric" maxlength="3" oninput="bsPreview()"></div>
          <div class="fgrp"><label class="flbl" for="bs-rw">RW</label>
            <input class="fctl" id="bs-rw" placeholder="01" inputmode="numeric" maxlength="3" oninput="bsPreview()"></div>
        </div>
        <div class="fgrp"><label class="flbl" for="bs-alamat">Alamat Lengkap <span class="req">*</span></label>
          <input class="fctl" id="bs-alamat" placeholder="Jl. Jenderal Sudirman No. ..." oninput="bsPreview()"></div>
        <div class="fgrp"><label class="flbl" for="bs-keperluan">Keperluan / Keterangan</label>
          <textarea class="fctl" id="bs-keperluan" rows="3"
                    placeholder="Jelaskan keperluan surat ini..." oninput="bsPreview()"></textarea></div>
        <div class="fgrp"><label class="flbl" for="bs-tembusan">Tembusan</label>
          <textarea class="fctl" id="bs-tembusan" rows="2"
                    placeholder="1. Arsip&#10;2. Yang bersangkutan"
                    oninput="bsPreview()">${esc(tpl.tembusan||'')}</textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="bp bp-teal" onclick="bsCetak()"><i class="fas fa-eye"></i> Preview &amp; Cetak</button>
          <button class="bg2" onclick="bsReset()"><i class="fas fa-rotate-left"></i> Reset</button>
          ${isAdmin()?`<button class="bp bp-gold" onclick="bsSimpanKeSuratKeluar()"><i class="fas fa-save"></i> Simpan ke Arsip</button>`:''}
        </div>
      </div>
    </div></div>
    <div><div class="panel" style="position:sticky;top:16px">
      <div class="phd">
        <span class="ptl"><i class="fas fa-file-alt" style="color:var(--navy)"></i>Preview Surat</span>
        <button class="bg2" style="font-size:.6rem" onclick="bsCetak()"><i class="fas fa-print"></i> Cetak</button>
      </div>
      <div id="bs-preview-area" style="padding:14px;background:#f8f9fb;min-height:400px;border-radius:0 0 10px 10px">
        <div class="empty" style="padding:44px 10px">
          <i class="fas fa-file-signature" style="font-size:2rem;opacity:.1;display:block;margin-bottom:8px"></i>
          <p style="font-size:.7rem">Isi form di kiri untuk melihat preview surat</p>
        </div>
      </div>
    </div></div>
  </div></div>`;
}

function bsPreview() {
  const fv = id => (G(id)||{}).value||'';
  const area=G('bs-preview-area'); if (!area) return;
  const jenis=fv('bs-jenis'), nama=fv('bs-nama');
  if (!jenis||!nama) {
    area.innerHTML=`<div class="empty" style="padding:44px 10px">
      <i class="fas fa-file-signature" style="font-size:2rem;opacity:.1;display:block;margin-bottom:8px"></i>
      <p style="font-size:.7rem">Isi Jenis Surat dan Nama Penerima untuk melihat preview</p></div>`;
    return;
  }
  const tpl=getTplSurat();
  const tglRaw=fv('bs-tanggal');
  const tglStr=tglRaw?_tglStr(new Date(tglRaw+'T00:00:00')):_tglStr(new Date());
  const tlRaw=fv('bs-tl'), tlStr=tlRaw?_tglStr(new Date(tlRaw+'T00:00:00')):'';
  const nomor=fv('bs-nomor')||'_____ / _____ / '+new Date().getFullYear();
  const kepada=fv('bs-kepada'), nik=fv('bs-nik'), tpt=fv('bs-tpt');
  const agama=fv('bs-agama')||'Islam', jk=fv('bs-jk')||'Laki-laki';
  const rt=fv('bs-rt'), rw=fv('bs-rw'), perlu=fv('bs-keperluan'), tbs=fv('bs-tembusan');
  const alamat=fv('bs-alamat');

  const _logoSrc = tpl.logoKiri || 'assets/icon-full.png';
  const _logoR   = tpl.logoKanan ? `<img src="${esc(tpl.logoKanan)}" style="width:70px;height:70px;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'">` : '<div style="width:70px"></div>';
  area.innerHTML = `<div style="font-family:'Times New Roman',serif;font-size:10pt;color:#000;line-height:1.5;background:#fff;padding:16px;border:1px solid #ddd;border-radius:6px">
    <div style="display:flex;align-items:center;gap:10px;border-bottom:2.5px double #000;padding-bottom:10px;margin-bottom:12px">
      <img src="${esc(_logoSrc)}" style="width:70px;height:70px;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'" alt="Logo">
      <div style="flex:1;text-align:center;font-size:8pt">
        <div style="font-weight:bold;font-size:9pt">${esc(tpl.instansi1)}</div>
        <div style="font-weight:bold">${esc(tpl.instansi2)}</div>
        <div style="font-weight:bold;font-size:10pt">${esc(tpl.dinas)}</div>
        <div style="font-size:7pt">${esc(tpl.alamat)}</div>
      </div>
      ${_logoR}
    </div>
    <div style="text-align:center;font-weight:bold;text-decoration:underline;margin-bottom:4px;font-size:10pt">${esc(jenis).toUpperCase()}</div>
    <div style="text-align:center;font-size:8.5pt;margin-bottom:12px">Nomor: ${esc(nomor)}</div>
    ${kepada?`<div style="margin-bottom:8px;font-size:9pt">Kepada Yth.<br>${esc(kepada).replace(/\n/g,'<br>')}</div>`:''}
    <div style="font-size:9pt;margin-bottom:10px">Yang bertanda tangan di bawah ini ${esc(tpl.jabatanTtd)} ${esc(tpl.dinas)}, menerangkan bahwa:</div>
    <table style="font-size:9pt;width:100%;margin-bottom:10px">
      <tr><td style="width:130px">Nama</td><td>: <strong>${esc(nama)}</strong></td></tr>
      ${nik?`<tr><td>NIK</td><td>: ${esc(nik)}</td></tr>`:''}
      ${(tpt||tlStr)?`<tr><td>Tempat / Tgl. Lahir</td><td>: ${esc(tpt||'—')} / ${esc(tlStr||'—')}</td></tr>`:''}
      <tr><td>Jenis Kelamin</td><td>: ${esc(jk)}</td></tr>
      <tr><td>Agama</td><td>: ${esc(agama)}</td></tr>
      ${alamat?`<tr><td>Alamat</td><td>: ${esc(alamat)}${rt?` RT ${esc(rt)}`:''}${rw?`/RW ${esc(rw)}`:''}</td></tr>`:''}
      ${perlu?`<tr><td>Keperluan</td><td>: ${esc(perlu)}</td></tr>`:''}
    </table>
    <div style="font-size:9pt;margin-bottom:16px">Demikian surat keterangan ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.</div>
    <div style="display:flex;justify-content:flex-end;font-size:9pt">
      <div style="text-align:center">
        <div>Ponorogo, ${esc(tglStr)}</div>
        <div>${esc(tpl.jabatanTtd)}</div>
        <div style="margin-top:44px;font-weight:bold;text-decoration:underline">${esc(tpl.namaTtd)}</div>
        <div>${esc(tpl.nipTtd)}</div>
      </div>
    </div>
    ${tbs?`<div style="font-size:8pt;margin-top:10px;border-top:1px solid #ccc;padding-top:6px">
      <strong>Tembusan:</strong><br>${esc(tbs).replace(/\n/g,'<br>')}
    </div>`:''}
  </div>`;
}

async function bsCetak() {
  const fv=id=>(G(id)||{}).value||'';
  const jenis=fv('bs-jenis'), nama=fv('bs-nama');
  if (!jenis||!nama) { toast('Isi minimal Jenis Surat dan Nama terlebih dahulu.','er'); return; }
  const tpl=getTplSurat();
  const tglRaw=fv('bs-tanggal'), tglStr=tglRaw?_tglStr(new Date(tglRaw+'T00:00:00')):_tglStr(new Date());
  const tlRaw=fv('bs-tl'), tlStr=tlRaw?_tglStr(new Date(tlRaw+'T00:00:00')):'';
  const nomor=fv('bs-nomor')||'_____ / _____ / '+new Date().getFullYear();
  const kepada=fv('bs-kepada'), tbs=fv('bs-tembusan');
  const r={ nama, nik:fv('bs-nik'), tempatLahir:fv('bs-tpt'), tglLahir:tlStr,
    agama:fv('bs-agama')||'Islam', jenisKelamin:fv('bs-jk')||'Laki-laki',
    alamat:fv('bs-alamat'), rt:fv('bs-rt'), rw:fv('bs-rw'),
    keperluan:fv('bs-keperluan'), nomorSurat:nomor, jenisSurat:jenis };
  let html=_buildKopHtml(tpl);
  html+=`<div class="judul">${esc(r.jenisSurat)}</div>
    <div class="no-surat">Nomor: ${esc(r.nomorSurat)}</div>
    ${kepada?`<p style="margin-bottom:12px;font-size:11pt">Kepada Yth.<br>${esc(kepada).replace(/\n/g,'<br>')}</p><br>`:''}
    <p style="margin-bottom:10px;font-size:11pt">Yang bertanda tangan di bawah ini ${esc(tpl.jabatanTtd)} ${esc(tpl.dinas)}, menerangkan bahwa:</p>
    <table class="isi">
      <tr><td>Nama</td><td>: <strong>${esc(r.nama)}</strong></td></tr>
      ${r.nik?`<tr><td>NIK</td><td>: ${esc(r.nik)}</td></tr>`:''}
      ${(r.tempatLahir||r.tglLahir)?`<tr><td>Tempat / Tgl. Lahir</td><td>: ${esc(r.tempatLahir||'—')} / ${esc(r.tglLahir||'—')}</td></tr>`:''}
      <tr><td>Jenis Kelamin</td><td>: ${esc(r.jenisKelamin)}</td></tr>
      <tr><td>Agama</td><td>: ${esc(r.agama)}</td></tr>
      ${r.alamat?`<tr><td>Alamat</td><td>: ${esc(r.alamat)}${r.rt?` RT ${esc(r.rt)}`:''}${r.rw?`/RW ${esc(r.rw)}`:''}</td></tr>`:''}
      ${r.keperluan?`<tr><td>Keperluan</td><td>: ${esc(r.keperluan)}</td></tr>`:''}
    </table>
    <p style="margin-top:14px;font-size:11pt">Demikian surat keterangan ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.</p>`;
  html+=_buildKopFooter(tpl,'Ponorogo',tglStr,tbs);
  _setCetakSrcdoc(html);
}

function bsReset() {
  ['bs-jenis','bs-nomor','bs-kepada','bs-nama','bs-nik','bs-tpt','bs-tl','bs-rt','bs-rw','bs-alamat','bs-keperluan']
    .forEach(id=>{ const el=G(id); if(el) el.value=''; });
  const tgl=G('bs-tanggal'); if(tgl) tgl.value=new Date().toISOString().split('T')[0];
  const area=G('bs-preview-area');
  if(area) area.innerHTML=`<div class="empty" style="padding:44px 10px">
    <i class="fas fa-file-signature" style="font-size:2rem;opacity:.1;display:block;margin-bottom:8px"></i>
    <p style="font-size:.7rem">Isi form di kiri untuk melihat preview surat</p></div>`;
}

async function bsSimpanKeSuratKeluar() {
  const fv=id=>(G(id)||{}).value||'';
  const jenis=fv('bs-jenis'), nama=fv('bs-nama'), tgl=fv('bs-tanggal');
  if (!jenis||!nama||!tgl) { toast('Jenis surat, nama, dan tanggal wajib diisi.','er'); return; }
  showLoad('Menyimpan ke arsip...');
  try {
    const res=await gasCall('addSurat',{ tipe:'keluar', jenis, nomorSurat:fv('bs-nomor'),
      tglSurat:tgl, perihal:jenis+' - '+nama, pengirim:'Kelurahan Kepatihan',
      penerima:nama, catatan:fv('bs-keperluan'), tembusan:fv('bs-tembusan'), createdBy:SES.username });
    hideLoad();
    if(res.success) {
      toast('Surat berhasil disimpan ke Arsip Surat Keluar.','ok');
      window._gcDel('suratKeluar'); /* ← pindah ke dalam if */
      window._gcDel('laporan');     /* ← pindah ke dalam if */
    } else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. AGENDA & KALENDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function loadAgenda() {
  setNav('ag');
  setPage('Agenda Kegiatan','Jadwal kegiatan resmi kelurahan');
  sbClose(); dAllCharts();

  /* ── Cek cache ── */
  const cached = window._gcGet('agenda');
  if (cached) {
    _agData = cached.res.data || [];
    _agPg = 1; _agFQ = '';
    const now = new Date();
    _agFBulan = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    _renderAgenda();
    window._gcRefresh('agenda');
    return;
  }

  /* ── Tidak ada cache → fetch normal ── */
  _agData=[]; _agPg=1; _agFQ='';
  const now=new Date();
  _agFBulan=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  await pageTransition(async () => {
    showLoad();
    try {
      const res=await gasCall('getAllAgenda',{});
      hideLoad();
      _agData=res.data||[];
      window._gcSet('agenda', { res }); /* ← simpan ke cache */
      _renderAgenda();
    } catch(e) { hideLoad(); throw e; }
  });
}

function _renderAgenda() {
  const flt=_agData.filter(r=>{
    if (_agFQ) { const q=_agFQ.toLowerCase();
      if (!(r.nama||'').toLowerCase().includes(q)&&!(r.lokasi||'').toLowerCase().includes(q)&&!(r.pj||'').toLowerCase().includes(q)) return false; }
    if (_agFBulan&&(!r.tanggal||r.tanggal.substring(0,7)!==_agFBulan)) return false;
    return true;
  });
  const tot=flt.length, pages=Math.max(1,Math.ceil(tot/PER));
  _agPg=Math.min(_agPg,pages);
  const st=(_agPg-1)*PER, sl=flt.slice(st,st+PER);

  let rows='',cards='';
  if (!sl.length) {
    rows =`<tr><td colspan="6"><div class="empty"><i class="fas fa-calendar-xmark"></i><p>Tidak ada agenda</p></div></td></tr>`;
    cards=`<div class="empty"><i class="fas fa-calendar-xmark"></i><p>Tidak ada agenda</p></div>`;
  } else {
    sl.forEach(r=>{
      const ck=rcSet(r);
      const aksi=isAdmin()
        ?`<button class="be" onclick="openModalAgenda(rcGet('${ck}'))"><i class="fas fa-pen"></i></button> `+
         `<button class="bd" onclick="konfirmHapus('agenda',rcGet('${ck}')._ri)"><i class="fas fa-trash"></i></button>`
        :`<button class="be" onclick="openModalAgenda(rcGet('${ck}'),true)"><i class="fas fa-eye"></i></button>`;
      rows+=`<tr>
        <td style="font-size:.64rem;white-space:nowrap">${esc(r.tanggal)}</td>
        <td style="font-weight:600">${esc(r.nama)}</td>
        <td style="font-size:.64rem;color:var(--muted)">${esc(r.waktu||'—')}</td>
        <td style="font-size:.64rem">${esc(r.lokasi)}</td>
        <td style="font-size:.64rem;color:var(--mid)">${esc(r.pj)}</td>
        <td style="white-space:nowrap">${aksi}</td>
      </tr>`;
      cards+=`<div class="mcard-item">
        <div class="mcard-row"><span class="mcard-title">${esc(r.nama)}</span>
          <span class="sts-chip sts-aktif" style="font-size:.5rem">${esc(r.tanggal)}</span></div>
        <div class="mcard-meta">
          <i class="fas fa-clock" style="width:12px;color:var(--gold)"></i>${esc(r.waktu||'—')}
          <i class="fas fa-location-dot" style="width:12px;color:var(--teal);margin-left:6px"></i>${esc(r.lokasi)}
        </div>
        <div class="mcard-acts">${aksi}</div>
      </div>`;
    });
  }

  const addBtn=isAdmin()?`<button class="bp" onclick="openModalAgenda(null)"><i class="fas fa-plus"></i> Tambah</button>`:'';
  G('ct').innerHTML=`<div class="fu"><div class="cg2">
    <div><div class="panel">
      <div class="phd">
        <span class="ptl"><i class="fas fa-calendar-days"></i>Daftar Agenda</span>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:.63rem;color:var(--muted);font-family:var(--mono)">${tot}</span>${addBtn}
        </div>
      </div>
      <div class="fbar">
        <div class="fsrch"><i class="fas fa-search fsi"></i>
          <input class="fctl" type="search" id="ag-q" placeholder="Cari kegiatan, lokasi, PJ..."
            oninput="_agFiltLive(this.value)" value="${esc(_agFQ)}" autocomplete="off"></div>
        <input class="fctl" type="month" id="ag-bulan" value="${_agFBulan}"
               onchange="_agFiltBulan(this.value)" style="flex:0 0 140px">
        <button class="bg2" onclick="agReset()"><i class="fas fa-rotate-left"></i></button>
      </div>
      <div class="twrap"><table class="dtbl"><thead><tr>
        <th>Tanggal</th><th>Kegiatan</th><th>Waktu</th><th>Lokasi</th><th>PJ</th><th>Aksi</th>
      </tr></thead><tbody>${rows}</tbody></table></div>
      <div class="mcard-list" style="padding:8px 12px">${cards}</div>
      <div class="pgw">
        <span>${pgInfo(st,tot,PER)}</span>
        <div class="pbs">${pgBtns(_agPg,pages,p=>{_agPg=p;_renderAgenda();})}</div>
      </div>
    </div></div>
    <div><div class="panel">
      <div class="phd"><span class="ptl"><i class="fas fa-calendar"></i>Kalender</span></div>
      <div class="cal-wrap" id="cal-wrap">${_renderKalender(_calYear,_calMonth)}</div>
    </div></div>
  </div></div>`;
}

function _agFiltLive(val) { _agFQ=val; _agPg=1; clearTimeout(_agFiltTimer); _agFiltTimer=setTimeout(()=>_renderAgenda(),180); }
function _agFiltBulan(val){ _agFBulan=val; _agPg=1; _renderAgenda(); }
function agFiltDebounce() { _agFiltLive((G('ag-q')||{}).value||''); }
function agFilt()         { _agFBulan=(G('ag-bulan')||{}).value||''; _agPg=1; _renderAgenda(); }
function agReset() {
  const now=new Date(); _agFQ='';
  _agFBulan=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  _agPg=1; _renderAgenda();
}

function openModalAgenda(row, viewOnly) {
  const editable=!viewOnly||isAdmin();
  const ro=editable?'':' readonly', ds=editable?'':' disabled';
  const body=`
    <div class="fgrp"><label class="flbl" for="ag-nama">Nama Kegiatan <span class="req">*</span></label>
      <input class="fctl" id="ag-nama" value="${esc(row?row.nama:'')}" placeholder="Nama kegiatan"${ro}></div>
    <div class="frow2">
      <div class="fgrp"><label class="flbl" for="ag-tgl">Tanggal <span class="req">*</span></label>
        <input class="fctl" type="date" id="ag-tgl" value="${esc(row?row.tanggal:'')}"${ro}></div>
      <div class="fgrp"><label class="flbl" for="ag-wkt">Waktu</label>
        <input class="fctl" type="time" id="ag-wkt" value="${esc(row?row.waktu:'')}"${ro}></div>
    </div>
    <div class="fgrp"><label class="flbl" for="ag-lok">Lokasi <span class="req">*</span></label>
      <input class="fctl" id="ag-lok" value="${esc(row?row.lokasi:'')}" placeholder="Lokasi kegiatan"${ro}></div>
    <div class="frow2">
      <div class="fgrp"><label class="flbl" for="ag-pj">Penanggung Jawab</label>
        <input class="fctl" id="ag-pj" value="${esc(row?row.pj:'')}"${ro}></div>
      <div class="fgrp"><label class="flbl" for="ag-sts">Status</label>
        <select class="fctl" id="ag-sts"${ds}>
          ${['Aktif','Selesai','Batal'].map(s=>`<option${row&&row.status===s?' selected':''}>${s}</option>`).join('')}
        </select></div>
    </div>
    <div class="fgrp"><label class="flbl" for="ag-ket">Keterangan</label>
      <textarea class="fctl" id="ag-ket" rows="2"${ro}>${esc(row?row.keterangan:'')}</textarea></div>`;
  const judul=row?(!editable?'Detail':'Edit'):'Tambah';
  ensureModal('m-ag',
    `<div class="mbox"><div class="mhd">
      <h5><i class="fas fa-calendar-plus" style="color:var(--teal)"></i>${judul} Agenda</h5>
      <button class="bx" onclick="cm('m-ag')">&times;</button>
    </div>
    <div class="mbd" id="m-ag-body"></div>
    <div class="mft" id="m-ag-ft"></div></div>`);
  G('m-ag-body').innerHTML=body;
  G('m-ag-ft').innerHTML=`<button class="bg2" onclick="cm('m-ag')">${editable?'Batal':'Tutup'}</button>`+
    (editable?` <button class="bp bp-teal" onclick="submitAgenda(${row?JSON.stringify(row._ri):null})"><i class="fas fa-save"></i> Simpan</button>`:'');
  om('m-ag');
}

async function submitAgenda(ri) {
  const fv=id=>(G(id)||{}).value||'';
  const nama=fv('ag-nama'),tgl=fv('ag-tgl'),lok=fv('ag-lok');
  if (!nama||!tgl||!lok) { toast('Field wajib belum diisi.','er'); return; }
  const payload={nama,tanggal:tgl,waktu:fv('ag-wkt'),lokasi:lok,
    pj:fv('ag-pj'),keterangan:fv('ag-ket'),status:fv('ag-sts')||'Aktif',createdBy:SES.username};
  if (ri!==null&&ri!==undefined) payload._ri=ri;
  showLoad('Menyimpan...'); cm('m-ag');
  try {
    const res=await gasCall(ri!==null&&ri!==undefined?'updateAgenda':'addAgenda',payload);
    hideLoad();
    if(res.success) { toast('Agenda berhasil disimpan.','ok');
    window._gcDel('agenda'); window._gcDel('dashboard'); loadAgenda(); }
    else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. ARSIP DOKUMEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function loadArsip() {
  setNav('ar');
  setPage('Arsip Dokumen','Dokumen resmi kelurahan');
  sbClose(); dAllCharts();

  /* ── Cek cache ── */
  const cached = window._gcGet('arsip');
  if (cached) {
    _arsipData = cached.res.data || [];
    _arsipPg = 1; _arsipFQ = ''; _arsipFKat = '';
    _renderArsip();
    window._gcRefresh('arsip');
    return;
  }

  /* ── Tidak ada cache → fetch normal ── */
  _arsipData=[]; _arsipPg=1; _arsipFQ=''; _arsipFKat='';
  await pageTransition(async () => {
    showLoad();
    try {
      const res=await gasCall('getAllArsip',{});
      hideLoad();
      _arsipData=res.data||[];
      window._gcSet('arsip', { res }); /* ← simpan ke cache */
      _renderArsip();
    } catch(e) { hideLoad(); throw e; }
  });
}

function _renderArsip() {
  const flt=_arsipData.filter(r=>{
    if (_arsipFQ) { const q=_arsipFQ.toLowerCase();
      if (!(r.judul||'').toLowerCase().includes(q)&&!(r.keterangan||'').toLowerCase().includes(q)&&!(r.createdBy||'').toLowerCase().includes(q)) return false; }
    if (_arsipFKat&&r.kategori!==_arsipFKat) return false;
    return true;
  });
  const tot=flt.length, pages=Math.max(1,Math.ceil(tot/PER));
  _arsipPg=Math.min(_arsipPg,pages);
  const st=(_arsipPg-1)*PER, sl=flt.slice(st,st+PER);

  let rows='',cards='';
  if (!sl.length) {
    const msg=_arsipFQ?`Tidak ada hasil untuk "${esc(_arsipFQ)}"` : 'Tidak ada arsip';
    rows =`<tr><td colspan="6"><div class="empty"><i class="fas fa-folder-open"></i><p>${msg}</p></div></td></tr>`;
    cards=`<div class="empty"><i class="fas fa-folder-open"></i><p>${msg}</p></div>`;
  } else {
    sl.forEach(r=>{
      const ck=rcSet(r);
      const _arFid = r.fileUrl?(/\/file\/d\/([^/?#]+)/.exec(r.fileUrl)||[])[1]||'':'';
      const prevBtn = r.fileUrl?`<button class="be" title="Preview" onclick="previewFile('${esc(r.fileUrl)}','${esc(r.judul)}')"><i class="fas fa-eye"></i></button> `:'';
      const dlBtn   = _arFid?`<a href="https://drive.google.com/uc?export=download&id=${_arFid}" class="be" title="Download" download><i class="fas fa-download"></i></a> `:'';
      const drvBtn  = r.fileUrl?`<a href="${esc(r.fileUrl)}" target="_blank" rel="noopener" class="be" title="Buka Drive" style="text-decoration:none"><i class="fas fa-external-link-alt"></i></a> `:'';
      const aksi=prevBtn+dlBtn+drvBtn+(isAdmin()?`<button class="bd" onclick="konfirmHapus('arsip',rcGet('${ck}')._ri)"><i class="fas fa-trash"></i></button>`:'');
      const _tglAr = (typeof _fmtTglKP==='function') ? _fmtTglKP(r.tglDok) : (r.tglDok||'—');
      rows+=`<tr>
        <td style="font-weight:600;min-width:140px">${esc(r.judul)}</td>
        <td style="white-space:nowrap"><span class="chip ch-teal">${esc(r.kategori)}</span></td>
        <td style="font-size:.63rem;white-space:nowrap">${_tglAr}</td>
        <td style="font-size:.64rem;color:var(--mid)">${esc(r.keterangan||'—')}</td>
        <td style="font-size:.6rem;font-family:var(--mono);white-space:nowrap">${esc(r.createdBy)}</td>
        <td style="white-space:nowrap">${aksi}</td>
      </tr>`;
      cards+=`<div class="mcard-item">
        <div class="mcard-row"><span class="mcard-title">${esc(r.judul)}</span><span class="chip ch-teal">${esc(r.kategori)}</span></div>
        <div class="mcard-meta">${_tglAr}${r.keterangan?' · '+esc(r.keterangan):''}</div>
        <div class="mcard-acts">${aksi}</div>
      </div>`;
    });
  }

  const _KAT=['Peraturan','Laporan Kegiatan','Musrenbang','Rapat','Administrasi','Lainnya'];
  const katOpts=`<option value="">Semua Kategori</option>`+
    _KAT.map(k=>`<option value="${k}"${k===_arsipFKat?' selected':''}>${k}</option>`).join('');

  G('ct').innerHTML=`<div class="fu"><div class="panel">
    <div class="phd">
      <span class="ptl"><i class="fas fa-folder-open"></i>Arsip Dokumen</span>
      <div style="display:flex;gap:6px;align-items:center">
        <span style="font-size:.63rem;color:var(--muted);font-family:var(--mono)">${tot}</span>
        ${isAdmin()?`<button class="bp" onclick="openModalArsip()"><i class="fas fa-plus"></i> Upload</button>`:''}
      </div>
    </div>
    <div class="fbar">
      <div class="fsrch"><i class="fas fa-search fsi"></i>
        <input class="fctl" type="search" id="ar-q"
          placeholder="Ketik lalu Enter atau klik Cari..."
          oninput="_arsipFiltLive(this.value)"
          onkeydown="if(event.key==='Enter'){clearTimeout(_arsipFiltTimer);_renderArsip()}"
          value="${esc(_arsipFQ)}" autocomplete="off"></div>
      <button class="bp bp-teal" onclick="clearTimeout(_arsipFiltTimer);_arsipFQ=(G('ar-q')||{}).value||'';_arsipPg=1;_renderArsip()"
              style="flex:0 0 auto;white-space:nowrap"><i class="fas fa-search"></i> Cari</button>
      <select class="fctl" id="ar-kat" style="flex:0 0 170px"
              onchange="_arsipFiltKat(this.value)">${katOpts}</select>
      <button class="bg2" onclick="arsipReset()"><i class="fas fa-rotate-left"></i></button>
    </div>
    <div class="twrap"><table class="dtbl"><thead><tr>
      <th>Judul</th><th>Kategori</th><th>Tanggal</th><th>Keterangan</th><th>Uploader</th><th>Aksi</th>
    </tr></thead><tbody>${rows}</tbody></table></div>
    <div class="mcard-list" style="padding:8px 12px">${cards}</div>
    <div class="pgw">
      <span>${pgInfo(st,tot,PER)}</span>
      <div class="pbs">${pgBtns(_arsipPg,pages,p=>{_arsipPg=p;_renderArsip();})}</div>
    </div>
  </div></div>`;
}

function _arsipFiltLive(val){ _arsipFQ=val; _arsipPg=1; clearTimeout(_arsipFiltTimer); _arsipFiltTimer=setTimeout(()=>_renderArsip(),600); }
function _arsipFiltKat(val) { _arsipFKat=val; _arsipPg=1; _renderArsip(); }
function arsipFiltDebounce(){ _arsipFiltLive((G('ar-q')||{}).value||''); }
function arsipFilt()        { _arsipFKat=(G('ar-kat')||{}).value||''; _arsipPg=1; _renderArsip(); }
function arsipReset()       { _arsipFQ=''; _arsipFKat=''; _arsipPg=1; _renderArsip(); }

function openModalArsip() {
  const _KAT=['Peraturan','Laporan Kegiatan','Musrenbang','Rapat','Administrasi','Lainnya'];
  const today=new Date().toISOString().split('T')[0];
  const body=`
    <div class="fgrp"><label class="flbl" for="ar-judul">Judul Dokumen <span class="req">*</span></label>
      <input class="fctl" id="ar-judul" placeholder="Judul dokumen"></div>
    <div class="frow2">
      <div class="fgrp"><label class="flbl" for="ar-kategori">Kategori <span class="req">*</span></label>
        <select class="fctl" id="ar-kategori">${_KAT.map(k=>`<option value="${k}">${k}</option>`).join('')}</select></div>
      <div class="fgrp"><label class="flbl" for="ar-tgl">Tanggal</label>
        <input class="fctl" type="date" id="ar-tgl" value="${today}"></div>
    </div>
    <div class="fgrp"><label class="flbl" for="ar-ket">Keterangan</label>
      <textarea class="fctl" id="ar-ket" rows="2" placeholder="Deskripsi singkat dokumen"></textarea></div>
    <div class="fgrp"><label class="flbl">Upload File</label>
      ${_buildUploadHtml('ar','.pdf,.doc,.docx,.jpg,.jpeg,.png')}
    </div>`;
  ensureModal('m-ar',
    `<div class="mbox"><div class="mhd">
      <h5><i class="fas fa-folder-plus" style="color:var(--gold)"></i>Upload Arsip</h5>
      <button class="bx" onclick="cm('m-ar')">&times;</button>
    </div>
    <div class="mbd" id="m-ar-body"></div>
    <div class="mft" id="m-ar-ft"></div></div>`);
  G('m-ar-body').innerHTML=body;
  G('m-ar-ft').innerHTML=
    `<button class="bg2" onclick="cm('m-ar')">Batal</button>
     <button class="bp bp-gold" onclick="submitArsip()"><i class="fas fa-upload"></i> Upload</button>`;
  om('m-ar');
}

async function submitArsip() {
  const fv=id=>(G(id)||{}).value||'';
  const judul=fv('ar-judul'), kat=fv('ar-kategori');
  if (!judul||!kat) { toast('Field wajib belum diisi.','er'); return; }
  const payload={judul,kategori:kat,tglDok:fv('ar-tgl'),keterangan:fv('ar-ket'),createdBy:SES.username};
  const fc = (_fileMultiCache['ar']||[])[0] || _fileCache['ar'];
  if(fc) {
    payload.fileData=fc.data; payload.fileMime=fc.mime;
    const ext=(fc.mime||'').split('/')[1]||'bin';
    payload.fileName=_fmtFileName?_fmtFileName(judul,'','',(fc.name||'').split('.').pop()||ext):(judul.replace(/[^a-z0-9]/gi,'_')+'.'+ext);
  }
  showLoad('Mengupload...'); cm('m-ar');
  _fileMultiCache['ar']=[]; delete _fileCache['ar'];
  try {
    const res=await gasCall('addArsip',payload);
    hideLoad();
    if(res.success) { toast('Dokumen berhasil diupload.','ok'); window._gcDel('arsip'); loadArsip(); }
    else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. LAPORAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function loadLaporan() {
  setNav('lap');
  setPage('Laporan','Ringkasan administrasi kelurahan');
  sbClose(); dAllCharts();
  const now=new Date();
  const bulan=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');

  /* ── Cek cache ── */
  const cached = window._gcGet('laporan');
  if (cached && cached.bulan === bulan) {
    _renderLaporan(cached.res);
    window._gcRefresh('laporan');
    return;
  }

  /* ── Tidak ada cache / beda bulan → fetch normal ── */
  await pageTransition(async () => {
    showLoad();
    try {
      const res=await gasCall('getLaporanData',{bulan});
      hideLoad();
      window._gcSet('laporan', { res, bulan }); /* ← simpan ke cache */
      _renderLaporan(res);
    } catch(e) { hideLoad(); throw e; }
  });
}

function _renderLaporan(d) {
  if (!d||!d.success) { showErr(d&&d.message); return; }
  const rg=d.ringkasan||{};
  const [tahun,bln]=d.bulan.split('-');
  const blnLabel=_BULAN_ID[parseInt(bln)-1]+' '+tahun;

  G('ct').innerHTML=`<div class="fu">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:180px">
        <div style="font-family:var(--serif);font-size:1.2rem;color:var(--navy)">Laporan Administrasi</div>
        <div style="font-size:.68rem;color:var(--muted);margin-top:2px">Periode: ${blnLabel}</div>
      </div>
      <input class="fctl" type="month" id="lap-bulan" value="${esc(d.bulan)}"
        onchange="gantiLaporanBulan()" style="max-width:170px">
    </div>
    <div class="sgr" style="grid-template-columns:repeat(4,1fr)">
      ${scCard('sc-teal', 'fa-envelope-open-text',rg.totalMasuk ||0,'Surat Masuk')}
      ${scCard('sc-navy', 'fa-paper-plane',        rg.totalKeluar||0,'Surat Keluar')}
      ${scCard('sc-gold', 'fa-file-circle-plus',   rg.totalPerm  ||0,'Permohonan')}
      ${scCard('sc-green','fa-calendar-check',     rg.totalAgenda||0,'Kegiatan')}
    </div>
    <div class="cg2">
      <div class="panel">
        <div class="phd"><span class="ptl"><i class="fas fa-list-ul"></i>Rincian Data</span></div>
        ${[[1,'Total Surat Masuk',rg.totalMasuk||0,''],[2,'Total Surat Keluar',rg.totalKeluar||0,''],
           [3,'Total Permohonan',rg.totalPerm||0,''],[4,'Permohonan Disetujui',rg.disetujui||0,'color:var(--green2)'],
           [5,'Permohonan Ditolak',rg.ditolak||0,'color:var(--red2)'],[6,'Permohonan Menunggu',rg.menunggu||0,'color:var(--gold2)'],
           [7,'Kegiatan Kelurahan',rg.totalAgenda||0,'']].map(([n,lbl,val,st])=>
          `<div class="lap-table-row">
            <div class="lap-row-num">${n}</div>
            <div class="lap-row-label">${lbl}</div>
            <div class="lap-row-val" style="${st}">${val}</div>
          </div>`).join('')}
      </div>
      <div>
        <div class="panel">
          <div class="phd"><span class="ptl"><i class="fas fa-print"></i>Cetak Laporan</span></div>
          <div class="pbd" style="display:flex;flex-direction:column;gap:8px">
            <button class="bp bp-gold"  onclick="printLaporan()"><i class="fas fa-print"></i> Cetak Laporan Bulanan</button>
            <button class="bp bp-teal"  onclick="cetakLaporanSurat('masuk')"><i class="fas fa-envelope-open-text"></i> Rekap Surat Masuk</button>
            <button class="bp"          onclick="cetakLaporanSurat('keluar')"><i class="fas fa-paper-plane"></i> Rekap Surat Keluar</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

async function gantiLaporanBulan() {
  const b=(G('lap-bulan')||{}).value||'';
  showLoad();
  try { const res=await gasCall('getLaporanData',{bulan:b}); hideLoad(); _renderLaporan(res); }
  catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

async function printLaporan() {
  const bl=(G('lap-bulan')||{}).value||'';
  const [tahun,bln]=bl.split('-');
  const blnLabel=_BULAN_ID[parseInt(bln)-1]+' '+tahun;
  const tglNow=_tglStr(new Date()), tpl=getTplLaporan();
  showLoad('Menyiapkan laporan...');
  try {
    const res=await gasCall('getLaporanData',{bulan:bl});
    hideLoad();
    const rg=res.ringkasan||{};
    let html=_buildKopHtml(tpl,`
      h3.judul{text-align:center;font-size:12pt;text-decoration:underline;text-transform:uppercase;margin:14px 0 4px}
      table.rekap{width:100%;border-collapse:collapse;margin:12px 0;font-size:11pt}
      table.rekap th,table.rekap td{border:1px solid #000;padding:6px 8px}
      table.rekap th{background:#e8ecf3;text-align:center}`);
    html+=`<h3 class="judul">LAPORAN ADMINISTRASI BULANAN</h3>
      <p style="text-align:center;font-size:10pt;margin-bottom:14px">Periode: ${blnLabel}</p>
      <table class="rekap"><thead><tr>
        <th style="width:40px">No</th><th>Uraian</th><th style="width:100px">Jumlah</th>
      </tr></thead><tbody>
      ${[['Surat Masuk',rg.totalMasuk||0],['Surat Keluar',rg.totalKeluar||0],
         ['Permohonan Surat Warga',rg.totalPerm||0],['Permohonan Disetujui',rg.disetujui||0],
         ['Permohonan Ditolak',rg.ditolak||0],['Permohonan Menunggu',rg.menunggu||0],
         ['Kegiatan Kelurahan',rg.totalAgenda||0]].map(([u,j],i)=>
        `<tr><td style="text-align:center">${i+1}</td><td>${u}</td><td style="text-align:center">${j}</td></tr>`
      ).join('')}
      </tbody></table>`;
    html+=_buildKopFooter(tpl,'Ponorogo',tglNow,'');
    _setCetakSrcdoc(html);
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   6. PENGATURAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function loadPengaturan() {
  setNav('set');
  setPage('Pengaturan Sistem','Kelola akun, template, dan konfigurasi');
  sbClose(); dAllCharts();
  if (!isAdmin()) { showErr('Akses ditolak. Halaman ini hanya untuk Admin.'); return; }

  /* ── Cek cache ── */
  const cached = window._gcGet('pengaturan');
  if (cached) {
    _renderPengaturan(cached.res.data || []);
    window._gcRefresh('pengaturan');
    return;
  }

  /* ── Tidak ada cache → fetch normal ── */
  await pageTransition(async () => {
    showLoad();
    try {
      const res=await gasCall('getAllUsers');
      hideLoad();
      window._gcSet('pengaturan', { res });
      _renderPengaturan(res.data||[]);
    } catch(e) { hideLoad(); throw e; }
  });
}

function _renderPengaturan(users) {
  const tplS=getTplSurat(), tplL=getTplLaporan();
  const userRows=users.map(u=>{
    const ck=rcSet(u);
    return `<tr>
      <td style="font-family:var(--mono);font-size:.65rem">${esc(u.username)}</td>
      <td style="font-weight:600">${esc(u.nama)}</td>
      <td style="font-size:.65rem;color:var(--mid)">${esc(u.jabatan)}</td>
      <td><span class="chip ch-navy">${esc(u.role)}</span></td>
      <td><span class="chip ${u.aktif==='Y'?'ch-green':'ch-red'}">${u.aktif==='Y'?'Aktif':'Non-aktif'}</span></td>
      <td><button class="bd" onclick="konfirmHapus('user',rcGet('${ck}')._ri)"><i class="fas fa-trash"></i></button></td>
    </tr>`;
  }).join('');

  const tf=(id,lbl,val,ph='')=>
    `<div class="fgrp"><label class="flbl" for="${id}">${lbl}</label><input class="fctl" id="${id}" value="${esc(val)}" placeholder="${ph}"></div>`;
  const ta=(id,lbl,val)=>
    `<div class="fgrp"><label class="flbl" for="${id}">${lbl}</label><textarea class="fctl" id="${id}" rows="2">${esc(val)}</textarea></div>`;

  G('ct').innerHTML=`<div class="fu"><div class="cg2e">
    <div>
      <div class="set-section">
        <div class="set-section-hd open" onclick="toggleSetSection(this)">
          <h6><i class="fas fa-users-gear"></i>Manajemen Akun</h6>
          <i class="fas fa-chevron-down arrow"></i>
        </div>
        <div class="set-section-bd open">
          <div style="display:flex;justify-content:flex-end;margin-bottom:9px">
            <button class="bp" onclick="openModalUser()"><i class="fas fa-user-plus"></i> Tambah Akun</button>
          </div>
          <div class="twrap"><table class="dtbl"><thead><tr>
            <th>Username</th><th>Nama</th><th>Jabatan</th><th>Role</th><th>Status</th><th>Aksi</th>
          </tr></thead><tbody>${userRows}</tbody></table></div>
        </div>
      </div>
      <div class="set-section">
        <div class="set-section-hd" onclick="toggleSetSection(this)">
          <h6><i class="fas fa-key"></i>Keamanan &amp; Password</h6>
          <i class="fas fa-chevron-down arrow"></i>
        </div>
        <div class="set-section-bd">
          <p style="font-size:.7rem;color:var(--mid);margin-bottom:12px;line-height:1.65">Ubah password akun Anda secara berkala.</p>
          <button class="bp bp-gold" onclick="om('m-pwd')"><i class="fas fa-key"></i> Ganti Password</button>
        </div>
      </div>
      <div class="set-section">
        <div class="set-section-hd" onclick="toggleSetSection(this)">
          <h6><i class="fas fa-database"></i>Setup &amp; Maintenance</h6>
          <i class="fas fa-chevron-down arrow"></i>
        </div>
        <div class="set-section-bd">
          <p style="font-size:.7rem;color:var(--mid);margin-bottom:12px;line-height:1.65">Jalankan Setup Awal untuk memastikan sheet &amp; folder Drive siap.</p>
          <button class="bp" onclick="doSetupAwal()"><i class="fas fa-tools"></i> Jalankan Setup Awal</button>
        </div>
      </div>
    </div>
    <div>
      <div class="set-section">
        <div class="set-section-hd" onclick="toggleSetSection(this)">
          <h6><i class="fas fa-file-signature"></i>Template Cetak Surat</h6>
          <i class="fas fa-chevron-down arrow"></i>
        </div>
        <div class="set-section-bd">
          <p style="font-size:.67rem;color:var(--muted);margin-bottom:11px;line-height:1.55">Konfigurasi kop surat untuk menu <strong>Buat Surat</strong>.</p>
          <div class="frow2">
            ${tf('tpl-s-i1','Instansi Level 1',tplS.instansi1)}
            ${tf('tpl-s-i2','Instansi Level 2',tplS.instansi2)}
          </div>
          ${tf('tpl-s-dinas','Dinas / Unit Kerja',tplS.dinas)}
          ${ta('tpl-s-alamat','Alamat Lengkap',tplS.alamat)}
          <div class="frow2">
            ${tf('tpl-s-logokanan','URL Logo Kanan',tplS.logoKanan,'https://...logo.png')}
            ${tf('tpl-s-logokiri','URL Logo Kiri (opsional)',tplS.logoKiri,'kosongkan jika tidak ada')}
          </div>
          <div class="frow2">
            ${tf('tpl-s-namattd','Nama TTD',tplS.namaTtd)}
            ${tf('tpl-s-jabatanttd','Jabatan TTD',tplS.jabatanTtd)}
          </div>
          ${tf('tpl-s-nipttd','NIP',tplS.nipTtd)}
          ${ta('tpl-s-tembusan','Tembusan Default',tplS.tembusan)}
          <button class="bp bp-teal" onclick="simpanTemplateSurat()"><i class="fas fa-save"></i> Simpan Template Surat</button>
        </div>
      </div>
      <div class="set-section">
        <div class="set-section-hd" onclick="toggleSetSection(this)">
          <h6><i class="fas fa-file-signature"></i>Template Cetak Laporan</h6>
          <i class="fas fa-chevron-down arrow"></i>
        </div>
        <div class="set-section-bd">
          <div class="frow2">
            ${tf('tpl-l-i1','Instansi Level 1',tplL.instansi1)}
            ${tf('tpl-l-i2','Instansi Level 2',tplL.instansi2)}
          </div>
          ${tf('tpl-l-dinas','Dinas / Unit Kerja',tplL.dinas)}
          ${ta('tpl-l-alamat','Alamat Lengkap',tplL.alamat)}
          <div class="frow2">
            ${tf('tpl-l-logokanan','URL Logo Kanan',tplL.logoKanan)}
            ${tf('tpl-l-logokiri','URL Logo Kiri',tplL.logoKiri)}
          </div>
          <div class="frow2">
            ${tf('tpl-l-namattd','Nama TTD',tplL.namaTtd)}
            ${tf('tpl-l-jabatanttd','Jabatan TTD',tplL.jabatanTtd)}
          </div>
          ${tf('tpl-l-nipttd','NIP',tplL.nipTtd)}
          <button class="bp bp-teal" onclick="simpanTemplateLaporan()"><i class="fas fa-save"></i> Simpan Template Laporan</button>
        </div>
      </div>
    </div>
    <div class="set-section">
        <div class="set-section-hd" onclick="toggleSetSection(this)">
          <h6><i class="fas fa-circle-info"></i>Tentang Aplikasi</h6>
          <i class="fas fa-chevron-down arrow"></i>
        </div>
        <div class="set-section-bd">
          <div style="display:flex;flex-direction:column;gap:14px">

            <!-- Logo + nama app -->
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:10px">
              <img src="assets/icon-full.png" alt="Logo SIMPATIH"
                   style="width:52px;height:52px;object-fit:contain;border-radius:10px;flex-shrink:0"
                   onerror="this.style.display='none'">
              <div>
                <div style="font-family:var(--serif);font-size:1rem;font-weight:700;color:var(--navy);line-height:1.2">SIMPATIH</div>
                <div style="font-size:.65rem;color:var(--muted);margin-top:2px;line-height:1.5">
                  Sistem Informasi Manajemen Pemerintahan<br>Kelurahan Kepatihan
                </div>
              </div>
            </div>

            <!-- Info kelurahan -->
            <div style="background:var(--bg);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:7px">
              <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:2px">Instansi</div>
              <div style="display:flex;align-items:flex-start;gap:8px;font-size:.7rem">
                <i class="fas fa-landmark" style="color:var(--teal);width:14px;margin-top:2px;flex-shrink:0"></i>
                <div>
                  <div style="font-weight:600;color:var(--navy)">Kelurahan Kepatihan</div>
                  <div style="color:var(--muted)">Kecamatan Ponorogo, Kabupaten Ponorogo</div>
                  <div style="color:var(--muted)">Jawa Timur</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;font-size:.7rem">
                <i class="fas fa-user-tie" style="color:var(--teal);width:14px;flex-shrink:0"></i>
                <div>
                  <span style="color:var(--muted)">Lurah: </span>
                  <span style="font-weight:600;color:var(--navy)">Husnul Arifandi, S.STP</span>
                </div>
              </div>
            </div>

            <!-- Info developer -->
            <div style="background:var(--bg);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:7px">
              <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:2px">Developer</div>
              <div style="display:flex;align-items:center;gap:8px;font-size:.7rem">
                <i class="fas fa-code" style="color:var(--teal);width:14px;flex-shrink:0"></i>
                <div>
                  <span style="color:var(--muted)">Author: </span>
                  <span style="font-weight:600;color:var(--navy)">Ahmad Abdul Basith, S.Tr.I.P.</span>
                </div>
              </div>
            </div>

            <!-- Kontak aduan -->
            <a href="https://wa.me/6285159686554"
               target="_blank" rel="noopener noreferrer"
               style="display:flex;align-items:center;gap:10px;padding:12px 14px;
                      background:linear-gradient(135deg,#25d366,#128c7e);
                      border-radius:10px;text-decoration:none;
                      transition:opacity .15s;cursor:pointer"
               onmouseover="this.style.opacity='.88'"
               onmouseout="this.style.opacity='1'">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                   style="width:26px;height:26px;flex-shrink:0;fill:#fff">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15
                         -.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075
                         -.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059
                         -.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52
                         .149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52
                         -.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51
                         -.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372
                         -.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074
                         .149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625
                         .712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413
                         .248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.523 5.847L.057 23.882
                         a.75.75 0 00.916.919l6.101-1.457A11.945 11.945 0 0012 24c6.627 0 12-5.373
                         12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.001-1.371l-.36-.214
                         -3.716.887.903-3.618-.235-.373A9.818 9.818 0 012.182 12C2.182 6.57
                         6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388
                         9.818-9.818 9.818z"/>
              </svg>
              <div>
                <div style="font-size:.62rem;color:rgba(255,255,255,.75);font-weight:600;
                            text-transform:uppercase;letter-spacing:.06em">Kontak Aduan</div>
                <div style="font-size:.82rem;color:#fff;font-weight:700;
                            font-family:var(--mono);letter-spacing:.03em">0851-5968-6554</div>
              </div>
              <i class="fas fa-arrow-up-right-from-square"
                 style="color:rgba(255,255,255,.6);font-size:.65rem;margin-left:auto"></i>
            </a>

          </div>
        </div>
      </div>
  </div></div>`;
}

function toggleSetSection(hd) {
  hd.classList.toggle('open');
  const bd=hd.nextElementSibling; if(bd) bd.classList.toggle('open');
}

function simpanTemplateSurat() {
  const fv=id=>(G(id)||{}).value||'';
  _templateSurat={instansi1:fv('tpl-s-i1'),instansi2:fv('tpl-s-i2'),dinas:fv('tpl-s-dinas'),
    alamat:fv('tpl-s-alamat'),logoKanan:fv('tpl-s-logokanan'),logoKiri:fv('tpl-s-logokiri'),
    namaTtd:fv('tpl-s-namattd'),jabatanTtd:fv('tpl-s-jabatanttd'),nipTtd:fv('tpl-s-nipttd'),tembusan:fv('tpl-s-tembusan')};
  try{localStorage.setItem('_tpl_surat',JSON.stringify(_templateSurat));}catch(_){}
  toast('Template surat berhasil disimpan.','ok');
}

function simpanTemplateLaporan() {
  const fv=id=>(G(id)||{}).value||'';
  _templateLaporan={instansi1:fv('tpl-l-i1'),instansi2:fv('tpl-l-i2'),dinas:fv('tpl-l-dinas'),
    alamat:fv('tpl-l-alamat'),logoKanan:fv('tpl-l-logokanan'),logoKiri:fv('tpl-l-logokiri'),
    namaTtd:fv('tpl-l-namattd'),jabatanTtd:fv('tpl-l-jabatanttd'),nipTtd:fv('tpl-l-nipttd')};
  try{localStorage.setItem('_tpl_laporan',JSON.stringify(_templateLaporan));}catch(_){}
  toast('Template laporan berhasil disimpan.','ok');
}

function openModalUser() {
  const body=`
    <div class="fgrp"><label class="flbl" for="usr-uname">Username <span class="req">*</span></label>
      <input class="fctl" id="usr-uname" placeholder="Contoh: budi123" autocomplete="off"></div>
    <div class="fgrp"><label class="flbl" for="usr-nama">Nama Lengkap <span class="req">*</span></label>
      <input class="fctl" id="usr-nama" placeholder="Nama lengkap"></div>
    <div class="fgrp"><label class="flbl" for="usr-jabatan">Jabatan</label>
      <input class="fctl" id="usr-jabatan" placeholder="Contoh: Staff Kelurahan"></div>
    <div class="frow2">
      <div class="fgrp"><label class="flbl" for="usr-role">Role <span class="req">*</span></label>
        <select class="fctl" id="usr-role"><option value="user">User</option><option value="admin">Admin</option></select></div>
      <div class="fgrp"><label class="flbl" for="usr-aktif">Status</label>
        <select class="fctl" id="usr-aktif"><option value="Y">Aktif</option><option value="N">Non-aktif</option></select></div>
    </div>
    <div class="fgrp"><label class="flbl" for="usr-pass">Password <span class="req">*</span></label>
      <input class="fctl" type="password" id="usr-pass" placeholder="Minimal 6 karakter" autocomplete="new-password"></div>`;
  ensureModal('m-user',
    `<div class="mbox"><div class="mhd">
      <h5><i class="fas fa-user-plus" style="color:var(--teal)"></i>Tambah Akun</h5>
      <button class="bx" onclick="cm('m-user')">&times;</button>
    </div>
    <div class="mbd" id="m-user-body"></div>
    <div class="mft" id="m-user-ft"></div></div>`);
  G('m-user-body').innerHTML=body;
  G('m-user-ft').innerHTML=
    `<button class="bg2" onclick="cm('m-user')">Batal</button>
     <button class="bp bp-teal" onclick="submitUser()"><i class="fas fa-save"></i> Simpan</button>`;
  om('m-user');
}

async function submitUser() {
  const fv=id=>(G(id)||{}).value||'';
  const uname=fv('usr-uname'),nama=fv('usr-nama'),pass=fv('usr-pass');
  if (!uname||!nama||!pass) { toast('Username, nama, dan password wajib diisi.','er'); return; }
  if (pass.length<6) { toast('Password minimal 6 karakter.','er'); return; }
  showLoad('Menyimpan...'); cm('m-user');
  try {
    const res=await gasCall('addUser',{username:uname,namaLengkap:nama,jabatan:fv('usr-jabatan'),
      role:fv('usr-role')||'user',aktif:fv('usr-aktif')||'Y',password:pass});
    hideLoad();
    if(res.success) { toast('Akun berhasil ditambahkan.','ok'); window._gcDel('pengaturan'); loadPengaturan(); }
    else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

async function submitGantiPwd() {
  const fv=id=>(G(id)||{}).value||'';
  const lama=fv('pwd-lama'),baru=fv('pwd-baru'),konfirm=fv('pwd-konfirm');
  if (!lama||!baru||!konfirm) { toast('Semua field wajib diisi.','er'); return; }
  if (baru!==konfirm)          { toast('Password baru & konfirmasi tidak cocok.','er'); return; }
  if (baru.length<6)           { toast('Password baru minimal 6 karakter.','er'); return; }
  showLoad('Memproses...'); cm('m-pwd');
  try {
    const res=await gasCall('changePassword',{username:SES.username,passwordLama:lama,passwordBaru:baru});
    hideLoad();
    if(res.success) toast('Password berhasil diubah.','ok');
    else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

async function doSetupAwal() {
  if (!confirm('Jalankan setup awal?')) return;
  showLoad('Menjalankan setup...');
  try {
    const res=await gasCall('setupAwal');
    hideLoad();
    if(res.success) toast('Setup awal berhasil! '+(res.message||''),'ok');
    else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   7. KONFIRMASI HAPUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

let _hpsTipe = '';   /* 'masuk' | 'keluar' | '' */

function konfirmHapus(mode, ri, tipe) {
  if (!isAdmin()) { toast('Akses ditolak.','er'); return; }
  _hpsMode=mode; _hpsRi=ri; _hpsTipe=tipe||'';
  const labels={surat:'surat ini',perm:'permohonan ini',kp:'data penduduk ini',
    agenda:'agenda ini',arsip:'arsip dokumen ini',peta:'lokasi peta ini',user:'akun pengguna ini'};
  const msg=G('hps-msg');
  if(msg) msg.textContent='Apakah Anda yakin ingin menghapus '+(labels[mode]||'data ini')+'? Tindakan ini tidak dapat dibatalkan.';
  om('m-hps');
}

async function doHapus() {
  const actionMap={surat:'deleteSurat',perm:'deletePermohonan',kp:'deletePenduduk',
    agenda:'deleteAgenda',arsip:'deleteArsip',peta:'deletePetaLokasi',user:'deleteUser'};
  const reloadMap={
    surat: ()=>{ _hpsTipe==='keluar' ? loadSuratKeluar() : loadSuratMasuk(); },
    perm : ()=>{ _suratTab='permohonan'; loadSuratMasuk(); },
    kp:loadKependudukan,agenda:loadAgenda,arsip:loadArsip,peta:loadPeta,user:loadPengaturan
  };
  const action=actionMap[_hpsMode]; if(!action) { cm('m-hps'); return; }
  showLoad('Menghapus...'); cm('m-hps');
  try {
    const payload = {_ri:_hpsRi};
    if(_hpsMode==='surat' && _hpsTipe) payload.tipe=_hpsTipe;
    const res=await gasCall(action, payload);
    hideLoad();
    if(res.success) {
      toast('Data berhasil dihapus.','ok');
      /* ── Invalidate cache sesuai mode ── */
      if (_hpsMode==='surat') {
        window._gcDel('dashboard');
        window._gcDel('suratMasuk');
        window._gcDel('suratKeluar');
        window._gcDel('laporan');
      } else if (_hpsMode==='perm') {
        window._gcDel('dashboard');
        window._gcDel('suratMasuk');
        window._gcDel('laporan');
      } else if (_hpsMode==='kp') {
        window._gcDel('dashboard');
        window._gcDel('penduduk');
      } else if (_hpsMode==='agenda') {
        window._gcDel('dashboard');
        window._gcDel('agenda');
      } else if (_hpsMode==='arsip') {
        window._gcDel('arsip');
        /* arsip tidak tampil di dashboard, tidak perlu _gcDel('dashboard') */
      } else if (_hpsMode==='user') {
        window._gcDel('dashboard');
        window._gcDel('pengaturan');
      }
      if(reloadMap[_hpsMode]) reloadMap[_hpsMode]();
    }
    else toast('Gagal: '+res.message,'er');
  } catch(e) { hideLoad(); toast('Error: '+e.message,'er'); }
}
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   8. UTILITY — _filterData & file helpers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function _filterData(data, q, sts, fields) {
  return data.filter(r => {
    if (sts && r.status!==sts) return false;
    if (q && q.trim()) {
      const kws=q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const hay=fields.map(f=>(r[f]||'').toString().toLowerCase()).join(' ');
      if (!kws.every(kw=>hay.includes(kw))) return false;
    }
    return true;
  });
}

function previewFile(url, filename) {
  if (!url) { toast('Tidak ada dokumen untuk di-preview.','er'); return; }

  /* Normalise URL — konversi berbagai format Google ke embed URL */
  function _driveEmbed(u) {
    /* Format: https://drive.google.com/file/d/FILE_ID/view?... */
    let m = /\/file\/d\/([^/?#]+)/.exec(u);
    if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    /* Format: https://drive.google.com/open?id=FILE_ID */
    m = /[?&]id=([^&#]+)/.exec(u);
    if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    /* Format: https://docs.google.com/... — gunakan viewer */
    if (u.includes('docs.google.com')) return u;
    return null;
  }

  const ext = (filename||url).split('.').pop().toLowerCase().split('?')[0];
  const isImg = /^(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(ext);

  /* Update judul */
  const titleEl=G('m-fileprev-title');
  if(titleEl) titleEl.innerHTML=`<i class="fas fa-file-search" style="color:var(--teal)"></i> ${esc(filename||'Dokumen')}`;
  /* Tombol download: download langsung (Drive URL pakai ?export=download) */
  const dlLink=G('fileprev-dl-link');
  if(dlLink) {
    const fid = (/\/file\/d\/([^/?#]+)/.exec(url)||[])[1]||'';
    dlLink.href = fid ? 'https://drive.google.com/uc?export=download&id='+fid : url;
    dlLink.download = filename || '';
    dlLink.removeAttribute('target');  /* download, bukan buka tab */
  }
  /* Tombol buka Drive */
  const extLinkEl=G('fileprev-ext-link');
  if(extLinkEl) { extLinkEl.href=url; extLinkEl.target='_blank'; }

  const fr=G('fileprev-frame'), im=G('fileprev-img'), fb=G('fileprev-fallback');
  [fr,im,fb].forEach(el=>{ if(el) el.style.display='none'; });

  if (isImg) {
    if(im){ im.src=url; im.style.display='block'; }
  } else {
    const embedUrl = _driveEmbed(url);
    if (embedUrl) {
      if(fr){ fr.src=embedUrl; fr.style.display='block'; }
    } else if (ext==='pdf') {
      /* PDF biasa — coba embed langsung */
      if(fr){ fr.src=url; fr.style.display='block'; }
    } else {
      /* Format tidak bisa embed — tampilkan fallback dengan link buka di tab */
      if(fb) fb.style.display='flex';
    }
  }
  om('m-fileprev');
}

/* ─── FILE UPLOAD — sistem multi-file dengan preview ─── */

/**
 * Render HTML komponen upload file (multi-file, preview thumbnail/PDF, hapus)
 * @param {string} prefix - 'su','ar','pm' dll
 * @param {string} [accept] - file accept string
 */
function _buildUploadHtml(prefix, accept) {
  accept = accept || '.pdf,.doc,.docx,.jpg,.jpeg,.png';
  return `
    <div class="fupload-area" id="${prefix}-drop"
         onclick="G('${prefix}-file-inp').click()"
         ondragover="event.preventDefault();this.classList.add('drag')"
         ondragleave="this.classList.remove('drag')"
         ondrop="handleFileDrop(event,'${prefix}')"
         role="button" tabindex="0">
      <i class="fas fa-cloud-upload-alt"></i>
      <p>Klik atau drag &amp; drop</p>
      <p style="font-size:.6rem;margin-top:2px;opacity:.6">PDF · JPG · PNG · DOC (maks 5MB/file)</p>
    </div>
    <div id="${prefix}-file-list" style="display:none;margin-top:8px;display:flex;flex-direction:column;gap:6px"></div>
    <input type="file" id="${prefix}-file-inp" style="display:none"
           accept="${accept}" multiple
           onchange="handleFileSelectMulti(this,'${prefix}')">`;
}

/* Cache multi-file: { prefix: [{data, mime, name, size}] } */
const _fileMultiCache = {};

function handleFileSelect(inp, prefix) {
  // legacy single-file shim
  handleFileSelectMulti(inp, prefix);
}
function handleFileSelectThumb(inp, prefix) {
  handleFileSelectMulti(inp, prefix);
}

function handleFileSelectMulti(inp, prefix) {
  const files = Array.from(inp.files || []);
  if (!files.length) return;
  if (!_fileMultiCache[prefix]) _fileMultiCache[prefix] = [];
  files.forEach(f => {
    if (f.size > 5 * 1024 * 1024) { toast(f.name + ' melebihi 5MB, dilewati.','er'); return; }
    const rd = new FileReader();
    rd.onload = e => {
      _fileMultiCache[prefix].push({data:e.target.result, mime:f.type, name:f.name, size:f.size});
      _renderFileList(prefix);
      /* Legacy compat: _fileCache */
      _fileCache[prefix] = _fileMultiCache[prefix][0];
    };
    rd.readAsDataURL(f);
  });
  inp.value = '';
}

function _renderFileList(prefix) {
  const list = G(prefix+'-file-list');
  if (!list) return;
  const files = _fileMultiCache[prefix] || [];
  if (!files.length) { list.style.display='none'; return; }
  list.style.display = 'flex';
  list.innerHTML = files.map((f,i) => {
    const isImg = /^image\//.test(f.mime);
    const isPdf = f.mime === 'application/pdf';
    const sz    = f.size > 1048576 ? (f.size/1048576).toFixed(1)+'MB' : Math.round(f.size/1024)+'KB';
    const ico   = isPdf ? 'fa-file-pdf' : isImg ? 'fa-file-image' : 'fa-file-alt';
    const clr   = isPdf ? '#e74c3c' : isImg ? '#0891b2' : '#6366f1';
    const thumb = isImg
      ? `<img src="${f.data}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;flex-shrink:0">`
      : isPdf
        ? `<div style="width:48px;height:48px;border-radius:4px;background:#fff3f3;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer"
               onclick="_previewPdfBlob('${prefix}',${i})" title="Klik untuk preview PDF">
             <i class="fas fa-file-pdf" style="font-size:1.5rem;color:#e74c3c"></i>
           </div>`
        : `<div style="width:48px;height:48px;border-radius:4px;background:var(--bg2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
             <i class="fas ${ico}" style="font-size:1.5rem;color:${clr}"></i>
           </div>`;
    return `<div style="display:flex;align-items:center;gap:8px;background:var(--bg2);border-radius:8px;padding:6px 8px">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div style="font-size:.68rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div>
        <div style="font-size:.6rem;color:var(--muted)">${sz} ${isPdf?'<span style="color:#0891b2;cursor:pointer;text-decoration:underline" onclick="_previewPdfBlob(\'${prefix}\','+i+')">Preview</span>':''}</div>
      </div>
      <button class="bg2" onclick="_removeFileItem('${prefix}',${i})" style="padding:3px 8px;font-size:.65rem;flex-shrink:0">&#10005;</button>
    </div>`;
  }).join('');
}

function _removeFileItem(prefix, idx) {
  if (!_fileMultiCache[prefix]) return;
  _fileMultiCache[prefix].splice(idx, 1);
  _fileCache[prefix] = _fileMultiCache[prefix][0] || null;
  _renderFileList(prefix);
}

function _previewPdfBlob(prefix, idx) {
  const f = (_fileMultiCache[prefix]||[])[idx];
  if (!f || f.mime !== 'application/pdf') return;
  /* Buka PDF dalam iframe di modal preview tanpa ganti jendela */
  const titleEl = G('m-fileprev-title');
  if(titleEl) titleEl.innerHTML = `<i class="fas fa-file-pdf" style="color:#e74c3c"></i> ${esc(f.name)}`;
  const dlLink = G('fileprev-dl-link');
  if(dlLink) { dlLink.href = f.data; dlLink.download = f.name; }
  const extEl = G('fileprev-ext-link');
  if(extEl) extEl.href = f.data;
  const fr=G('fileprev-frame'), im=G('fileprev-img'), fb=G('fileprev-fallback');
  [fr,im,fb].forEach(el=>{ if(el) el.style.display='none'; });
  if(fr) { fr.src = f.data; fr.style.display = 'block'; }
  om('m-fileprev');
}

function _clearFileUpload(prefix) {
  _fileMultiCache[prefix] = [];
  _fileCache[prefix] = null;
  _renderFileList(prefix);
  const inp = G(prefix+'-file-inp');
  if(inp) inp.value = '';
}

/* Legacy shim untuk _showFileThumb */
function _showFileThumb(prefix, f, dataUrl) {}

function handleFileDrop(e, prefix) {
  e.preventDefault();
  const dropEl=G(prefix+'-drop'); if(dropEl) dropEl.classList.remove('drag');
  const dt = e.dataTransfer;
  if (!dt || !dt.files.length) return;
  /* Inject files ke input untuk proses */
  const mockInp = { files: dt.files };
  handleFileSelectMulti(mockInp, prefix);
}
