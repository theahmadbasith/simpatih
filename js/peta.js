/* ═══════════════════════════════════════════════════════════════════
   SIMPATIH — js/peta.js
   Modul Peta Kepatihan
   ───────────────────────────────────────────────────────────────────
   Fitur:
     • 2 mode: Leaflet Realtime & Google My Maps
     • Layer aset kelurahan (kantor, sekolah, ibadah, dll)
     • Draw overlay garis & area + simpan ke GAS
     • Filter & panel per kategori
     • Modal tambah/edit layer
     • Cetak PDF via jsPDF + html2canvas
     • Statistik kependudukan
     • Kalender mini (dipakai app.js)

   Dependensi: ui.js, api.js
   Load order: api.js → ui.js → surat.js → penduduk.js → peta.js → app.js
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   0. KONSTANTA & STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const _PETA_CENTER    = [-7.87518, 111.46571];
const _PETA_ZOOM      = 15;
const _MYMAPS_URL     = 'https://www.google.com/maps/d/embed?mid=1YUVjuKTlub1yzm9DeorlhhbAoP7pNX4&z=15&ll=-7.8637,111.4630';
const _MYMAPS_VIEWER  = 'https://www.google.com/maps/d/viewer?mid=1YUVjuKTlub1yzm9DeorlhhbAoP7pNX4';

const _TILE_LAYERS = {
  osm             : { url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                            attr:'© OpenStreetMap', label:'Peta',            icon:'fa-map',          maxZoom:19 },
  satelit         : { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'© Esri',          label:'Satelit',         icon:'fa-satellite',    maxZoom:19 },
  googleSatelit   : { url:'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',                                            attr:'© Google',        label:'Google Satelit', icon:'fa-earth-asia',   maxZoom:20 },
  hybrid          : { url:'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',                                            attr:'© Google',        label:'Hybrid',         icon:'fa-globe',        maxZoom:20 },
  carto           : { url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',                                attr:'© CartoDB',       label:'CartoDB',        icon:'fa-map-location', maxZoom:19 },
  topo            : { url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                                              attr:'© OpenTopoMap',   label:'Topografi',      icon:'fa-mountain',     maxZoom:17 },
};

/* Definisi kategori aset kelurahan */
const _SIMBOL_DEF = [
  { id:'kantor',    ico:'fa-building-columns', label:'Kantor / Pemerintahan', warna:'#0c1f3f' },
  { id:'sekolah',   ico:'fa-school',           label:'Sekolah / Pendidikan',  warna:'#c97b0e' },
  { id:'ibadah',    ico:'fa-mosque',           label:'Tempat Ibadah',         warna:'#047857' },
  { id:'kesehatan', ico:'fa-hospital',         label:'Fasilitas Kesehatan',   warna:'#c91c3b' },
  { id:'toko',      ico:'fa-store',            label:'Toko / UMKM',           warna:'#7c3aed' },
  { id:'posyandu',  ico:'fa-baby',             label:'Posyandu',              warna:'#e67e22' },
  { id:'kamling',   ico:'fa-shield-halved',    label:'Pos Kamling',           warna:'#0891b2' },
  { id:'olahraga',  ico:'fa-futbol',           label:'Lapangan / Olahraga',   warna:'#16a34a' },
  { id:'bangunan',  ico:'fa-house',            label:'Bangunan Warga',        warna:'#64748b' },
  { id:'lainnya',   ico:'fa-map-pin',          label:'Lainnya',               warna:'#94a3b8' },
];

const _WARNA_PRESET = [
  '#0c1f3f','#c97b0e','#047857','#c91c3b','#7c3aed','#0891b2',
  '#e67e22','#16a34a','#64748b','#e91e63','#f59e0b','#10b981',
];

const _DRAW_WARNA = [
  { hex:'#1e6fd9', lbl:'Biru'   }, { hex:'#c0392b', lbl:'Merah'  },
  { hex:'#0d9268', lbl:'Hijau'  }, { hex:'#d97706', lbl:'Oranye' },
  { hex:'#7c3aed', lbl:'Ungu'   }, { hex:'#0891b2', lbl:'Tosca'  },
  { hex:'#e91e63', lbl:'Pink'   }, { hex:'#64748b', lbl:'Abu'    },
];

/* State peta
   _petaMap, _petaMarkers, _petaTileLayers, _petaCurrentLayer
   didefinisikan di ui.js agar bisa diakses doRefresh() dan doLogout()
*/
let _petaMode         = 'leaflet';
let _petaFullscreen   = false;
let _lfMap            = null;
let _lfMarkers        = [];
/* _petaTileLayers & _petaCurrentLayer → dari ui.js */
let _layerData        = [];
let _layerFormRow     = null;
let _layerDelRi       = null;
let _selectedSimbol   = 'lainnya';
let _selectedWarna    = '#1e6fd9';
let _pickCoordMode    = false;
let _pickTempMarker   = null;
let _navPanelOpen     = false;
let _catPanelOpen     = false;
let _catFilter        = null;

/* State draw overlay */
let _drawnItems       = null;
let _drawControl      = null;
let _activeDrawMode   = null;
let _activeDrawHandler= null;
let _drawPanelOpen    = false;
let _drawnMeta        = {};
let _pendingLayer     = null;
let _pendingLayerType = null;
let _metaWarna        = '#1e6fd9';

/* State PDF */
let _pdfMap           = null;
let _pdfMapLayers     = {};
let _pdfModalOpen     = false;
let _pdfRenderBusy    = false;
let _pdfLegendRows    = [];
let _logoCacheB64     = null;
let _pdfOpts = {
  mapMode:'osm', orientation:'landscape', paperSize:'a4', dpi:3,
  showLayers:true, showDraw:true,
};

const _PAPER_SIZES = {
  a4    : { label:'A4',          w:210,   h:297   },
  a3    : { label:'A3',          w:297,   h:420   },
  f4    : { label:'F4 (Folio)',  w:215.9, h:330.2 },
  legal : { label:'Legal',       w:215.9, h:355.6 },
};

/* FA unicode untuk canvas pin */
const _FA_UNICODE = {
  'fa-building-columns':'\uf19c','fa-school':'\uf549','fa-mosque':'\uf678',
  'fa-hospital':'\uf0f8','fa-store':'\uf54e','fa-baby':'\uf77c',
  'fa-shield-halved':'\uf3ed','fa-futbol':'\uf1e3','fa-house':'\uf015',
  'fa-map-pin':'\uf276','fa-route':'\uf4d7','fa-draw-polygon':'\uf5ee',
};
let _simbolIconCache = {};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function _getSimbolDef(id) {
  return _SIMBOL_DEF.find(s => s.id === id) || _SIMBOL_DEF[_SIMBOL_DEF.length - 1];
}

function _hexToRgb(hex) {
  hex = (hex||'607d8b').replace('#','');
  if (hex.length===3) hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return { r:parseInt(hex.slice(0,2),16), g:parseInt(hex.slice(2,4),16), b:parseInt(hex.slice(4,6),16) };
}

function _getPaperDims() {
  const p = _PAPER_SIZES[_pdfOpts.paperSize] || _PAPER_SIZES.a4;
  const ls = _pdfOpts.orientation === 'landscape';
  return { w: ls ? p.h : p.w, h: ls ? p.w : p.h };
}

function _drawPinToCanvas(ctx, faIco, warna, cw, ch) {
  const c = warna||'#607d8b', sx=cw/32, sy=ch/42;
  ctx.clearRect(0,0,cw,ch);
  ctx.save(); ctx.globalAlpha=.18; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(16*sx,39*sy,5*sx,2.5*sy,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.fillStyle=c;
  ctx.beginPath();
  ctx.moveTo(16*sx,0);
  ctx.bezierCurveTo(9.37*sx,0,4*sx,5.37*sy,4*sx,12*sy);
  ctx.bezierCurveTo(4*sx,21.5*sy,16*sx,40*sy,16*sx,40*sy);
  ctx.bezierCurveTo(16*sx,40*sy,28*sx,21.5*sy,28*sx,12*sy);
  ctx.bezierCurveTo(28*sx,5.37*sy,22.63*sx,0,16*sx,0);
  ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha=.22; ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.arc(16*sx,12*sy,8*sx,0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.arc(16*sx,12*sy,6.5*sx,0,Math.PI*2); ctx.fill(); ctx.restore();
  const uni = _FA_UNICODE[faIco] || _FA_UNICODE['fa-map-pin'];
  ctx.save(); ctx.fillStyle=c;
  ctx.font='bold '+Math.round(10*sx)+'px "Font Awesome 6 Free"';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(uni,16*sx,12*sy); ctx.restore();
}

function _makePinPng(faIco, warna) {
  const SIZE=4, cv=document.createElement('canvas');
  cv.width=32*SIZE; cv.height=42*SIZE;
  _drawPinToCanvas(cv.getContext('2d'),faIco,warna,cv.width,cv.height);
  return cv.toDataURL('image/png');
}

function _precacheSimbolIcons() {
  _SIMBOL_DEF.forEach(s => {
    const key = s.ico+'_'+s.warna;
    if (!_simbolIconCache[key]) _simbolIconCache[key] = _makePinPng(s.ico,s.warna);
  });
  (_layerData||[]).forEach(l => {
    const sd = _getSimbolDef(l.simbol);
    const key = sd.ico+'_'+(l.warna||sd.warna);
    if (!_simbolIconCache[key]) _simbolIconCache[key] = _makePinPng(sd.ico,l.warna||sd.warna);
  });
}

function _getSimbolPng(faIco, warna) {
  const key = (faIco||'fa-map-pin')+'_'+(warna||'#607d8b');
  if (!_simbolIconCache[key]) _simbolIconCache[key] = _makePinPng(faIco,warna);
  return _simbolIconCache[key];
}

function _imgToBase64(url) {
  return fetch(url).then(r=>r.blob()).then(blob=>new Promise((res,rej)=>{
    const rd=new FileReader(); rd.onloadend=()=>res(rd.result); rd.onerror=rej; rd.readAsDataURL(blob);
  }));
}

function _calcLen(layer) {
  let ll=layer.getLatLngs?layer.getLatLngs():[];
  if (Array.isArray(ll[0])) ll=ll[0];
  let t=0; for (let i=0;i<ll.length-1;i++) t+=ll[i].distanceTo(ll[i+1]); return t;
}

function _calcArea(layer) {
  let ll=layer.getLatLngs?layer.getLatLngs():[];
  if (Array.isArray(ll[0])) ll=ll[0];
  if (ll.length<3) return 0;
  const R=6371000,n=ll.length; let a=0;
  for (let i=0;i<n;i++){const j=(i+1)%n;a+=(ll[j].lng-ll[i].lng)*Math.PI/180*(2+Math.sin(ll[i].lat*Math.PI/180)+Math.sin(ll[j].lat*Math.PI/180));}
  return Math.abs(a*R*R/2);
}

function _fmtLen(m) { return m<1000?m.toFixed(0)+' m':(m/1000).toFixed(2)+' km'; }
function _fmtArea(m2){ return m2<10000?m2.toFixed(0)+' m²':(m2/10000).toFixed(3)+' ha'; }

function _getMsr(layer,tipe){
  try{ return tipe==='polyline'?'📏 '+_fmtLen(_calcLen(layer)):'📐 '+_fmtArea(_calcArea(layer)); }
  catch(e){ return ''; }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. CSS INJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function _injectPetaStyles() {
  if (G('simpatih-peta-style')) return;
  const s = document.createElement('style'); s.id='simpatih-peta-style';
  s.textContent = [
    /* Fullscreen */
    '.peta-fs-active{position:fixed!important;inset:0!important;z-index:9400!important;width:100vw!important;height:100vh!important;border-radius:0!important;padding:0!important;background:var(--card)!important;}',
    /* Mode toggle */
    '.peta-mode-toggle{display:flex;gap:4px;background:var(--bg);padding:3px;border-radius:9px;border:1px solid var(--border)}',
    '.peta-mode-btn{padding:5px 12px;border-radius:6px;border:none;background:transparent;color:var(--muted);font-size:.65rem;font-weight:700;cursor:pointer;font-family:var(--font);display:flex;align-items:center;gap:5px;transition:all .14s}',
    '.peta-mode-btn.on{background:var(--navy);color:#fff;box-shadow:var(--sh0)}',
    '.peta-mode-btn:not(.on):hover{background:var(--bg2);color:var(--text)}',
    /* Toolbar btn */
    '.peta-btn{padding:5px 11px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:var(--mid);font-size:.63rem;font-weight:700;cursor:pointer;font-family:var(--font);display:inline-flex;align-items:center;gap:5px;text-decoration:none;transition:all .13s}',
    '.peta-btn:hover{border-color:var(--teal);color:var(--teal);background:var(--teall)}',
    '.peta-btn-primary{background:var(--navy);color:#fff;border-color:var(--navy)}',
    '.peta-btn-primary:hover{background:var(--navy2);border-color:var(--navy2);color:#fff}',
    /* Shimmer placeholder */
    '.peta-shimmer{position:absolute;inset:0;z-index:200;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:12px}',
    '.peta-shimmer.hidden{display:none}',
    '.peta-shimmer i{font-size:2rem;color:var(--border)}',
    '.peta-shimmer p{font-size:.72rem;color:var(--muted)}',
    /* Category panel */
    '.peta-cat-btn{position:absolute;top:10px;left:10px;z-index:999;width:30px;height:30px;border-radius:50%;background:rgba(10,22,44,.88);color:#fff;border:none;display:flex;align-items:center;justify-content:center;font-size:.88rem;cursor:pointer;box-shadow:0 3px 14px rgba(0,0,0,.38);transition:all .15s}',
    '.peta-cat-btn:hover{background:rgba(10,104,128,.85);transform:scale(1.08)}',
    '.peta-cat-btn.active{background:rgba(10,104,128,.9);box-shadow:0 0 0 2px #fff,0 0 0 4px #0a6880}',
    '.peta-cat-panel{position:absolute;top:10px;left:45px;z-index:1000;background:rgba(10,20,42,.96);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:7px 5px;display:flex;flex-direction:column;gap:1px;box-shadow:0 12px 36px rgba(0,0,0,.48);min-width:215px;transform-origin:top left;transition:opacity .18s,transform .18s}',
    '.peta-cat-panel.hidden{opacity:0;pointer-events:none;transform:scale(.88) translateY(-8px)}',
    '.peta-cat-panel.visible{opacity:1;pointer-events:auto;transform:scale(1) translateY(0)}',
    '.pcp-lbl{font-size:.52rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.28);padding:3px 10px 5px}',
    '.pcp-btn{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,.72);font-size:.68rem;font-weight:700;cursor:pointer;text-align:left;width:100%;font-family:var(--font);transition:background .12s,color .12s}',
    '.pcp-btn:hover{background:rgba(255,255,255,.1);color:#fff}',
    '.pcp-btn.on{color:#fff}',
    '.pcp-btn i.si{width:14px;text-align:center;font-size:.74rem;flex-shrink:0}',
    '.pcp-btn .sc{margin-left:auto;font-size:.58rem;font-family:var(--mono);background:rgba(255,255,255,.1);padding:1px 6px;border-radius:20px;color:rgba(255,255,255,.45)}',
    '.pcp-btn.on .sc{background:rgba(255,255,255,.18);color:#fff}',
    '.pcp-sep{height:1px;background:rgba(255,255,255,.07);margin:3px 5px}',
    /* Draw panel */
    '.lf-draw-toggle{position:absolute;bottom:40px;right:10px;z-index:1000;width:30px;height:30px;border-radius:50%;background:rgba(10,22,44,.88);color:#fff;border:none;display:flex;align-items:center;justify-content:center;font-size:.88rem;cursor:pointer;box-shadow:0 3px 14px rgba(0,0,0,.35);transition:all .15s}',
    '.lf-draw-toggle:hover{background:rgba(30,111,217,.85);transform:scale(1.06)}',
    '.lf-draw-toggle.active{background:rgba(30,111,217,.9);box-shadow:0 0 0 2px #fff,0 0 0 4px #1e6fd9}',
    '.lf-draw-panel{position:absolute;bottom:70px;right:10px;z-index:1001;background:rgba(10,20,42,.96);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:8px 5px;display:flex;flex-direction:column;gap:1px;box-shadow:0 12px 36px rgba(0,0,0,.48);min-width:155px;transform-origin:bottom right;transition:opacity .18s,transform .18s}',
    '.lf-draw-panel.hidden{opacity:0;pointer-events:none;transform:scale(.88)}',
    '.lf-draw-panel.visible{opacity:1;pointer-events:auto;transform:scale(1)}',
    '.lf-dp-lbl{font-size:.52rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.28);padding:3px 10px 5px}',
    '.lf-dp-sep{height:1px;background:rgba(255,255,255,.07);margin:3px 5px}',
    '.lf-dp-item{display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,.72);font-size:.68rem;font-weight:700;cursor:pointer;text-align:left;width:100%;font-family:var(--font);transition:background .12s,color .12s}',
    '.lf-dp-item:hover{background:rgba(255,255,255,.1);color:#fff}',
    '.lf-dp-item.active{background:rgba(30,111,217,.32);color:#80b8ff}',
    '.lf-dp-item.danger:hover{background:rgba(192,57,43,.32);color:#ff9898}',
    '.lf-dp-item i{width:14px;text-align:center;font-size:.76rem;flex-shrink:0}',
    /* Meta overlay */
    '.lf-meta-ov{position:absolute;bottom:0;left:0;right:0;z-index:1100;background:rgba(8,18,38,.97);backdrop-filter:blur(16px);border-top:1px solid rgba(255,255,255,.1);padding:14px 16px 16px;border-radius:0 0 12px 12px;transform:translateY(100%);transition:transform .22s cubic-bezier(.34,1.4,.64,1)}',
    '.lf-meta-ov.show{transform:translateY(0)}',
    '.lf-meta-title{font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.42);margin-bottom:10px;display:flex;align-items:center;gap:6px}',
    '.lf-meta-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}',
    '.lf-meta-inp{width:100%;padding:7px 9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;font-family:var(--font);font-size:.72rem;outline:none;transition:border-color .14s}',
    '.lf-meta-inp:focus{border-color:rgba(30,111,217,.7);background:rgba(30,111,217,.12)}',
    '.lf-meta-inp::placeholder{color:rgba(255,255,255,.25)}',
    '.lf-meta-swatches{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}',
    '.lf-meta-swatch{width:22px;height:22px;border-radius:5px;cursor:pointer;border:2.5px solid transparent;transition:transform .12s,border-color .12s;flex-shrink:0}',
    '.lf-meta-swatch:hover{transform:scale(1.18)}',
    '.lf-meta-swatch.on{border-color:#fff;transform:scale(1.18)}',
    '.lf-meta-msr{margin-bottom:10px;background:rgba(30,111,217,.14);border:1px solid rgba(30,111,217,.25);border-radius:7px;padding:7px 10px;font-size:.66rem;color:#80b8ff;display:flex;align-items:center;gap:6px}',
    '.lf-meta-actions{display:flex;gap:6px}',
    '.lf-meta-ok{flex:1;padding:7px;background:#1e6fd9;color:#fff;border:none;border-radius:8px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:5px}',
    '.lf-meta-ok:hover{background:#1660c5}',
    '.lf-meta-cancel{padding:7px 12px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.1);border-radius:8px;font-size:.72rem;font-weight:700;cursor:pointer;font-family:var(--font)}',
    /* Save note */
    '.lf-save-note{position:absolute;bottom:130px;left:50%;transform:translateX(-50%);z-index:1002;background:rgba(13,146,104,.92);color:#fff;padding:5px 14px;border-radius:20px;font-size:.65rem;font-weight:800;white-space:nowrap;box-shadow:0 3px 12px rgba(0,0,0,.3);opacity:0;transition:opacity .25s;pointer-events:none}',
    '.lf-save-note.show{opacity:1}',
    /* Pick coord */
    '.lf-pick-cursor .leaflet-container{cursor:crosshair!important}',
    '.lf-pick-banner{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:1200;background:rgba(13,146,104,.92);color:#fff;padding:6px 18px;border-radius:20px;font-size:.68rem;font-weight:800;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.35);display:flex;align-items:center;gap:7px;pointer-events:auto;font-family:var(--font)}',
    '.lf-pick-cancel{background:rgba(255,255,255,.18);border:none;color:#fff;padding:2px 8px;border-radius:10px;font-size:.62rem;font-weight:800;cursor:pointer;font-family:var(--font);margin-left:6px}',
    /* Nav ctrl */
    '.lf-nav-wrap{position:absolute;bottom:10px;left:10px;z-index:900;display:flex;flex-direction:column;align-items:center;gap:0}',
    '.lf-nav-toggle{width:30px;height:30px;border-radius:6px;background:rgba(15,23,42,.9);color:#fff;border:1.5px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:.8rem;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 2px 10px rgba(0,0,0,.32);transition:background .14s}',
    '.lf-nav-toggle:hover,.lf-nav-toggle.open{background:rgba(30,111,217,.85)}',
    '.lf-nav-panel{display:flex;flex-direction:column;align-items:center;gap:2px;overflow:hidden;max-height:0;opacity:0;transition:max-height .22s ease,opacity .18s ease;margin-bottom:3px}',
    '.lf-nav-panel.open{max-height:200px;opacity:1}',
    '.lf-nav-btn{width:28px;height:28px;border-radius:5px;background:rgba(10,20,42,.88);color:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:.72rem;cursor:pointer;transition:background .12s}',
    '.lf-nav-btn:hover{background:rgba(30,111,217,.75);color:#fff}',
    '.lf-nav-row{display:flex;gap:2px}',
    '.lf-nav-sep{height:1px;width:28px;background:rgba(255,255,255,.1);margin:1px 0}',
    /* Legend bar */
    '.peta-legend{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;padding:8px 12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)}',
    '.peta-legend-title{font-size:.58rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);width:100%}',
    '.peta-legend-item{display:flex;align-items:center;gap:5px;font-size:.63rem;color:var(--mid);font-weight:600}',
    /* Popup custom */
    '.leaflet-popup-content-wrapper{border-radius:10px!important;padding:0!important;overflow:hidden!important;border:none!important;box-shadow:0 6px 24px rgba(0,0,0,.18)!important}',
    '.leaflet-popup-content{margin:10px 13px!important;font-family:var(--font)!important;font-size:.75rem!important;line-height:1.6!important}',
    '.leaflet-popup-tip-container{display:none!important}',
    '.leaflet-popup-tip{display:none!important}',
    '.lf-popup-title{font-weight:800;color:var(--navy);display:flex;align-items:center;gap:5px;margin-bottom:4px}',
    '.lf-popup-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:.58rem;font-weight:700;margin-bottom:5px}',
    '.lf-popup-row{display:flex;align-items:flex-start;gap:5px;font-size:.64rem;color:var(--mid);margin-top:3px}',
    '.lf-popup-row i{color:var(--muted);width:12px;text-align:center;flex-shrink:0;margin-top:2px}',
    /* Tooltip */
    '.leaflet-tooltip{background:#fff!important;color:#1e3a5f!important;border:1px solid rgba(30,111,217,.22)!important;border-radius:7px!important;padding:5px 10px!important;font-size:.67rem!important;font-weight:700!important;box-shadow:0 2px 10px rgba(0,0,0,.1)!important}',
    '.leaflet-tooltip::before{display:none!important}',
    '.lf-tip-clean{background:#fff!important;color:#1e3a5f!important;border:1px solid rgba(30,111,217,.25)!important;border-radius:6px!important;padding:4px 9px!important;font-size:.67rem!important;font-weight:700!important}',
    '.leaflet-interactive:focus{outline:none!important}',
    /* PDF overlay */
    '.pdf-render-ov{position:fixed;inset:0;z-index:99999;background:rgba(6,14,30,.82);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;opacity:0;pointer-events:none;transition:opacity .2s}',
    '.pdf-render-ov.show{opacity:1;pointer-events:auto}',
    '.pdf-render-spinner{width:46px;height:46px;border:4px solid rgba(255,255,255,.12);border-top:4px solid #1e6fd9;border-radius:50%;animation:peta-spin .8s linear infinite}',
    '@keyframes peta-spin{to{transform:rotate(360deg)}}',
    '.pdf-render-txt{color:#fff;font-size:.8rem;font-weight:700;text-align:center}',
    '.pdf-render-sub{color:rgba(255,255,255,.45);font-size:.67rem;text-align:center}',
    '.pdf-render-progress{width:200px;height:4px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden}',
    '.pdf-render-bar{height:100%;background:linear-gradient(90deg,#1e6fd9,#0891b2);border-radius:2px;transition:width .3s ease;width:0%}',
    /* PDF modal */
    '.pdf-ov{position:fixed;inset:0;z-index:9800;background:rgba(6,12,28,.88);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .28s}',
    '.pdf-ov.show{opacity:1;pointer-events:auto}',
    '.pdf-modal{background:var(--card);border-radius:18px;box-shadow:0 32px 80px rgba(0,0,0,.55);width:100%;max-width:1100px;height:90vh;display:flex;flex-direction:column;overflow:hidden}',
    '.pdf-mhd{padding:12px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}',
    '.pdf-mtitle{font-size:.8rem;font-weight:800;color:var(--text);display:flex;align-items:center;gap:7px}',
    '.pdf-macts{display:flex;gap:6px;align-items:center}',
    '.pdf-mbody{flex:1;display:flex;min-height:0;overflow:hidden}',
    '.pdf-opts{width:260px;flex-shrink:0;border-right:1px solid var(--border);overflow-y:auto;background:var(--bg)}',
    '.pdf-opts::-webkit-scrollbar{width:3px}',
    '.pdf-opts::-webkit-scrollbar-thumb{background:var(--bdark);border-radius:2px}',
    '.pdf-sect{padding:12px 12px 0}',
    '.pdf-sect-lbl{font-size:.58rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:7px;display:flex;align-items:center;gap:5px}',
    '.pdf-chk{display:flex;align-items:center;gap:7px;padding:6px 8px;background:var(--card);border:1px solid var(--border);border-radius:7px;margin-bottom:4px;cursor:pointer;user-select:none;transition:all .12s}',
    '.pdf-chk:hover{border-color:var(--teal)}',
    '.pdf-chk.on{border-color:var(--teal);background:var(--teall)}',
    '.pdf-chk input[type=checkbox]{accent-color:var(--teal);width:13px;height:13px;flex-shrink:0;pointer-events:none}',
    '.pdf-chk label{font-size:.68rem;color:var(--text);line-height:1.4;pointer-events:none}',
    '.pdf-chk label small{display:block;font-size:.57rem;color:var(--muted)}',
    '.pdf-map-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:10px}',
    '.pdf-map-btn{padding:7px 4px;border:1.5px solid var(--border);border-radius:7px;background:var(--card);font-size:.6rem;font-weight:700;color:var(--muted);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all .13s;font-family:var(--font)}',
    '.pdf-map-btn:hover,.pdf-map-btn.on{border-color:var(--teal);color:var(--teal);background:var(--teall)}',
    '.pdf-btn-row{display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap}',
    '.pdf-btn-opt{flex:1;min-width:50px;padding:6px 4px;border:1.5px solid var(--border);border-radius:7px;background:var(--card);font-size:.6rem;font-weight:700;color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .13s;font-family:var(--font)}',
    '.pdf-btn-opt:hover,.pdf-btn-opt.on{border-color:var(--teal);background:var(--teall);color:var(--teal)}',
    '.pdf-leg-row{display:flex;align-items:center;gap:6px;margin-bottom:6px}',
    '.pdf-leg-swatch{width:24px;height:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center}',
    '.pdf-leg-inp{flex:1;padding:4px 7px;border:1px solid var(--border);border-radius:5px;font-size:.68rem;font-family:var(--font);color:var(--text);outline:none;background:var(--card)}',
    '.pdf-leg-inp:focus{border-color:var(--teal)}',
    '.pdf-leg-del{width:22px;height:22px;border-radius:5px;border:none;background:var(--bg);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.6rem}',
    '.pdf-leg-del:hover{background:var(--redl);color:var(--red)}',
    '.pdf-leg-add{width:100%;padding:5px;border:1.5px dashed var(--border);border-radius:7px;background:transparent;color:var(--muted);font-size:.65rem;cursor:pointer;font-family:var(--font);transition:all .13s;margin-top:4px}',
    '.pdf-leg-add:hover{border-color:var(--teal);color:var(--teal)}',
    '.pdf-map-area{flex:1;display:flex;flex-direction:column;overflow:hidden}',
    '.pdf-map-banner{flex-shrink:0;background:rgba(10,104,128,.06);border-bottom:1px solid rgba(10,104,128,.14);padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px}',
    '.pdf-map-frame{flex:1;overflow:hidden;background:#e4eaf5}',
    '#pdf-map-preview{width:100%;height:100%}',
    /* Loader */
    '#lf-loader{display:none;position:absolute;inset:0;background:rgba(235,239,248,.88);backdrop-filter:blur(6px);z-index:800;border-radius:12px;flex-direction:column;align-items:center;justify-content:center;gap:10px}',
    /* Simbol grid */
    '.mlayer-simbol-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:8px}',
    '.msimbol-btn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 3px;border:1.5px solid var(--border);border-radius:7px;background:var(--card);font-size:.55rem;font-weight:700;color:var(--muted);cursor:pointer;transition:all .13s;font-family:var(--font);line-height:1.2}',
    '.msimbol-btn:hover{border-color:var(--teal);color:var(--teal)}',
    '.msimbol-btn.on{border-color:var(--teal);background:var(--teall);color:var(--teal)}',
    '.msimbol-btn .simbol-ico{font-size:.85rem}',
    /* Warna swatches */
    '.color-swatches{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}',
    '.color-swatch{width:24px;height:24px;border-radius:6px;cursor:pointer;border:2.5px solid transparent;transition:transform .12s,border-color .12s;flex-shrink:0}',
    '.color-swatch:hover,.color-swatch.on{border-color:var(--text);transform:scale(1.15)}',
    /* Layer list */
    '.layer-list-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;border:1px solid var(--border);margin-bottom:5px;background:var(--card);transition:all .13s}',
    '.layer-list-item:hover{border-color:var(--teal)}',
    '.layer-list-item.inactive{opacity:.55}',
    '.layer-item-ico{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.78rem;flex-shrink:0}',
    '.layer-item-info{flex:1;min-width:0}',
    '.layer-item-name{font-size:.7rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.layer-item-sub{font-size:.58rem;color:var(--muted)}',
    '.layer-item-acts{display:flex;gap:4px;flex-shrink:0}',
    /* Mymaps bar */
    '.mymaps-bar{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:500;background:rgba(10,22,44,.85);backdrop-filter:blur(10px);color:#fff;border-radius:20px;padding:5px 14px;font-size:.67rem;font-weight:700;display:flex;align-items:center;gap:7px;box-shadow:0 4px 16px rgba(0,0,0,.35)}',
    '.mymaps-open-btn{background:rgba(30,111,217,.9);color:#fff;border:none;border-radius:12px;padding:4px 12px;font-size:.64rem;font-weight:800;cursor:pointer;font-family:var(--font);display:inline-flex;align-items:center;gap:5px;text-decoration:none}',
  ].join('');
  document.head.appendChild(s);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. LOAD HALAMAN PETA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function loadPeta() {
  setNav('peta');
  setPage('Peta Kepatihan', 'Peta wilayah & aset Kelurahan Kepatihan');
  sbClose(); dAllCharts();
  _injectPetaStyles();
  _destroyLeaflet();
  document.removeEventListener('keydown', _onPetaKeyEsc);

  G('ct').innerHTML = `
  <div class="fu" id="peta-main-wrap" style="padding:0!important;position:relative">

    <!-- Toolbar -->
    <div style="padding:10px 14px 0;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div class="peta-mode-toggle">
        <button class="peta-mode-btn on" id="btn-lf" onclick="switchPetaMode('leaflet')">
          <i class="fas fa-layer-group"></i> Peta Realtime
        </button>
        <button class="peta-mode-btn" id="btn-mm" onclick="switchPetaMode('mymaps')">
          <i class="fas fa-map"></i> Google My Maps
        </button>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
        <button class="peta-btn" id="btn-edit-layer" onclick="openLayerModal()">
          <i class="fas fa-pen-to-square"></i> Edit Layer
        </button>
        <button class="peta-btn" id="btn-print-pdf" onclick="openPdfModal()">
          <i class="fas fa-print"></i> Cetak PDF
        </button>
        <a class="peta-btn" id="btn-open-mm" href="${_MYMAPS_VIEWER}" target="_blank"
           rel="noopener" style="display:none;text-decoration:none">
          <i class="fas fa-external-link-alt"></i> Buka My Maps
        </a>
        <button class="peta-btn" id="btn-fs" onclick="togglePetaFullscreen()">
          <i class="fas fa-expand" id="btn-fs-ico"></i>
          <span id="btn-fs-lbl">Layar Penuh</span>
        </button>
        <button class="peta-btn peta-btn-primary" onclick="reloadPetaActive()">
          <i class="fas fa-sync"></i> Refresh
        </button>
      </div>
    </div>

    <!-- Peta area -->
    <div style="flex:1;padding:8px 14px;min-height:0;position:relative">

      <!-- Leaflet wrap -->
      <div id="lf-wrap" style="height:calc(100vh - 190px);min-height:360px;border-radius:12px;overflow:hidden;border:1px solid var(--border);box-shadow:var(--sh);position:relative">
        <div id="lf-map-div" style="width:100%;height:100%"></div>
        <div id="lf-loader">
          <div class="spw"><div class="spo"></div><div class="spi"></div></div>
          <span style="font-size:.72rem;font-weight:700;color:var(--mid)">Memuat peta...</span>
        </div>

        <!-- Category panel toggle -->
        <button class="peta-cat-btn" id="peta-cat-btn" onclick="toggleCatPanel()" title="Filter Kategori">
          <i class="fas fa-filter"></i>
        </button>
        <div class="peta-cat-panel hidden" id="peta-cat-panel"></div>

        <!-- Draw toggle -->
        <button class="lf-draw-toggle" id="btn-draw-toggle" onclick="toggleDrawPanel()" title="Gambar & Ukur">
          <i class="fas fa-pen-ruler"></i>
        </button>
        <div class="lf-draw-panel hidden" id="lf-draw-panel">
          <div class="lf-dp-lbl">Gambar</div>
          <button class="lf-dp-item" id="btn-draw-line" onclick="startDraw('polyline')">
            <i class="fas fa-pen-nib" style="color:#1e6fd9"></i> Garis / Rute
          </button>
          <button class="lf-dp-item" id="btn-draw-area" onclick="startDraw('polygon')">
            <i class="fas fa-vector-square" style="color:#7c3aed"></i> Area / Zona
          </button>
          <div class="lf-dp-sep"></div>
          <div class="lf-dp-lbl">Kelola</div>
          <button class="lf-dp-item" id="btn-draw-save" onclick="saveDrawings()">
            <i class="fas fa-floppy-disk" style="color:#0d9268"></i> Simpan
          </button>
          <button class="lf-dp-item" id="btn-draw-load" onclick="loadDrawings()">
            <i class="fas fa-download" style="color:#d97706"></i> Muat
          </button>
          <button class="lf-dp-item danger" onclick="clearDrawings()">
            <i class="fas fa-eraser" style="color:#c0392b"></i> Hapus Semua
          </button>
        </div>

        <!-- Meta overlay -->
        <div class="lf-meta-ov" id="lf-meta-ov">
          <div class="lf-meta-title" id="lf-meta-title">
            <i class="fas fa-pen-nib"></i> Tambah Detail Gambar
          </div>
          <div class="lf-meta-msr" id="lf-meta-msr" style="display:none">
            <i class="fas fa-ruler"></i><span id="lf-meta-msr-txt"></span>
          </div>
          <div class="lf-meta-row">
            <div>
              <label style="font-size:.58rem;font-weight:700;color:rgba(255,255,255,.38);display:block;margin-bottom:4px;text-transform:uppercase">
                Nama <span style="color:#c0392b">*</span>
              </label>
              <input class="lf-meta-inp" id="lf-meta-nama" placeholder="Nama garis / area..." maxlength="80">
            </div>
            <div>
              <label style="font-size:.58rem;font-weight:700;color:rgba(255,255,255,.38);display:block;margin-bottom:4px;text-transform:uppercase">Keterangan</label>
              <input class="lf-meta-inp" id="lf-meta-ket" placeholder="Deskripsi singkat..." maxlength="120">
            </div>
          </div>
          <label style="font-size:.58rem;font-weight:700;color:rgba(255,255,255,.38);display:block;margin-bottom:5px;text-transform:uppercase">Warna</label>
          <div class="lf-meta-swatches" id="lf-meta-swatches"></div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <input type="color" id="lf-meta-color" value="#1e6fd9" oninput="metaWarnaCustom(this.value)"
                   style="width:28px;height:28px;border:none;border-radius:5px;cursor:pointer;background:none;padding:0">
            <span id="lf-meta-color-lbl" style="font-size:.62rem;font-family:var(--mono);color:rgba(255,255,255,.42)">#1e6fd9</span>
          </div>
          <div class="lf-meta-actions">
            <button class="lf-meta-ok" onclick="confirmDrawMeta()">
              <i class="fas fa-check"></i> Tambahkan ke Peta
            </button>
            <button class="lf-meta-cancel" onclick="cancelDrawMeta()">Batal</button>
          </div>
        </div>

        <div class="lf-save-note" id="lf-save-note">Disimpan!</div>
      </div><!-- /lf-wrap -->

      <!-- MyMaps wrap -->
      <div id="mm-wrap" style="display:none;height:calc(100vh - 190px);min-height:360px;position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--border);box-shadow:var(--sh)">
        <div class="peta-shimmer" id="peta-shimmer">
          <i class="fas fa-map-location-dot"></i>
          <p>Memuat peta Google My Maps...</p>
        </div>
        <div style="position:absolute;inset:0;overflow:hidden;border-radius:12px">
          <iframe id="peta-frame" src="${_MYMAPS_URL}" allowfullscreen loading="eager"
            referrerpolicy="no-referrer-when-downgrade" onload="onPetaFrameLoad()"
            style="position:absolute;top:-60px;left:0;width:100%;height:calc(100% + 60px);border:none;opacity:0;transition:opacity .4s">
          </iframe>
        </div>
      </div>

    </div><!-- /peta area -->

    <!-- Legend bar -->
    <div id="peta-legend-bar" style="padding:0 14px 10px;flex-shrink:0"></div>

  </div><!-- /peta-main-wrap -->

  <!-- PDF render overlay -->
  <div class="pdf-render-ov" id="pdf-render-ov">
    <div class="pdf-render-spinner"></div>
    <div class="pdf-render-txt" id="pdf-render-txt">Menyiapkan render...</div>
    <div class="pdf-render-sub" id="pdf-render-sub">Mohon tunggu</div>
    <div class="pdf-render-progress"><div class="pdf-render-bar" id="pdf-render-bar"></div></div>
  </div>

  <!-- PDF modal -->
  <div class="pdf-ov" id="pdf-ov">
    <div class="pdf-modal">
      <div class="pdf-mhd">
        <div class="pdf-mtitle"><i class="fas fa-file-pdf" style="color:#c0392b"></i> Pratinjau &amp; Cetak Peta</div>
        <div class="pdf-macts">
          <button class="bg2" onclick="closePdfModal()"><i class="fas fa-times"></i> Tutup</button>
          <button class="bg2" id="btn-pdf-print" onclick="execPrint()"><i class="fas fa-print"></i> Cetak</button>
          <button class="bp" id="btn-pdf-dl" onclick="execDownload()"><i class="fas fa-download"></i> Unduh PDF</button>
        </div>
      </div>
      <div class="pdf-mbody">
        <div class="pdf-opts" id="pdf-opts-panel"></div>
        <div class="pdf-map-area">
          <div class="pdf-map-banner">
            <div style="font-size:.62rem;color:var(--mid);display:flex;align-items:center;gap:6px">
              <i class="fas fa-circle-info" style="color:var(--teal)"></i>
              Atur tampilan (pan, zoom), lalu cetak/unduh PDF
            </div>
            <div style="display:flex;gap:4px">
              <button class="bg2" style="font-size:.6rem;padding:4px 10px" onclick="fitPdfMapBounds()">
                <i class="fas fa-expand-arrows-alt"></i> Fit Semua
              </button>
              <button class="bg2" style="font-size:.6rem;padding:4px 7px" onclick="if(_pdfMap)_pdfMap.zoomIn()"><i class="fas fa-plus"></i></button>
              <button class="bg2" style="font-size:.6rem;padding:4px 7px" onclick="if(_pdfMap)_pdfMap.zoomOut()"><i class="fas fa-minus"></i></button>
            </div>
          </div>
          <div class="pdf-map-frame"><div id="pdf-map-preview"></div></div>
        </div>
      </div>
    </div>
  </div>`;

  _buildMetaSwatches();
  document.addEventListener('keydown', _onPetaKeyEsc);
  _initLeaflet();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. MODE SWITCH & CONTROLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function switchPetaMode(mode) {
  if (_petaMode === mode) return;
  _petaMode = mode;
  const bLF=G('btn-lf'), bMM=G('btn-mm');
  const wLF=G('lf-wrap'), wMM=G('mm-wrap');
  const bEL=G('btn-edit-layer'), bPR=G('btn-print-pdf'), bOM=G('btn-open-mm');
  if (mode==='mymaps') {
    bMM.classList.add('on'); bLF.classList.remove('on');
    wLF.style.display='none'; wMM.style.display='';
    if (bEL) bEL.style.display='none'; if (bPR) bPR.style.display='none'; if (bOM) bOM.style.display='';
    closeDrawPanel();
  } else {
    bLF.classList.add('on'); bMM.classList.remove('on');
    wMM.style.display='none'; wLF.style.display='';
    if (bEL) bEL.style.display=''; if (bPR) bPR.style.display=''; if (bOM) bOM.style.display='none';
    if (!_lfMap) _initLeaflet();
    else setTimeout(() => { if (_lfMap) _lfMap.invalidateSize({ animate:false }); }, 80);
  }
}

function reloadPetaActive() {
  if (_petaMode==='mymaps') _reloadMymaps(); else refreshLeaflet();
}

function _reloadMymaps() {
  const fr=G('peta-frame'), sh=G('peta-shimmer');
  if (!fr) return;
  if (sh) sh.classList.remove('hidden');
  fr.style.opacity='0'; fr.src='';
  setTimeout(() => { fr.src = _MYMAPS_URL; }, 100);
}

function onPetaFrameLoad() {
  const sh=G('peta-shimmer'), fr=G('peta-frame');
  if (sh) sh.classList.add('hidden'); if (fr) fr.style.opacity='1';
}

function togglePetaFullscreen() {
  _petaFullscreen = !_petaFullscreen;
  const wrap=G('peta-main-wrap'), ico=G('btn-fs-ico'), lbl=G('btn-fs-lbl');
  if (_petaFullscreen) {
    wrap.classList.add('peta-fs-active');
    if (ico) ico.className='fas fa-compress'; if (lbl) lbl.textContent='Keluar Penuh';
    document.body.style.overflow='hidden';
  } else {
    wrap.classList.remove('peta-fs-active');
    if (ico) ico.className='fas fa-expand'; if (lbl) lbl.textContent='Layar Penuh';
    document.body.style.overflow='';
  }
  if (_lfMap) setTimeout(() => _lfMap.invalidateSize({ animate:false }), 350);
}

function _onPetaKeyEsc(e) {
  if (e.key !== 'Escape') return;
  if (_pickCoordMode)         { _cancelPickCoord(); return; }
  if (_pdfModalOpen)          { closePdfModal(); return; }
  if (G('lf-meta-ov')?.classList.contains('show')) { cancelDrawMeta(); return; }
  if (_drawPanelOpen)         { closeDrawPanel(); return; }
  if (_activeDrawMode)        { _cancelDraw(); return; }
  if (_catPanelOpen)          { _closeCatPanel(); return; }
  if (_petaFullscreen)        { togglePetaFullscreen(); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. LEAFLET INIT & REFRESH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function _lfShowLoad(m) {
  const el=G('lf-loader'), sp=el?.querySelector('span');
  if (sp) sp.textContent=m||'Memuat...'; if (el) el.style.display='flex';
}
function _lfHideLoad() { const el=G('lf-loader'); if (el) el.style.display='none'; }

/* ─── Batas Wilayah GeoJSON ─── */
let _batasLayer = null;

async function _renderBatasWilayah() {
  if (!_lfMap) return;
  if (_batasLayer) { try { _lfMap.removeLayer(_batasLayer); } catch(e){} _batasLayer = null; }
  try {
    const res = await fetch('assets/kepatihan.geojson');
    const gj  = await res.json();
    _batasLayer = L.geoJSON(gj, {
      filter      : feature => feature.geometry.type !== 'Point',
      interactive : false,
      style: {
        color      : '#0a6880',
        weight     : 2.5,
        opacity    : 0.9,
        fillColor  : '#0a6880',
        fillOpacity: 0.06,
        dashArray  : '6 4',
      },
      onEachFeature: (feature, layer) => {
        const nama = feature.properties?.Name
                  || feature.properties?.nm_kelurahan
                  || 'Kel. Kepatihan';
        layer.bindTooltip(nama, {
          permanent   : true,
          direction   : 'center',
          className   : 'lf-tip-clean',
          opacity     : 0.82,
          interactive : false,
        });
        /* Paksa non-interactive setelah layer dibuat */
        layer.options.interactive = false;
        if (layer._path) layer._path.style.pointerEvents = 'none';
      },
    }).addTo(_lfMap);

    /* Paksa semua path dalam layer group non-interactive via CSS */
    if (_batasLayer) {
      _batasLayer.eachLayer(l => {
        if (l._path) l._path.style.pointerEvents = 'none';
      });
      if (_batasLayer.bringToBack) _batasLayer.bringToBack();
    }

  } catch(e) {
    console.warn('[Peta] Gagal memuat batas wilayah:', e.message);
  }
}

function _destroyLeaflet() {
  _cancelPickCoord();
  if (_activeDrawHandler) { try { _activeDrawHandler.disable(); } catch(e){} _activeDrawHandler=null; }
  if (_lfMap) { try { _lfMap.off(); _lfMap.remove(); } catch(e){} _lfMap=null; }
  _lfMarkers=[]; _drawnItems=null; _drawControl=null;
  _activeDrawMode=null; _drawPanelOpen=false; _drawnMeta={};
  _pendingLayer=null; _pendingLayerType=null;
  _petaTileLayers={}; _layerData=[];
  _batasLayer = null;
}

function _ensureLeafletLoaded(cb) {
  if (window.L && window.L.Draw) { cb(); return; }
  function lC(h,i) { if (document.getElementById(i)) return; const l=document.createElement('link'); l.id=i; l.rel='stylesheet'; l.href=h; document.head.appendChild(l); }
  function lS(s,fn) { const e=document.createElement('script'); e.src=s; e.onload=fn; document.head.appendChild(e); }
  lC('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css','lf-css');
  lC('https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css','lf-draw-css');
  if (!window.L) lS('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
    () => lS('https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js', cb));
  else lS('https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js', cb);
}

function _initLeaflet() {
  _ensureLeafletLoaded(() => {
    const md=G('lf-map-div'); if (!md) return;
    if (_lfMap) {
      if (!document.body.contains(_lfMap.getContainer())) { try{_lfMap.off();_lfMap.remove();}catch(e){} _lfMap=null; }
      else { setTimeout(()=>{ if(_lfMap) _lfMap.invalidateSize({animate:false}); },80); refreshLeaflet(); return; }
    }
    _lfMap = L.map('lf-map-div',{ center:_PETA_CENTER, zoom:_PETA_ZOOM, zoomControl:false, attributionControl:true });

    /* Base layers */
    const tiles = {};
    Object.keys(_TILE_LAYERS).forEach(k => {
      tiles[k] = L.tileLayer(_TILE_LAYERS[k].url, {
        attribution:_TILE_LAYERS[k].attr, maxZoom:_TILE_LAYERS[k].maxZoom||19, crossOrigin:true
      });
    });
    tiles.osm.addTo(_lfMap);

    L.control.layers({
      '<i class="fas fa-map" style="color:#1e6fd9"></i>&nbsp;OSM'              : tiles.osm,
      '<i class="fas fa-satellite" style="color:#0d9268"></i>&nbsp;Satelit'    : tiles.satelit,
      '<i class="fas fa-earth-asia" style="color:#2563eb"></i>&nbsp;Google Satelit' : tiles.googleSatelit,
      '<i class="fas fa-globe" style="color:#ea580c"></i>&nbsp;Hybrid'         : tiles.hybrid,
      '<i class="fas fa-map-location" style="color:#7c3aed"></i>&nbsp;CartoDB' : tiles.carto,
      '<i class="fas fa-mountain" style="color:#b45309"></i>&nbsp;Topo'        : tiles.topo,
    },{},{collapsed:true,position:'topright'}).addTo(_lfMap);

    L.control.scale({ imperial:false, position:'bottomright' }).addTo(_lfMap);

    /* Draw */
    _drawnItems = new L.FeatureGroup().addTo(_lfMap);
    _drawControl = new L.Control.Draw({
      position:'topright',
      draw:{
        polyline:{ shapeOptions:{color:'#1e6fd9',weight:3,opacity:.9,dashArray:'6 4'} },
        polygon:{ allowIntersection:false, shapeOptions:{color:'#7c3aed',weight:2.5,opacity:1,fillColor:'#7c3aed',fillOpacity:.12} },
        rectangle:false, circle:false, marker:false, circlemarker:false,
      },
      edit:{ featureGroup:_drawnItems, remove:true },
    });
    _drawControl.addTo(_lfMap);
    setTimeout(() => { const dc=document.querySelector('.leaflet-draw'); if(dc) dc.style.display='none'; }, 200);

    _lfMap.on(L.Draw.Event.CREATED, e => {
      _showMetaForm(e.layer, _activeDrawMode||(e.layerType==='polyline'?'polyline':'polygon'));
      _activeDrawMode=null;
    });
    _lfMap.on(L.Draw.Event.DRAWSTOP, () => _setDrawBtns(null));
    _lfMap.on('click', () => { if (_catPanelOpen) _closeCatPanel(); });

    _addNavCtrl(); _renderBatasWilayah();
    refreshLeaflet();
    loadDrawings(true);  /* auto-load saat peta siap */
  });
}

async function refreshLeaflet() {
  if (!_lfMap) { _initLeaflet(); return; }
  _lfShowLoad('Memuat data...');
  try {
    const res = await gasCall('getPetaData');
    _lfHideLoad();
    if (!res.success) { toast('Gagal memuat peta: '+res.message,'er'); return; }
    _layerData = res.data || [];
    _renderLeafletLayers(_layerData);
    _renderCatPanel();
    _renderLegendBar(_layerData);
    _precacheSimbolIcons();
    toast('Peta diperbarui: '+_layerData.filter(l=>l.aktif).length+' lokasi aktif.','ok');
  } catch(e) { _lfHideLoad(); toast('Error: '+e.message,'er'); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   6. RENDER MARKER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function _makeLeafletIcon(warna, faIco) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <ellipse cx="16" cy="39" rx="5" ry="2.5" fill="rgba(0,0,0,.2)"/>
    <path d="M16 0C9.37 0 4 5.37 4 12c0 9.5 12 28 12 28S28 21.5 28 12C28 5.37 22.63 0 16 0z" fill="${warna}"/>
    <circle cx="16" cy="12" r="8" fill="rgba(255,255,255,.22)"/>
  </svg>`;
  return L.divIcon({
    html:`<div style="position:relative;width:32px;height:42px">${svg}<i class="fas ${faIco}" style="position:absolute;top:6px;left:50%;transform:translateX(-50%);color:#fff;font-size:9px;pointer-events:none"></i></div>`,
    className:'', iconSize:[32,42], iconAnchor:[16,42], popupAnchor:[0,-40],
  });
}

function _renderLeafletLayers(data) {
  _lfMarkers.forEach(m => { try{ _lfMap.removeLayer(m); }catch(e){} });
  _lfMarkers=[];

  const filtered = _catFilter
    ? data.filter(l => l.kategori===_catFilter && l.aktif && l.lat && l.lng)
    : data.filter(l => l.aktif && l.lat && l.lng);

  filtered.forEach(layer => {
    const sd    = _getSimbolDef(layer.simbol || layer.kategori);
    const warna = layer.warna || sd.warna;
    const popup = `<div class="lf-popup-title">
      <i class="fas ${sd.ico}" style="color:${warna}"></i> ${esc(layer.nama)}
    </div>
    <div class="lf-popup-badge" style="background:${warna}22;color:${warna};border:1px solid ${warna}30">
      <i class="fas ${sd.ico}"></i> ${sd.label}
    </div>
    ${layer.deskripsi||layer.ket ? `<div class="lf-popup-row"><i class="fas fa-info-circle"></i><span>${esc(layer.deskripsi||layer.ket)}</span></div>` : ''}
    ${layer.alamat ? `<div class="lf-popup-row"><i class="fas fa-location-dot"></i><span>${esc(layer.alamat)}</span></div>` : ''}
    <div class="lf-popup-row">
      <i class="fas fa-crosshairs" style="color:${warna}"></i>
      <span style="font-family:var(--mono);font-size:.6rem">${(+layer.lat).toFixed(5)}, ${(+layer.lng).toFixed(5)}</span>
    </div>
    <div style="margin-top:8px">
      <a href="https://www.google.com/maps/search/?api=1&query=${layer.lat},${layer.lng}"
         target="_blank" rel="noopener" style="font-size:.63rem;color:${warna};display:inline-flex;align-items:center;gap:4px">
        <i class="fas fa-directions"></i> Google Maps
      </a>
    </div>`;

    const m = L.marker([layer.lat, layer.lng], { icon: _makeLeafletIcon(warna, sd.ico) })
      .addTo(_lfMap).bindPopup(popup, { maxWidth:260 });
    _lfMarkers.push(m);
  });
}

function zoomPeta(lat,lng) {
  if (_lfMap) { _lfMap.setView([lat,lng],17); setTimeout(()=>{ if(_lfMap) _lfMap.invalidateSize(); },100); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   7. CATEGORY PANEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function toggleCatPanel() {
  const p=G('peta-cat-panel');
  if (p?.classList.contains('visible')) { _closeCatPanel(); return; }
  _renderCatPanel();
  p?.classList.remove('hidden'); p?.classList.add('visible');
  G('peta-cat-btn')?.classList.add('active');
  _catPanelOpen=true;
}

function _closeCatPanel() {
  G('peta-cat-panel')?.classList.remove('visible');
  G('peta-cat-panel')?.classList.add('hidden');
  G('peta-cat-btn')?.classList.remove('active');
  _catPanelOpen=false;
}

function _renderCatPanel() {
  const p=G('peta-cat-panel'); if (!p) return;
  const counts={};
  (_layerData||[]).filter(l=>l.aktif).forEach(l => { const k=l.kategori||l.simbol||'lainnya'; counts[k]=(counts[k]||0)+1; });
  const total = Object.values(counts).reduce((a,b)=>a+b,0);

  let h = '<div class="pcp-lbl">Filter Kategori</div>';
  h += `<button class="pcp-btn${_catFilter===null?' on':''}" onclick="selectCatFilter(null)">
    <i class="fas fa-layer-group si" style="color:#80b8ff"></i>Semua Lokasi
    <span class="sc">${total}</span>
  </button>`;
  h += '<div class="pcp-sep"></div>';
  _SIMBOL_DEF.forEach(s => {
    const cnt=counts[s.id]||0, isA=_catFilter===s.id;
    h += `<button class="pcp-btn${isA?' on':''}" onclick="selectCatFilter('${s.id}')">
      <i class="fas ${s.ico} si" style="color:${s.warna}"></i>${s.label}
      <span class="sc"${!cnt?' style="opacity:.3"':''}>${cnt}</span>
    </button>`;
  });
  p.innerHTML=h;
}

function selectCatFilter(cat) {
  _catFilter=cat; _closeCatPanel();
  _renderLeafletLayers(_layerData);
  const sd = cat ? _getSimbolDef(cat) : null;
  toast(sd ? `Filter: ${sd.label}` : 'Menampilkan semua lokasi', 'inf');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   8. LEGEND BAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function _renderLegendBar(data) {
  const bar=G('peta-legend-bar'); if (!bar) return;
  const counts={};
  data.filter(l=>l.aktif).forEach(l => { const k=l.kategori||l.simbol||'lainnya'; counts[k]=(counts[k]||0)+1; });
  const items = _SIMBOL_DEF.filter(s=>counts[s.id]).map(s =>
    `<span class="peta-legend-item" style="cursor:pointer" onclick="selectCatFilter('${s.id}')">
      <i class="fas ${s.ico}" style="color:${s.warna};font-size:.72rem"></i>${s.label}
      <strong style="font-family:var(--mono);color:${s.warna}">${counts[s.id]}</strong>
    </span>`
  );
  bar.innerHTML = `<div class="peta-legend">
    <div class="peta-legend-title"><i class="fas fa-circle-info" style="color:var(--teal)"></i> Keterangan Lokasi Aktif</div>
    ${items.length ? items.join('') : '<span style="font-size:.62rem;color:var(--muted)">Belum ada lokasi aktif</span>'}
    ${_catFilter ? `<button class="be" style="margin-left:auto;font-size:.6rem" onclick="selectCatFilter(null)"><i class="fas fa-times"></i> Reset filter</button>` : ''}
  </div>`;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   9. NAV CONTROL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function _addNavCtrl() {
  const mc=_lfMap.getContainer();
  const wrap=document.createElement('div'); wrap.className='lf-nav-wrap'; wrap.id='lf-nav-wrap';
  wrap.innerHTML=`
    <div class="lf-nav-panel" id="lf-nav-panel">
      <button class="lf-nav-btn" title="Zoom In"  onclick="if(_lfMap)_lfMap.zoomIn()"><i class="fas fa-plus"></i></button>
      <button class="lf-nav-btn" title="Zoom Out" onclick="if(_lfMap)_lfMap.zoomOut()"><i class="fas fa-minus"></i></button>
      <div class="lf-nav-sep"></div>
      <button class="lf-nav-btn" onclick="if(_lfMap)_lfMap.panBy([0,-80])"><i class="fas fa-chevron-up"></i></button>
      <div class="lf-nav-row">
        <button class="lf-nav-btn" onclick="if(_lfMap)_lfMap.panBy([-80,0])"><i class="fas fa-chevron-left"></i></button>
        <button class="lf-nav-btn" onclick="if(_lfMap)_lfMap.panBy([80,0])"><i class="fas fa-chevron-right"></i></button>
      </div>
      <button class="lf-nav-btn" onclick="if(_lfMap)_lfMap.panBy([0,80])"><i class="fas fa-chevron-down"></i></button>
      <div class="lf-nav-sep"></div>
      <button class="lf-nav-btn" style="color:#f59e0b"
        onclick="if(_lfMap)_lfMap.flyTo(_PETA_CENTER,_PETA_ZOOM,{animate:true,duration:1.2})">
        <i class="fas fa-crosshairs"></i>
      </button>
    </div>
    <button class="lf-nav-toggle" id="lf-nav-toggle" title="Navigasi" onclick="_toggleNavPanel()">
      <i class="fas fa-compass"></i>
    </button>`;
  mc.appendChild(wrap);
  L.DomEvent.disableClickPropagation(wrap);
  L.DomEvent.disableScrollPropagation(wrap);
}

function _toggleNavPanel() {
  _navPanelOpen=!_navPanelOpen;
  G('lf-nav-panel')?.classList.toggle('open',_navPanelOpen);
  G('lf-nav-toggle')?.classList.toggle('open',_navPanelOpen);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   10. DRAW OVERLAY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function toggleDrawPanel() {
  _drawPanelOpen=!_drawPanelOpen;
  const p=G('lf-draw-panel'), b=G('btn-draw-toggle');
  if (_drawPanelOpen) { p?.classList.remove('hidden'); p?.classList.add('visible'); b?.classList.add('active'); }
  else closeDrawPanel();
}

function closeDrawPanel() {
  _drawPanelOpen=false;
  G('lf-draw-panel')?.classList.remove('visible');
  G('lf-draw-panel')?.classList.add('hidden');
  G('btn-draw-toggle')?.classList.remove('active');
}

function startDraw(type) {
  if (!_lfMap||!window.L?.Draw) { toast('Peta belum siap.','er'); return; }
  if (_activeDrawMode===type) { _cancelDraw(); return; }
  _cancelDraw(); _activeDrawMode=type;
  if (type==='polyline')
    _activeDrawHandler=new L.Draw.Polyline(_lfMap,{shapeOptions:{color:'#1e6fd9',weight:3,opacity:.9,dashArray:'6 4'}});
  else
    _activeDrawHandler=new L.Draw.Polygon(_lfMap,{allowIntersection:false,shapeOptions:{color:'#7c3aed',weight:2.5,opacity:1,fillColor:'#7c3aed',fillOpacity:.12}});
  _activeDrawHandler.enable();
  _setDrawBtns(type); closeDrawPanel();
  toast(type==='polyline'?'Mode GARIS — klik titik, dobel klik selesai':'Mode AREA — klik titik, dobel klik selesai','inf');
}

function _cancelDraw() {
  if (_activeDrawHandler) { _activeDrawHandler.disable(); _activeDrawHandler=null; }
  _activeDrawMode=null; _setDrawBtns(null);
}

function _setDrawBtns(m) {
  G('btn-draw-line')?.classList.toggle('active',m==='polyline');
  G('btn-draw-area')?.classList.toggle('active',m==='polygon');
}

function clearDrawings() {
  if (!_drawnItems) return;
  const c=Object.keys(_drawnItems._layers||{}).length;
  if (!c) { toast('Tidak ada gambar.','inf'); return; }
  _drawnItems.clearLayers(); _drawnMeta={}; _cancelDraw(); closeDrawPanel();
  toast(c+' gambar dihapus.','ok');
}

/* Swatches warna meta form */
function _buildMetaSwatches() {
  const g=G('lf-meta-swatches'); if (!g) return;
  g.innerHTML = _DRAW_WARNA.map(c =>
    `<div class="lf-meta-swatch${c.hex===_metaWarna?' on':''}" style="background:${c.hex}"
      data-hex="${c.hex}" onclick="metaWarnaPilih('${c.hex}')"></div>`
  ).join('');
}

function metaWarnaPilih(h) {
  _metaWarna=h;
  document.querySelectorAll('.lf-meta-swatch').forEach(s=>s.classList.toggle('on',s.dataset.hex===h));
  const ci=G('lf-meta-color'); if (ci) ci.value=h;
  const cl=G('lf-meta-color-lbl'); if (cl) cl.textContent=h;
  _applyPendingColor(h);
}

function metaWarnaCustom(h) {
  _metaWarna=h;
  document.querySelectorAll('.lf-meta-swatch').forEach(s=>s.classList.remove('on'));
  const cl=G('lf-meta-color-lbl'); if (cl) cl.textContent=h;
  _applyPendingColor(h);
}

function _applyPendingColor(h) {
  if (!_pendingLayer) return;
  try { if (_pendingLayer.setStyle) _pendingLayer.setStyle(_pendingLayerType==='polyline'?{color:h}:{color:h,fillColor:h}); } catch(e){}
}

function _showMetaForm(layer,type) {
  _pendingLayer=layer; _pendingLayerType=type;
  const dw=type==='polyline'?'#1e6fd9':'#7c3aed';
  _metaWarna=dw; _buildMetaSwatches();
  const ci=G('lf-meta-color'); if (ci) ci.value=dw;
  const cl=G('lf-meta-color-lbl'); if (cl) cl.textContent=dw;
  const n=G('lf-meta-nama'),k=G('lf-meta-ket'); if(n) n.value=''; if(k) k.value='';
  const msr=_getMsr(layer,type);
  const me=G('lf-meta-msr'),mt=G('lf-meta-msr-txt');
  if (me) me.style.display=msr?'':'none'; if (mt) mt.textContent=msr;
  const t=G('lf-meta-title');
  if (t) t.innerHTML=`<i class="fas ${type==='polyline'?'fa-pen-nib':'fa-vector-square'}"></i> ${type==='polyline'?'Detail Garis / Rute':'Detail Area / Zona'}`;
  G('lf-meta-ov')?.classList.add('show');
  setTimeout(()=>{ n?.focus(); },260);
}

function confirmDrawMeta() {
  if (!_pendingLayer) return;
  const nama=((G('lf-meta-nama')||{}).value||'').trim();
  if (!nama) { G('lf-meta-nama')?.focus(); toast('Nama wajib diisi.','er'); return; }
  const ket=((G('lf-meta-ket')||{}).value||'').trim();
  _applyPendingColor(_metaWarna);
  _drawnItems.addLayer(_pendingLayer);
  const lid=L.Util.stamp(_pendingLayer), msr=_getMsr(_pendingLayer,_pendingLayerType);
  _drawnMeta[lid]={nama,ket,warna:_metaWarna,tipe:_pendingLayerType,measurement:msr};
  _bindDrawnPopup(_pendingLayer,nama,ket,_metaWarna,_pendingLayerType,msr);
  _bindMsrTooltip(_pendingLayer,_pendingLayerType);
  G('lf-meta-ov')?.classList.remove('show'); _setDrawBtns(null);
  toast(`Gambar "${nama}" ditambahkan.`,'ok');
  _pendingLayer=null; _pendingLayerType=null;
}

function cancelDrawMeta() {
  if (_pendingLayer&&_lfMap) { try{_lfMap.removeLayer(_pendingLayer);}catch(e){} }
  _pendingLayer=null; _pendingLayerType=null;
  G('lf-meta-ov')?.classList.remove('show'); _setDrawBtns(null);
  toast('Gambar dibatalkan.','inf');
}

function _bindDrawnPopup(layer,nama,ket,warna,tipe,msr) {
  const ico=tipe==='polyline'?'fa-pen-nib':'fa-vector-square';
  const label=tipe==='polyline'?'Garis / Rute':'Area / Zona';
  const html=`<div class="lf-popup-title"><i class="fas ${ico}" style="color:${warna}"></i> ${esc(nama)}</div>
    <div class="lf-popup-badge" style="background:${warna}18;color:${warna};border:1px solid ${warna}30">${label}</div>
    ${msr?`<div class="lf-popup-row"><span style="font-family:var(--mono);font-size:.7rem;font-weight:800;color:${warna}">${msr}</span></div>`:''}
    ${ket?`<div class="lf-popup-row"><i class="fas fa-info-circle"></i><span>${esc(ket)}</span></div>`:''}`;
  if (layer.bindPopup) layer.bindPopup(html,{maxWidth:260});
}

function _bindMsrTooltip(layer,tipe) {
  const msr=_getMsr(layer,tipe); if (!msr) return;
  layer.bindTooltip(`<b>${msr}</b>`,{permanent:false,sticky:true,direction:'top',offset:[0,-8],className:'lf-tip-clean',opacity:1});
}

/* Simpan & muat drawings via GAS */
async function saveDrawings() {
  if (!_drawnItems) return;
  const drawings=[];
  _drawnItems.eachLayer(layer => {
    try {
      const gj=layer.toGeoJSON(),lid=L.Util.stamp(layer),meta=_drawnMeta[lid]||{};
      drawings.push({ tipe:gj.geometry.type, warna:meta.warna||'#1e6fd9', nama:meta.nama||'', ket:meta.ket||'', measurement:meta.measurement||'', geojson:JSON.stringify(gj) });
    } catch(e){}
  });
  if (!drawings.length) { toast('Tidak ada gambar.','inf'); return; }
  const btn=G('btn-draw-save'); if (btn) btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
  try {
    const res=await gasCall('saveGambarPeta',{drawings});
    if (btn) btn.innerHTML='<i class="fas fa-floppy-disk" style="color:#0d9268"></i> Simpan';
    if (res.success) { _showSaveNote('✓ '+drawings.length+' disimpan!'); toast(drawings.length+' gambar disimpan.','ok'); closeDrawPanel(); }
    else toast('Gagal: '+res.message,'er');
  } catch(e) { if(btn) btn.innerHTML='<i class="fas fa-floppy-disk" style="color:#0d9268"></i> Simpan'; toast('Error: '+e.message,'er'); }
}

async function loadDrawings(isAuto) {
  /* Guard: tunggu peta & layer group siap */
  if (!_lfMap || !_drawnItems) {
    setTimeout(() => loadDrawings(isAuto), 600);
    return;
  }
  const btn = G('btn-draw-load');
  if (!isAuto && btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    const res = await gasCall('getGambarPeta');
    /* GAS kembalikan res.drawings (bukan res.data) */
    const drawings = res.drawings || res.data || [];
    if (!isAuto && btn) btn.innerHTML = '<i class="fas fa-download" style="color:#d97706"></i> Muat';
    if (!res.success || !drawings.length) {
      if (!isAuto) toast('Belum ada gambar tersimpan.', 'inf');
      return;
    }
    _drawnItems.clearLayers(); _drawnMeta={};
    drawings.forEach(d => {
      try {
        const gj=JSON.parse(d.geojson),w=d.warna||'#1e6fd9',isLine=gj.geometry?.type==='LineString';
        const opts=isLine?{color:w,weight:3,opacity:.9,dashArray:'6 4'}:{color:w,weight:2,fillColor:w,fillOpacity:.18,opacity:.9};
        const lyr=L.geoJSON(gj,{style:opts});
        lyr.eachLayer(sub => {
          _drawnItems.addLayer(sub);
          const lid=L.Util.stamp(sub),tipe=isLine?'polyline':'polygon';
          const msr=d.measurement||_getMsr(sub,tipe);
          _drawnMeta[lid]={nama:d.nama||'',ket:d.ket||'',warna:w,tipe,measurement:msr};
          if (d.nama) { _bindDrawnPopup(sub,d.nama,d.ket,w,tipe,msr); _bindMsrTooltip(sub,tipe); }
        });
      } catch(e){}
    });
    if (!isAuto) toast(drawings.length+' gambar dimuat.','ok');
    else _showSaveNote('✓ '+drawings.length+' gambar');
  } catch(e) {
    if (!isAuto && btn) btn.innerHTML = '<i class="fas fa-download" style="color:#d97706"></i> Muat';
  }
}

function _showSaveNote(msg) {
  const el=G('lf-save-note'); if (!el) return;
  el.textContent=msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2800);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   11. PICK KOORDINAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function petaPickCoord() {
  /* Dipanggil dari modal layer — menutup modal sementara */
  const modal=G('mlayer'); if (modal) modal.classList.remove('on');
  toast('Klik lokasi di peta — modal terbuka kembali otomatis.','inf');
  _pickCoordMode=true;
  G('lf-map-div')?.classList.add('lf-pick-cursor');
  const lw=G('lf-wrap');
  if (lw&&!G('lf-pick-banner')) {
    const b=document.createElement('div'); b.id='lf-pick-banner'; b.className='lf-pick-banner';
    b.innerHTML='<i class="fas fa-crosshairs"></i> Klik lokasi di peta<button class="lf-pick-cancel" onclick="_cancelPickCoordModal()">Batal</button>';
    lw.appendChild(b);
  }
  if (_lfMap) {
    _lfMap.once('click', e => {
      if (!_pickCoordMode) return;
      _cancelPickCoordModal();
      const li=G('lf-lat'),lo=G('lf-lng');
      if (li) { li.value=e.latlng.lat.toFixed(6); li.dispatchEvent(new Event('input')); }
      if (lo) { lo.value=e.latlng.lng.toFixed(6); lo.dispatchEvent(new Event('input')); }
      if (_pickTempMarker&&_lfMap) { try{_lfMap.removeLayer(_pickTempMarker);}catch(er){} }
      _pickTempMarker=L.marker([e.latlng.lat,e.latlng.lng],{
        icon:L.divIcon({html:'<div style="width:18px;height:18px;border-radius:50%;background:#0d9268;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.4)"></div>',className:'',iconSize:[18,18],iconAnchor:[9,9]})
      }).addTo(_lfMap);
      toast(`Koordinat: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`,'ok');
      setTimeout(()=>{ if (_pickTempMarker&&_lfMap){try{_lfMap.removeLayer(_pickTempMarker);}catch(er){}} _pickTempMarker=null; },7000);
      setTimeout(()=>{ if (G('mlayer')) G('mlayer').classList.add('on'); },400);
    });
  }
}

function _cancelPickCoord() {
  _pickCoordMode=false;
  G('lf-map-div')?.classList.remove('lf-pick-cursor');
  const b=G('lf-pick-banner'); if (b?.parentNode) b.parentNode.removeChild(b);
}

function _cancelPickCoordModal() {
  _cancelPickCoord();
  if (G('mlayer')) G('mlayer').classList.add('on');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   12. MODAL EDIT LAYER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function openLayerModal() {
  om('mlayer'); _loadLayerList();
}

async function _loadLayerList() {
  const body=G('layer-list-body');
  if (body) body.innerHTML='<div class="empty"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';
  try {
    const res=await gasCall('getPetaData');
    _layerData=res.data||[];
    _renderLayerList();
  } catch(e) {
    if (body) body.innerHTML=`<div class="empty"><i class="fas fa-circle-xmark" style="color:var(--red)"></i><p>${esc(e.message)}</p></div>`;
  }
}

function _renderLayerList() {
  const body=G('layer-list-body'); if (!body) return;
  if (!_layerData.length) { body.innerHTML='<div class="empty"><i class="fas fa-layer-group"></i><p>Belum ada lokasi.</p></div>'; return; }
  body.innerHTML=_layerData.map(layer => {
    const sd=_getSimbolDef(layer.simbol||layer.kategori), ck=rcSet(layer);
    return `<div class="layer-list-item${layer.aktif?'':' inactive'}">
      <div class="layer-item-ico" style="background:${layer.warna||sd.warna}22;color:${layer.warna||sd.warna}">
        <i class="fas ${sd.ico}"></i>
      </div>
      <div class="layer-item-info">
        <div class="layer-item-name">${esc(layer.nama)}</div>
        <div class="layer-item-sub">${sd.label} · ${layer.aktif?'<span style="color:var(--green)">Aktif</span>':'<span style="color:var(--muted)">Nonaktif</span>'}</div>
      </div>
      <div class="layer-item-acts">
        <button class="ag-btn" style="background:${layer.aktif?'var(--greenl)':'var(--bg)'};color:${layer.aktif?'var(--green)':'var(--muted)'}"
          onclick="toggleLayerAktif(rcGet('${ck}'))">
          <i class="fas ${layer.aktif?'fa-eye':'fa-eye-slash'}"></i>
        </button>
        <button class="ag-btn ag-edit" onclick="openLayerForm(rcGet('${ck}'))">
          <i class="fas fa-pen"></i>
        </button>
        <button class="ag-btn ag-del" onclick="konfirmHapus('peta',rcGet('${ck}')._ri)">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}

async function toggleLayerAktif(layer) {
  if (!layer) return;
  try {
    const res=await gasCall('toggleLayerAktif',{ri:layer._ri,aktif:!layer.aktif});
    if (res.success) { toast(layer.aktif?'Lokasi dinonaktifkan.':'Lokasi diaktifkan.','ok'); _loadLayerList(); refreshLeaflet(); }
    else toast('Gagal: '+res.message,'er');
  } catch(e) { toast('Error: '+e.message,'er'); }
}

function openLayerForm(layer) {
  _layerFormRow=layer;
  _selectedSimbol=(layer?.simbol||layer?.kategori)||'lainnya';
  _selectedWarna=layer?.warna||'#1e6fd9';
  const fw=G('layer-form-wrap'); if (!fw) return;

  fw.innerHTML=`
    <p style="font-size:.67rem;font-weight:800;color:var(--mid);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
      ${layer?'Edit Lokasi':'Tambah Lokasi Baru'}
    </p>
    <div class="fgrp"><label class="flbl">Nama Lokasi <span class="req">*</span></label>
      <input class="fctl" id="lf-nama" value="${esc(layer?.nama||'')}"></div>
    <div class="fgrp"><label class="flbl">Kategori / Simbol</label>
      <div class="mlayer-simbol-grid">
        ${_SIMBOL_DEF.map(s=>`<button class="msimbol-btn${s.id===_selectedSimbol?' on':''}" onclick="selectSimbol('${s.id}')" id="sbtn-${s.id}">
          <i class="fas ${s.ico} simbol-ico"></i>${s.label.split('/')[0].trim()}
        </button>`).join('')}
      </div>
    </div>
    <div class="fgrp"><label class="flbl">Warna Penanda</label>
      <div class="color-swatches">
        ${_WARNA_PRESET.map(w=>`<div class="color-swatch${w===_selectedWarna?' on':''}" style="background:${w}" onclick="selectWarna('${w}')" data-warna="${w}"></div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:7px">
        <input type="color" id="lf-warna-inp" value="${_selectedWarna}" oninput="selectWarnaCustom(this.value)"
               style="width:34px;height:28px;border:none;border-radius:5px;cursor:pointer;background:none;padding:0">
        <span id="lf-warna-lbl" style="font-size:.68rem;font-family:var(--mono);color:var(--mid)">${_selectedWarna}</span>
      </div>
    </div>
    <div class="fgrp"><label class="flbl">Koordinat</label>
      <button type="button" style="width:100%;margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px;border:1.5px dashed var(--teal);border-radius:8px;background:transparent;color:var(--teal);font-size:.7rem;font-weight:700;cursor:pointer;font-family:var(--font)" onclick="petaPickCoord()">
        <i class="fas fa-crosshairs"></i> Klik Lokasi di Peta
      </button>
    </div>
    <div class="frow2">
      <div class="fgrp"><label class="flbl">Latitude <span class="req">*</span></label>
        <input class="fctl" id="lf-lat" placeholder="-7.8637" value="${esc(layer?.lat||'')}"></div>
      <div class="fgrp"><label class="flbl">Longitude <span class="req">*</span></label>
        <input class="fctl" id="lf-lng" placeholder="111.4630" value="${esc(layer?.lng||'')}"></div>
    </div>
    <div class="fgrp"><label class="flbl">Alamat</label>
      <input class="fctl" id="lf-alamat" value="${esc(layer?.alamat||'')}" placeholder="Jl. ..."></div>
    <div class="fgrp"><label class="flbl">Keterangan</label>
      <textarea class="fctl" id="lf-ket" rows="2">${esc(layer?.ket||layer?.deskripsi||'')}</textarea></div>
    ${layer?`<div class="fgrp" style="display:flex;align-items:center;gap:7px">
      <input type="checkbox" id="lf-aktif" style="width:15px;height:15px;accent-color:var(--green)" ${layer.aktif?'checked':''}>
      <label for="lf-aktif" style="font-size:.76rem;font-weight:600;color:var(--text);cursor:pointer">Lokasi Aktif</label>
    </div>`:''}
    <div style="display:flex;gap:6px;margin-top:4px">
      <button class="bp" style="flex:1" onclick="submitLayerForm()">
        <i class="fas fa-save"></i> ${layer?'Perbarui':'Simpan'}
      </button>
      <button class="bg2" onclick="cancelLayerForm()"><i class="fas fa-times"></i></button>
    </div>`;
}

function selectSimbol(id) {
  _selectedSimbol=id;
  document.querySelectorAll('.msimbol-btn').forEach(b=>b.classList.remove('on'));
  G('sbtn-'+id)?.classList.add('on');
  selectWarna(_getSimbolDef(id).warna);
}

function selectWarna(w) {
  _selectedWarna=w;
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.toggle('on',s.dataset.warna===w));
  const i=G('lf-warna-inp'); if(i) i.value=w;
  const l=G('lf-warna-lbl'); if(l) l.textContent=w;
}

function selectWarnaCustom(w) {
  _selectedWarna=w;
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('on'));
  const l=G('lf-warna-lbl'); if(l) l.textContent=w;
}

function cancelLayerForm() {
  _layerFormRow=null;
  const fw=G('layer-form-wrap');
  if (fw) fw.innerHTML=`<div class="empty" style="padding:40px 10px">
    <i class="fas fa-hand-pointer" style="font-size:1.5rem;opacity:.14;display:block;margin-bottom:8px"></i>
    <p style="font-size:.72rem">Pilih lokasi di kiri untuk diedit,<br>atau klik Tambah untuk lokasi baru.</p>
  </div>`;
}

async function submitLayerForm() {
  const fv=id=>(G(id)||{}).value||'';
  const nama=fv('lf-nama'),lat=fv('lf-lat'),lng=fv('lf-lng');
  if (!nama.trim()) { toast('Nama wajib diisi.','er'); return; }
  if (!lat||!lng)   { toast('Koordinat wajib diisi.','er'); return; }
  if (isNaN(+lat)||isNaN(+lng)) { toast('Koordinat tidak valid.','er'); return; }
  const aktifEl=G('lf-aktif');
  const payload={
    nama:nama.trim(), simbol:_selectedSimbol, kategori:_selectedSimbol,
    warna:_selectedWarna, lat:+lat, lng:+lng,
    alamat:fv('lf-alamat'), ket:fv('lf-ket'), deskripsi:fv('lf-ket'),
    aktif:aktifEl?aktifEl.checked:true,
  };
  if (_layerFormRow) payload._ri=_layerFormRow._ri;
  _lfShowLoad('Menyimpan...');
  try {
    const action=_layerFormRow?'updateLayerPeta':'addLayerPeta';
    const res=await gasCall(action,payload);
    _lfHideLoad();
    if (res.success) {
      toast(_layerFormRow?'Lokasi diperbarui.':'Lokasi ditambahkan.','ok');
      _loadLayerList(); cancelLayerForm(); refreshLeaflet();
    } else toast('Gagal: '+res.message,'er');
  } catch(e) { _lfHideLoad(); toast('Error: '+e.message,'er'); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   13. PDF EXPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function openPdfModal() {
  G('pdf-ov')?.classList.add('show');
  _pdfModalOpen=true;
  _precacheSimbolIcons();
  _buildPdfLegendRows();
  _buildPdfOptsPanel();
  setTimeout(()=>_initPdfMap(),160);
}

function closePdfModal() {
  G('pdf-ov')?.classList.remove('show');
  _pdfModalOpen=false;
  if (_pdfMap) { try{_pdfMap.off();_pdfMap.remove();}catch(e){} _pdfMap=null; }
  _pdfMapLayers={};
}

function _buildPdfLegendRows() {
  _pdfLegendRows=[];
  if (_pdfOpts.showLayers&&_layerData) {
    _layerData.filter(l=>l.aktif&&l.lat&&l.lng).forEach(l=>{
      const sd=_getSimbolDef(l.simbol||l.kategori), col=l.warna||sd.warna;
      _pdfLegendRows.push({warna:col,tipe:'marker',label:l.nama||'Lokasi',simbol:sd.ico});
    });
  }
  if (_pdfOpts.showDraw&&_drawnItems) {
    _drawnItems.eachLayer(layer=>{
      const lid=L.Util.stamp(layer),meta=_drawnMeta[lid]||{},tipe=meta.tipe||'polyline';
      _pdfLegendRows.push({warna:meta.warna||'#1e6fd9',tipe:tipe==='polyline'?'line':'poly',label:meta.nama||(tipe==='polyline'?'Jalur':'Area'),simbol:tipe==='polyline'?'fa-route':'fa-draw-polygon'});
    });
  }
  /* Deduplikasi */
  const seen={};
  _pdfLegendRows=_pdfLegendRows.filter(r=>{ const k=r.label+r.warna+r.tipe; if(seen[k]) return false; seen[k]=true; return true; });
}

function _initPdfMap() {
  const el=G('pdf-map-preview'); if (!el||!window.L) return;
  if (_pdfMap) { try{_pdfMap.off();_pdfMap.remove();}catch(e){} _pdfMap=null; }
  const center=_lfMap?_lfMap.getCenter():_PETA_CENTER;
  const zoom=_lfMap?_lfMap.getZoom():_PETA_ZOOM;
  _pdfMap=L.map('pdf-map-preview',{center,zoom,zoomControl:false,attributionControl:false,preferCanvas:true});
  const tc=_TILE_LAYERS[_pdfOpts.mapMode]||_TILE_LAYERS.osm;
  _pdfMapLayers.base=L.tileLayer(tc.url,{attribution:tc.attr,maxZoom:tc.maxZoom||19,crossOrigin:'anonymous',keepBuffer:4}).addTo(_pdfMap);
  _cloneLayersToPdfMap(_pdfMap);
  setTimeout(()=>{ if(_pdfMap) _pdfMap.invalidateSize({animate:false}); },260);
}

function fitPdfMapBounds() {
  if (!_pdfMap) return;
  const b=[];
  if (_pdfOpts.showLayers&&_layerData) _layerData.filter(l=>l.aktif&&l.lat&&l.lng).forEach(l=>b.push([l.lat,l.lng]));
  if (_pdfOpts.showDraw&&_drawnItems) _drawnItems.eachLayer(layer=>{ try{const bd=layer.getBounds();if(bd){b.push([bd.getNorth(),bd.getEast()]);b.push([bd.getSouth(),bd.getWest()]);}}catch(e){} });
  if (b.length>0) _pdfMap.fitBounds(b,{padding:[30,30],animate:false});
  else _pdfMap.setView(_PETA_CENTER,_PETA_ZOOM,{animate:false});
}

function _cloneLayersToPdfMap(target) {
  if (_pdfOpts.showLayers&&_layerData) {
    _layerData.filter(l=>l.aktif&&l.lat&&l.lng).forEach(l=>{
      const sd=_getSimbolDef(l.simbol||l.kategori), warna=l.warna||sd.warna;
      L.marker([l.lat,l.lng],{icon:_makeLeafletIcon(warna,sd.ico)}).addTo(target).bindPopup(`<b>${esc(l.nama)}</b>`);
    });
  }
  if (_pdfOpts.showDraw&&_drawnItems) {
    _drawnItems.eachLayer(layer=>{
      try {
        const gj=layer.toGeoJSON(),lid=L.Util.stamp(layer),meta=_drawnMeta[lid]||{},w=meta.warna||'#1e6fd9';
        const isLine=(meta.tipe||'polyline')==='polyline';
        const opts=isLine?{color:w,weight:3.5,opacity:.95,dashArray:'8 5',lineCap:'round'}:{color:w,weight:2,fillColor:w,fillOpacity:.22};
        L.geoJSON(gj,{style:opts}).addTo(target);
      } catch(e){}
    });
  }
}

function _buildPdfOptsPanel() {
  const p=G('pdf-opts-panel'); if (!p) return;
  const mapModes=[
    {id:'osm',ico:'fa-map',lbl:'OSM'},{id:'satelit',ico:'fa-satellite',lbl:'Satelit'},
    {id:'googleSatelit',ico:'fa-earth-asia',lbl:'Google Satelit'},{id:'hybrid',ico:'fa-globe',lbl:'Hybrid'},
    {id:'carto',ico:'fa-map-location',lbl:'CartoDB'},{id:'topo',ico:'fa-mountain',lbl:'Topo'},
  ];
  const paperBtns=Object.keys(_PAPER_SIZES).map(k=>
    `<button class="pdf-btn-opt${_pdfOpts.paperSize===k?' on':''}" data-sz="${k}" onclick="setPdfPaper('${k}')">${_PAPER_SIZES[k].label}</button>`
  ).join('');

  p.innerHTML=`
    <div class="pdf-sect">
      <div class="pdf-sect-lbl"><i class="fas fa-sliders"></i> Elemen Tampil</div>
      ${_pdfChk('pc-lay','Marker Lokasi','<small>Pin lokasi aktif</small>',_pdfOpts.showLayers)}
      ${_pdfChk('pc-draw','Gambar Overlay','<small>Garis &amp; area</small>',_pdfOpts.showDraw)}
    </div>
    <div class="pdf-sect">
      <div class="pdf-sect-lbl"><i class="fas fa-map"></i> Peta Dasar</div>
      <div class="pdf-map-grid">${mapModes.map(m=>`<button class="pdf-map-btn${_pdfOpts.mapMode===m.id?' on':''}" data-id="${m.id}" onclick="setPdfMap('${m.id}')"><i class="fas ${m.ico}"></i>${m.lbl}</button>`).join('')}</div>
    </div>
    <div class="pdf-sect">
      <div class="pdf-sect-lbl"><i class="fas fa-file"></i> Ukuran Kertas</div>
      <div class="pdf-btn-row">${paperBtns}</div>
    </div>
    <div class="pdf-sect">
      <div class="pdf-sect-lbl"><i class="fas fa-rotate"></i> Orientasi</div>
      <div class="pdf-btn-row">
        <button class="pdf-btn-opt${_pdfOpts.orientation==='landscape'?' on':''}" onclick="setPdfOri('landscape')"><i class="fas fa-image"></i> Landscape</button>
        <button class="pdf-btn-opt${_pdfOpts.orientation==='portrait'?' on':''}" onclick="setPdfOri('portrait')"><i class="fas fa-file"></i> Portrait</button>
      </div>
    </div>
    <div class="pdf-sect">
      <div class="pdf-sect-lbl"><i class="fas fa-star-half-stroke"></i> Kualitas</div>
      <div class="pdf-btn-row">
        ${[{v:2,l:'Normal'},{v:3,l:'HD'},{v:4.5,l:'Full HD'},{v:6,l:'Ultra'}].map(d=>
          `<button class="pdf-btn-opt${_pdfOpts.dpi===d.v?' on':''}" data-dpi="${d.v}" onclick="setPdfDpi(${d.v})">${d.l}</button>`
        ).join('')}
      </div>
    </div>
    <div class="pdf-sect" style="padding-bottom:14px">
      <div class="pdf-sect-lbl"><i class="fas fa-list"></i> Legenda</div>
      <div id="pdf-leg-area">${_buildLegEditorHtml()}</div>
    </div>`;
}

function _pdfChk(id,lbl,sub,checked) {
  return `<div class="pdf-chk${checked?' on':''}" onclick="togglePdfChk('${id}')">
    <input type="checkbox" id="${id}"${checked?' checked':''} onclick="event.stopPropagation()">
    <label for="${id}">${lbl}${sub}</label>
  </div>`;
}

function togglePdfChk(id) {
  const inp=G(id); if (!inp) return;
  inp.checked=!inp.checked;
  inp.closest?.('.pdf-chk')?.classList.toggle('on',inp.checked);
  const m={'pc-lay':'showLayers','pc-draw':'showDraw'};
  if (m[id]) { _pdfOpts[m[id]]=inp.checked; _buildPdfLegendRows(); _rebuildLegEditor(); _initPdfMap(); }
}

function setPdfMap(mode) {
  _pdfOpts.mapMode=mode;
  document.querySelectorAll('.pdf-map-btn').forEach(b=>b.classList.toggle('on',b.dataset.id===mode));
  if (_pdfMap&&_pdfMapLayers.base) {
    _pdfMap.removeLayer(_pdfMapLayers.base);
    const tc=_TILE_LAYERS[mode]||_TILE_LAYERS.osm;
    _pdfMapLayers.base=L.tileLayer(tc.url,{attribution:tc.attr,maxZoom:tc.maxZoom||19,crossOrigin:'anonymous'}).addTo(_pdfMap);
  }
}

function setPdfOri(ori) {
  _pdfOpts.orientation=ori;
  document.querySelectorAll('[onclick*="setPdfOri"]').forEach(b=>b.classList.toggle('on',b.textContent.toLowerCase().includes(ori)));
}

function setPdfPaper(size) {
  _pdfOpts.paperSize=size;
  document.querySelectorAll('.pdf-btn-opt[data-sz]').forEach(b=>b.classList.toggle('on',b.dataset.sz===size));
}

function setPdfDpi(val) {
  _pdfOpts.dpi=val;
  document.querySelectorAll('.pdf-btn-opt[data-dpi]').forEach(b=>b.classList.toggle('on',parseFloat(b.dataset.dpi)===val));
}

/* Legenda editor */
function _buildSwatchHtml(row) {
  const w=row.warna||'#607d8b', t=row.tipe||'marker';
  if (t==='line') return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="${w}" stroke-width="2.5" stroke-dasharray="5 3" stroke-linecap="round"/></svg>`;
  if (t==='poly') return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="18"><rect x="1" y="1" width="24" height="16" rx="2" fill="${w}" fill-opacity=".22" stroke="${w}" stroke-width="1.8"/></svg>`;
  const png=_getSimbolPng(row.simbol||'fa-map-pin',w);
  if (png) return `<img src="${png}" width="20" height="26" style="display:block">`;
  return `<i class="fas ${row.simbol||'fa-map-pin'}" style="color:${w};font-size:16px"></i>`;
}

function _buildLegEditorHtml() {
  if (!_pdfLegendRows.length) return `<div style="font-size:.6rem;color:var(--muted);padding:6px 2px"><i class="fas fa-info-circle"></i> Aktifkan layer untuk mengisi legenda</div>`;
  return _pdfLegendRows.map((row,i)=>`<div class="pdf-leg-row">
    <div class="pdf-leg-swatch">${_buildSwatchHtml(row)}</div>
    <input class="pdf-leg-inp" data-idx="${i}" value="${esc(row.label)}" oninput="updateLegRow(${i},this.value)" placeholder="Keterangan...">
    <button class="pdf-leg-del" onclick="delLegRow(${i})"><i class="fas fa-times"></i></button>
  </div>`).join('')+`<button class="pdf-leg-add" onclick="addLegRow()"><i class="fas fa-plus"></i> Tambah baris</button>`;
}

function updateLegRow(idx,val) { if (_pdfLegendRows[idx]) _pdfLegendRows[idx].label=val; }
function delLegRow(idx) { _pdfLegendRows.splice(idx,1); _rebuildLegEditor(); }
function addLegRow() { _pdfLegendRows.push({warna:'#607d8b',tipe:'dot',label:'Keterangan baru'}); _rebuildLegEditor(); }
function _rebuildLegEditor() { const a=G('pdf-leg-area'); if(a) a.innerHTML=_buildLegEditorHtml(); }

/* Progress overlay */
function _showRenderProg(txt,sub,pct) {
  G('pdf-render-ov')?.classList.add('show');
  const t=G('pdf-render-txt'),s=G('pdf-render-sub'),bar=G('pdf-render-bar');
  if(t) t.textContent=txt||'Merender...';
  if(s) s.textContent=sub||'';
  if(bar) bar.style.width=(pct||0)+'%';
}
function _hideRenderProg() {
  G('pdf-render-ov')?.classList.remove('show');
  const bar=G('pdf-render-bar'); if(bar) bar.style.width='0%';
}

/* Export */
function execPrint() {
  if (_pdfRenderBusy) return;
  _setPdfBtn('btn-pdf-print',true,'<i class="fas fa-print"></i> Cetak');
  _runPdfExport(doc => {
    _setPdfBtn('btn-pdf-print',false,'<i class="fas fa-print"></i> Cetak');
    if (!doc) return;
    const url=URL.createObjectURL(doc.output('blob'));
    const w=window.open(url);
    if (w) setTimeout(()=>w.print(),1000);
    toast('Dokumen siap dicetak.','ok');
  });
}

function execDownload() {
  if (_pdfRenderBusy) return;
  _setPdfBtn('btn-pdf-dl',true,'<i class="fas fa-download"></i> Unduh PDF');
  _runPdfExport(doc => {
    _setPdfBtn('btn-pdf-dl',false,'<i class="fas fa-download"></i> Unduh PDF');
    if (!doc) return;
    const paper=(_PAPER_SIZES[_pdfOpts.paperSize]||_PAPER_SIZES.a4).label.replace(/\s/g,'_');
    const ori=_pdfOpts.orientation==='landscape'?'L':'P';
    doc.save(`Peta_Kepatihan_${paper}_${ori}_${new Date().toISOString().slice(0,10)}.pdf`);
    toast('PDF berhasil diunduh.','ok');
  });
}

function _setPdfBtn(id,loading,orig) {
  const btn=G(id); if(!btn) return;
  btn.innerHTML=loading?'<i class="fas fa-spinner fa-spin"></i> Memproses...':orig;
  btn.disabled=loading;
}

function _runPdfExport(done) {
  if (_pdfRenderBusy) { toast('Render sedang berjalan.','inf'); return; }
  _pdfRenderBusy=true;
  const finish=doc=>{ _pdfRenderBusy=false; _hideRenderProg(); done(doc); };
  _ensureJsPDF(()=>_ensureHtml2Canvas(()=>_generatePdf(finish)));
}

function _ensureJsPDF(cb) {
  if ((window.jspdf&&window.jspdf.jsPDF)||window.jsPDF){cb();return;}
  const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload=cb; s.onerror=()=>toast('jsPDF gagal.','er'); document.head.appendChild(s);
}

function _ensureHtml2Canvas(cb) {
  if (window.html2canvas){cb();return;}
  const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  s.onload=cb; s.onerror=()=>toast('html2canvas gagal.','er'); document.head.appendChild(s);
}

async function _generatePdf(done) {
  if (!_pdfMap) { toast('Inisialisasi peta terlebih dahulu.','er'); done(null); return; }

  const dpi=_pdfOpts.dpi||3, dims=_getPaperDims();
  const today=new Date();
  const tglStr=today.toLocaleDateString('id-ID',{year:'numeric',month:'long',day:'numeric'});
  const jamStr=today.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  const tConf=_TILE_LAYERS[_pdfOpts.mapMode]||_TILE_LAYERS.osm;

  _showRenderProg('Menyiapkan render...','Membuat canvas offscreen',5);

  const MM=3.7795, TW=Math.round((dims.w-10)*MM), TH=Math.round((dims.h-58)*MM);
  const offDiv=document.createElement('div'); offDiv.id='__peta_off__';
  offDiv.style.cssText=`position:fixed;left:-99999px;top:0;width:${TW}px;height:${TH}px;background:#e4eaf5;z-index:-99999;overflow:hidden;pointer-events:none`;
  document.body.appendChild(offDiv);

  const offMap=L.map(offDiv,{center:_pdfMap.getCenter(),zoom:_pdfMap.getZoom(),zoomControl:false,attributionControl:false,preferCanvas:true,renderer:L.canvas({padding:.5})});
  L.tileLayer(tConf.url,{attribution:tConf.attr,maxZoom:tConf.maxZoom||19,crossOrigin:'anonymous',keepBuffer:8}).addTo(offMap);
  _cloneLayersToPdfMap(offMap);
  offMap.invalidateSize({animate:false});

  _showRenderProg('Memuat tile peta...','Tunggu tile dari server',15);

  let elapsed=0, captured=false;
  const waitTile=setInterval(()=>{
    elapsed+=200;
    const pct=Math.min(55,15+Math.round(elapsed/5000*40));
    const pending=offDiv.querySelectorAll('img.leaflet-tile:not(.leaflet-tile-loaded)').length;
    const total=offDiv.querySelectorAll('img.leaflet-tile').length;
    _showRenderProg('Memuat tile...',total>0?`${total-pending}/${total} tile dimuat`:'Menunggu...',pct);
    if (!captured&&((pending===0&&elapsed>600)||(elapsed>=5000))) {
      captured=true; clearInterval(waitTile);
      _showRenderProg('Merender canvas...','Scale: '+dpi+'x',60);
      setTimeout(()=>_doCapture(offMap,offDiv,TW,TH,dpi,tglStr,jamStr,tConf,done),300);
    }
  },200);
}

function _doCapture(offMap,offDiv,TW,TH,dpi,tglStr,jamStr,tConf,done) {
  const mapEl=offMap.getContainer();
  /* Sembunyikan kontrol Leaflet */
  ['.leaflet-control-zoom','.leaflet-control-attribution','.leaflet-bar','.leaflet-top','.leaflet-bottom']
    .forEach(sel=>mapEl.querySelectorAll(sel).forEach(el=>{el.setAttribute('data-phide',el.style.display||'');el.style.display='none';}));

  html2canvas(mapEl,{
    useCORS:true,allowTaint:true,scale:dpi,backgroundColor:'#e4eaf5',
    logging:false,imageTimeout:10000,width:TW,height:TH,scrollX:0,scrollY:0,
  }).then(async canvas=>{
    _showRenderProg('Menyusun PDF...','Menambahkan legenda',88);
    mapEl.querySelectorAll('[data-phide]').forEach(el=>{ el.style.display=el.getAttribute('data-phide')||''; el.removeAttribute('data-phide'); });
    try{offMap.off();offMap.remove();}catch(e){}
    if (offDiv.parentNode) offDiv.parentNode.removeChild(offDiv);
    setTimeout(async()=>{ await _buildPdfDoc(canvas,tglStr,jamStr,tConf,done); },80);
  }).catch(e=>{
    mapEl.querySelectorAll('[data-phide]').forEach(el=>{ el.style.display=el.getAttribute('data-phide')||''; el.removeAttribute('data-phide'); });
    try{offMap.off();offMap.remove();}catch(er){}
    if (offDiv.parentNode) offDiv.parentNode.removeChild(offDiv);
    _hideRenderProg(); toast('Error render: '+(e.message||e),'er'); done(null);
  });
}

async function _buildPdfDoc(mapCanvas,tglStr,jamStr,tConf,done) {
  const dims=_getPaperDims(), pgW=dims.w, pgH=dims.h;
  const paper=_PAPER_SIZES[_pdfOpts.paperSize]||_PAPER_SIZES.a4;
  const isLS=_pdfOpts.orientation==='landscape';
  const JsPDF=(window.jspdf&&window.jspdf.jsPDF)||window.jsPDF;
  if (!JsPDF) { toast('jsPDF tidak tersedia.','er'); done(null); return; }

  const doc=new JsPDF({orientation:isLS?'landscape':'portrait',unit:'mm',format:[pgW,pgH]});
  const HDR_H=20, FTR_H=10, PAD=5, LEG_W=_pdfLegendRows.length>0?52:0, LEG_GAP=LEG_W>0?3:0;
  const cTop=HDR_H+PAD, cBot=pgH-FTR_H-PAD, cH=cBot-cTop;
  const mapAreaW=pgW-PAD*2-LEG_W-LEG_GAP;
  const imgW=mapCanvas.width, imgH=mapCanvas.height, ratio=imgH/imgW;
  let dispH=cH, dispW=cH/ratio;
  if (dispW>mapAreaW) { dispW=mapAreaW; dispH=mapAreaW*ratio; }
  const mapX=PAD, mapY=cTop+(cH-dispH)/2;

  /* Background */
  doc.setFillColor(230,237,248); doc.rect(0,0,pgW,pgH,'F');
  doc.setFillColor(246,249,254); doc.roundedRect(3,3,pgW-6,pgH-6,2,2,'F');

  _precacheSimbolIcons();

  /* Logo */
  if (!_logoCacheB64) {
    try { _logoCacheB64=await _imgToBase64('assets/icon-full.png'); } catch(e){}
  }

  /* Header */
  doc.setFillColor(8,18,38); doc.rect(0,0,pgW,HDR_H,'F');
  doc.setFillColor(12,26,56); doc.rect(0,0,pgW*0.6,HDR_H,'F');
  doc.setFillColor(10,104,128); doc.rect(0,HDR_H-1.2,pgW,1.2,'F');
  if (_logoCacheB64) doc.addImage(_logoCacheB64,'PNG',PAD,2,14,14);
  else {
    doc.setFillColor(10,104,128); doc.roundedRect(PAD,3.5,13,13,1.5,1.5,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(5);
    doc.text('SIMP',PAD+6.5,8,{align:'center'}); doc.text('ATIH',PAD+6.5,12,{align:'center'});
  }
  doc.setFont('helvetica','bold'); doc.setFontSize(isLS?10.5:9); doc.setTextColor(238,246,255);
  doc.text('PETA WILAYAH KELURAHAN KEPATIHAN',PAD+16,9);
  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(155,193,235);
  doc.text('SIMPATIH — '+tglStr+' pukul '+jamStr,PAD+16,14.5);
  doc.setFontSize(6); doc.setTextColor(115,155,210);
  doc.text('Kel. Kepatihan, Kec. Ponorogo, Jawa Timur',pgW-PAD,7.5,{align:'right'});
  doc.text(paper.label+' '+(isLS?'Landscape':'Portrait'),pgW-PAD,11.5,{align:'right'});
  doc.text('Dicetak: '+tglStr,pgW-PAD,15.5,{align:'right'});

  /* Peta */
  doc.setFillColor(195,210,228); doc.roundedRect(mapX+.8,mapY+.8,dispW+.4,dispH+.4,2,2,'F');
  doc.setDrawColor(160,188,218); doc.setLineWidth(.4);
  doc.roundedRect(mapX,mapY,dispW,dispH,1.5,1.5,'S');
  doc.addImage(mapCanvas.toDataURL('image/png',1),'png',mapX,mapY,dispW,dispH,'','FAST');

  /* Sidebar legenda */
  if (LEG_W>0) {
    const sbX=mapX+dispW+LEG_GAP, sbY=mapY, sbH=dispH;
    doc.setFillColor(240,245,252); doc.setDrawColor(182,204,226); doc.setLineWidth(.35);
    doc.roundedRect(sbX,sbY,LEG_W,sbH,2,2,'FD');
    doc.setFillColor(8,18,38); doc.roundedRect(sbX+2,sbY+2,LEG_W-4,7,1,1,'F');
    doc.setTextColor(208,228,255); doc.setFont('helvetica','bold'); doc.setFontSize(5.5);
    doc.text('KETERANGAN PETA',sbX+LEG_W/2,sbY+6.5,{align:'center'});
    doc.setDrawColor(145,172,208); doc.setLineWidth(.25); doc.line(sbX+3,sbY+10.5,sbX+LEG_W-3,sbY+10.5);

    const COMP_H=36, legStartY=sbY+12, legEndY=sbY+sbH-COMP_H-4, legH=legEndY-legStartY;
    const rowCount=_pdfLegendRows.length;
    const rowH=rowCount>0?Math.min(16,Math.max(7,legH/rowCount)):10;
    const icoH=Math.min(rowH*.9,rowH-1), icoW=Math.min(icoH*(32/42),LEG_W*.28);
    const fSize=Math.max(5,Math.min(7,rowH*.65));
    let curY=legStartY;
    _pdfLegendRows.forEach(row=>{
      if (curY+rowH>legEndY+1) return;
      const c=_hexToRgb(row.warna||'#607d8b'), icoY=curY+(rowH-icoH)/2;
      _drawLegSymbol(doc,row,sbX+2,icoY,c,icoW,icoH);
      doc.setTextColor(36,56,86); doc.setFont('helvetica','normal'); doc.setFontSize(fSize);
      const lines=doc.splitTextToSize((row.label||'').substring(0,34),LEG_W-icoW-7).slice(0,2);
      doc.text(lines,sbX+icoW+5,curY+rowH/2,{baseline:'middle',lineHeightFactor:1.2});
      if (rowH>8) { doc.setDrawColor(220,230,245); doc.setLineWidth(.15); doc.line(sbX+3,curY+rowH-.5,sbX+LEG_W-3,curY+rowH-.5); }
      curY+=rowH;
    });

    /* Kompas */
    const cCX=sbX+LEG_W/2, cCY=sbY+sbH-20, cR=10;
    doc.setFillColor(225,233,250); doc.setDrawColor(158,182,212); doc.setLineWidth(.3); doc.circle(cCX,cCY,cR,'FD');
    doc.setFillColor(215,225,245); doc.circle(cCX,cCY,cR-2,'F');
    doc.setFillColor(192,57,43); doc.triangle(cCX,cCY-cR+2,cCX-2.8,cCY,cCX+2.8,cCY,'F');
    doc.setFillColor(130,150,175); doc.triangle(cCX,cCY+cR-2,cCX-2.8,cCY,cCX+2.8,cCY,'F');
    doc.setFillColor(248,252,255); doc.circle(cCX,cCY,2.4,'F');
    doc.setFillColor(68,88,120); doc.circle(cCX,cCY,.9,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(6.2); doc.setTextColor(192,57,43);
    doc.text('U',cCX,cCY-cR-1.8,{align:'center'});
    doc.setTextColor(88,110,145); doc.setFontSize(5);
    doc.text('S',cCX,cCY+cR+3.8,{align:'center'});
    doc.text('B',cCX-cR-3.5,cCY+1.6,{align:'center'});
    doc.text('T',cCX+cR+3.5,cCY+1.6,{align:'center'});
    doc.setFont('helvetica','normal'); doc.setFontSize(4.5); doc.setTextColor(85,108,145);
    doc.text('Utara Magnetik',cCX,sbY+sbH-3.5,{align:'center'});
  }

  /* Footer */
  const ftY=pgH-FTR_H;
  doc.setFillColor(8,18,38); doc.rect(0,ftY,pgW,FTR_H,'F');
  doc.setFillColor(10,104,128); doc.rect(0,ftY,pgW,1,'F');
  doc.setTextColor(98,138,202); doc.setFont('helvetica','bold'); doc.setFontSize(6);
  doc.text('SIMPATIH — KELURAHAN KEPATIHAN PONOROGO',PAD,ftY+4.5);
  doc.setFont('helvetica','normal'); doc.setFontSize(5); doc.setTextColor(72,108,162);
  doc.text('Sistem Informasi Manajemen Pemerintahan Terpadu Terintegrasi',PAD,ftY+8);
  doc.setTextColor(88,128,192); doc.setFontSize(5.8);
  doc.text('Sumber: '+(tConf.label||tConf.attr||'OSM'),pgW/2,ftY+4.5,{align:'center'});
  doc.setFontSize(4.8); doc.setTextColor(62,92,152);
  doc.text(`Koordinat: ${_PETA_CENTER[0]}, ${_PETA_CENTER[1]}`,pgW/2,ftY+8,{align:'center'});
  doc.setTextColor(88,128,192); doc.setFontSize(5.8);
  doc.text('Dicetak: '+tglStr+' '+jamStr,pgW-PAD,ftY+4.5,{align:'right'});
  doc.setFontSize(4.5); doc.setTextColor(52,82,142);
  doc.text('Halaman 1 dari 1',pgW-PAD,ftY+8,{align:'right'});

  _showRenderProg('Selesai!','',100);
  done(doc);
}

function _drawLegSymbol(doc,row,x,y,c,icoW,icoH) {
  const t=row.tipe||'marker', cx=x+icoW/2, cy=y+icoH/2;
  if (t==='line') {
    doc.setDrawColor(c.r,c.g,c.b); doc.setLineWidth(Math.max(.8,icoH*.1));
    let px=x; while(px<x+icoW){const e=Math.min(px+icoW/5,x+icoW);doc.line(px,cy,e,cy);px+=icoW/5+icoW/8;}
    doc.setLineWidth(.25); return;
  }
  if (t==='poly') {
    const aw=icoW*.9,ah=icoH*.65,ax=x+icoW*.05,ay=cy-ah/2;
    doc.setFillColor(c.r,c.g,c.b); doc.setGState(doc.GState({opacity:.22}));
    doc.roundedRect(ax,ay,aw,ah,1,1,'F'); doc.setGState(doc.GState({opacity:1}));
    doc.setDrawColor(c.r,c.g,c.b); doc.setLineWidth(Math.max(.6,icoH*.08));
    doc.roundedRect(ax,ay,aw,ah,1,1,'S'); doc.setLineWidth(.25); return;
  }
  if (t==='dot') {
    const r=Math.min(icoW,icoH)*.38;
    doc.setFillColor(255,255,255); doc.circle(cx,cy,r+.8,'F');
    doc.setFillColor(c.r,c.g,c.b); doc.circle(cx,cy,r,'F'); return;
  }
  /* marker — pin PNG */
  const png=_getSimbolPng(row.simbol||'fa-map-pin',row.warna||'#607d8b');
  if (png) { try{doc.addImage(png,'PNG',x,y,icoW,icoH);return;}catch(e){} }
  /* fallback pin manual */
  const hr=icoW*.38;
  doc.setFillColor(c.r,c.g,c.b); doc.circle(cx,y+hr,hr,'F');
  doc.triangle(cx-hr+.5,y+hr*1.4,cx+hr-.5,y+hr*1.4,cx,y+icoH-.5,'F');
  doc.setFillColor(255,255,255); doc.circle(cx,y+hr,hr*.65,'F');
  doc.setFillColor(c.r,c.g,c.b); doc.circle(cx,y+hr,hr*.28,'F');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   14. STATISTIK KEPENDUDUKAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function loadStatistik() {
  setNav('db');
  setPage('Statistik Kelurahan', 'Data demografis penduduk Kepatihan');
  sbClose(); dAllCharts();

  await pageTransition(async () => {
    showLoad();
    try {
      const res=await gasCall('getStatistikDetail');
      hideLoad();
      if (!res.success) { showErr(res.message); return; }
      _renderStatistik(res.stat);
    } catch(e) { hideLoad(); throw e; }
  });
}

function _renderStatistik(s) {
  if (!s) return;
  G('ct').innerHTML=`<div class="fu">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <div style="font-family:var(--serif);font-size:1.1rem;color:var(--navy);flex:1">Statistik Detail Kependudukan</div>
      <button class="bg2" onclick="loadDashboard()"><i class="fas fa-arrow-left"></i> Kembali ke Dashboard</button>
    </div>
    <div class="sgr" style="grid-template-columns:repeat(4,1fr)">
      ${scCard('sc-navy','fa-users',      s.total||0,    'Total Penduduk')}
      ${scCard('sc-teal','fa-mars',       s.lakiLaki||0, 'Laki-laki')}
      ${scCard('sc-red', 'fa-venus',      s.perempuan||0,'Perempuan')}
      ${scCard('sc-gold','fa-house-user', Object.keys(s.perRT||{}).length,'Jumlah RT')}
    </div>
    <div class="cg2">
      <div>
        <div class="panel">
          <div class="phd"><span class="ptl"><i class="fas fa-chart-bar"></i>Penduduk per RT</span></div>
          <div class="pbd"><div class="chbox"><canvas id="ch-rt"></canvas></div></div>
        </div>
        <div class="panel">
          <div class="phd"><span class="ptl"><i class="fas fa-chart-bar"></i>Distribusi Pekerjaan</span></div>
          <div class="pbd"><div class="chbox"><canvas id="ch-pkj"></canvas></div></div>
        </div>
      </div>
      <div>
        <div class="panel">
          <div class="phd"><span class="ptl"><i class="fas fa-chart-pie"></i>Kelompok Usia</span></div>
          <div class="pbd"><div class="chbox-sm"><canvas id="ch-usia"></canvas></div></div>
        </div>
        <div class="panel">
          <div class="phd"><span class="ptl"><i class="fas fa-graduation-cap"></i>Pendidikan</span></div>
          <div class="pbd">${_buildPieList(s.perPendidikan||{})}</div>
        </div>
        <div class="panel">
          <div class="phd"><span class="ptl"><i class="fas fa-praying-hands"></i>Agama</span></div>
          <div class="pbd">${_buildPieList(s.perAgama||{})}</div>
        </div>
      </div>
    </div>
  </div>`;

  const rt=s.perRT||{}, rtK=Object.keys(rt).sort();
  if (G('ch-rt')&&typeof Chart!=='undefined')
    _CH['rt']=new Chart(G('ch-rt'),{type:'bar',data:{labels:rtK,datasets:[{label:'Penduduk',data:rtK.map(k=>rt[k]),backgroundColor:'rgba(10,104,128,.15)',borderColor:'#0a6880',borderWidth:2,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{precision:0}}}}});

  const pkj=s.perPekerjaan||{}, pkjK=Object.keys(pkj).sort((a,b)=>pkj[b]-pkj[a]).slice(0,8);
  if (G('ch-pkj')&&typeof Chart!=='undefined')
    _CH['pkj']=new Chart(G('ch-pkj'),{type:'bar',data:{labels:pkjK,datasets:[{label:'Jumlah',data:pkjK.map(k=>pkj[k]),backgroundColor:'rgba(146,88,10,.12)',borderColor:'#92580a',borderWidth:2,borderRadius:6}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0}},y:{grid:{display:false}}}}});

  const usia=s.perUsia||{};
  if (G('ch-usia')&&typeof Chart!=='undefined')
    _CH['usia']=new Chart(G('ch-usia'),{type:'doughnut',data:{labels:Object.keys(usia),datasets:[{data:Object.values(usia),backgroundColor:['rgba(10,104,128,.7)','rgba(4,120,87,.7)','rgba(201,123,14,.7)','rgba(201,28,59,.7)','rgba(109,40,217,.7)'],borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}}}}});
}

function _buildPieList(obj) {
  const entries=Object.entries(obj).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((acc,e)=>acc+e[1],0)||1;
  return entries.map(([k,v])=>{
    const pct=Math.round(v/total*100);
    return `<div class="pbar-wrap">
      <div class="pbar-lbl"><span>${esc(k)}</span><span style="font-family:var(--mono);color:var(--teal)">${v} (${pct}%)</span></div>
      <div class="pbar-track"><div class="pbar-fill" style="width:${pct}%;background:var(--teal)"></div></div>
    </div>`;
  }).join('');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   15. KALENDER MINI (dipakai app.js → _renderAgenda)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const _HARI = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function _renderKalender(y,m) {
  const firstDay=new Date(y,m,1).getDay();
  const daysInMonth=new Date(y,m+1,0).getDate();
  const prevDays=new Date(y,m,0).getDate();
  const today=new Date();
  const yrMo=y+'-'+String(m+1).padStart(2,'0');
  const evMap={};
  (_agData||[]).forEach(a=>{
    if (a.tanggal&&a.tanggal.substring(0,7)===yrMo) {
      const d=parseInt(a.tanggal.split('-')[2]||0); if(d) evMap[d]=true;
    }
  });

  let html=`<div class="cal-header">
    <button class="cal-nav" onclick="calNav(-1)"><i class="fas fa-chevron-left fa-xs"></i></button>
    <div class="cal-title">${_BULAN_ID[m]} ${y}</div>
    <button class="cal-nav" onclick="calNav(1)"><i class="fas fa-chevron-right fa-xs"></i></button>
  </div>
  <div class="cal-grid">${_HARI.map(h=>`<div class="cal-day-lbl">${h}</div>`).join('')}`;

  for (let i=firstDay-1;i>=0;i--) html+=`<div class="cal-cell other-month">${prevDays-i}</div>`;
  for (let d=1;d<=daysInMonth;d++) {
    const isT=d===today.getDate()&&m===today.getMonth()&&y===today.getFullYear();
    const hasE=!!evMap[d];
    html+=`<div class="cal-cell${isT?' today':''}${hasE?' has-event':''}" title="${hasE?'Ada kegiatan':''}">${d}</div>`;
  }
  const rem=(firstDay+daysInMonth)%7 ? 7-(firstDay+daysInMonth)%7 : 0;
  for (let n=1;n<=rem;n++) html+=`<div class="cal-cell other-month">${n}</div>`;

  return html+'</div>';
}

function calNav(dir) {
  _calMonth+=dir;
  if (_calMonth>11) { _calMonth=0; _calYear++; }
  else if (_calMonth<0) { _calMonth=11; _calYear--; }
  const cw=G('cal-wrap'); if(cw) cw.innerHTML=_renderKalender(_calYear,_calMonth);
}
