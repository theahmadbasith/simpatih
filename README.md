# SIMPATIH

**Sistem Informasi Manajemen Pemerintahan Kelurahan Kepatihan**
Kecamatan Ponorogo · Kabupaten Ponorogo · Jawa Timur

---

## Tentang

SIMPATIH adalah aplikasi web berbasis Google Apps Script (GAS) + Google Sheets yang dirancang untuk membantu pengelolaan administrasi Kelurahan Kepatihan. Aplikasi ini berjalan sepenuhnya di browser tanpa instalasi server, memanfaatkan Google Sheets sebagai database dan Google Drive sebagai penyimpanan dokumen.

**Lurah:** Husnul Arifandi, S.STP
**Author / Developer:** Ahmad Abdul Basith, S.Tr.I.P.
**Kontak Aduan:** [0851-5968-6554](https://wa.me/6285159686554)

---

## Fitur Utama

### Dashboard
- Ringkasan statistik surat masuk, surat keluar, dan permohonan
- Tren surat 6 bulan terakhir (grafik garis)
- Statistik penduduk (total, laki-laki, perempuan, per RT)
- Agenda hari ini & ringkasan bulan berjalan
- Notifikasi permohonan menunggu approval

### Buat Surat
- Form pembuatan surat keterangan resmi dengan kop otomatis
- Preview surat langsung di browser
- Cetak ke printer (A4, F4, Legal, Letter, Portrait/Landscape)
- Simpan ke arsip surat keluar
- Jenis surat: Domisili, Tidak Mampu, Usaha, Pengantar, Kelahiran, Kematian, Pindah, Lainnya

### Surat Masuk
- Pencatatan surat masuk beserta metadata lengkap
- Tab terpisah untuk Permohonan Warga
- Upload dokumen pendukung ke Google Drive
- Approval surat & permohonan oleh admin
- Notifikasi badge jumlah permohonan menunggu
- Cetak rekap laporan surat masuk

### Surat Keluar
- Pencatatan surat keluar kelurahan
- Upload dokumen
- Approval & manajemen status
- Cetak rekap laporan surat keluar

### Kependudukan
- Data penduduk lengkap (NIK, KK, nama, TTL, agama, pendidikan, pekerjaan, alamat RT/RW)
- Filter multi-keyword & filter per RT
- Tambah, edit, hapus data penduduk
- Statistik detail (chart per RT, kelompok usia, agama)

### Agenda Kegiatan
- Pencatatan jadwal kegiatan resmi kelurahan
- Kalender visual bulanan
- Filter per bulan & pencarian
- Status kegiatan (Aktif, Selesai, Batal)

### Peta Kepatihan
- Peta interaktif berbasis Leaflet.js
- Layer tile: OpenStreetMap, Satellite, Terrain
- Manajemen lokasi & marker kelurahan

### Arsip Dokumen
- Upload & manajemen dokumen resmi
- Kategori: Peraturan, Laporan Kegiatan, Musrenbang, Rapat, Administrasi, Lainnya
- Preview dokumen (PDF, gambar) langsung di browser
- Download dokumen dari Google Drive

### Laporan
- Ringkasan administrasi per bulan
- Cetak laporan bulanan resmi dengan kop surat
- Rekap surat masuk & keluar

### Pengaturan *(Admin only)*
- Manajemen akun pengguna (tambah, hapus, atur role)
- Ganti password
- Konfigurasi template kop surat & laporan (logo, instansi, nama TTD, NIP)
- Setup awal sheet & folder Google Drive
- Tentang Aplikasi

---

## Teknologi

| Komponen | Teknologi |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES2020) |
| Backend | Google Apps Script (GAS) |
| Database | Google Sheets |
| Storage | Google Drive |
| Hosting | Vercel |
| Peta | Leaflet.js 1.9.4 |
| Chart | Chart.js 4.4.0 |
| Icons | Font Awesome 6.5.0 |
| Font | IBM Plex Sans, IBM Plex Mono, Lora |

---

## Struktur File

```
simpatih/
├── index.html          # Entry point & HTML utama
├── css/
│   └── style.css       # Semua styling aplikasi
├── js/
│   ├── api.js          # Layer komunikasi ke GAS backend
│   ├── ui.js           # State global, auth, navigasi, helpers
│   ├── surat.js        # Modul surat masuk/keluar, permohonan, approval
│   ├── penduduk.js     # Modul kependudukan
│   ├── peta.js         # Modul peta Leaflet & statistik
│   └── app.js          # Dashboard, buat surat, agenda, arsip, laporan, pengaturan
└── assets/
    ├── icon-32.png
    ├── icon-192.png
    └── icon-full.png
```

**Load order JS:** `api.js` → `ui.js` → `surat.js` → `penduduk.js` → `peta.js` → `app.js`

---

## Instalasi & Setup

### Prasyarat
- Akun Google (untuk GAS & Sheets)
- Akun Vercel (untuk hosting frontend)

---

### 1. Setup Google Apps Script (Backend)

1. Buka [script.google.com](https://script.google.com) → buat project baru
2. Salin seluruh kode backend ke GAS editor
3. Buka **Project Settings** → scroll ke bagian **Script Properties**
4. Klik **Add script property** → tambahkan property berikut:

   | Property | Value |
   |---|---|
   | `API_SECRET_KEY` | Kunci rahasia bebas, contoh: `simpatih_s3cr3t_2026` |

5. Klik **Deploy** → **New Deployment** → pilih tipe **Web App**
   - Execute as: `Me`
   - Who has access: `Anyone`
6. Klik **Deploy** → salin **URL deployment** yang dihasilkan

> **Penting:** Setiap kali ada perubahan kode GAS, buat deployment baru (**New Deployment**) — jangan gunakan **Manage Deployments** yang sudah ada, karena GAS tidak update deployment lama secara otomatis.

---

### 2. Deploy Frontend ke Vercel

1. Push seluruh folder project ke repository GitHub
2. Buka [vercel.com](https://vercel.com) → **Add New Project** → import repository
3. Masuk ke **Settings → Environment Variables** → tambahkan tiga variabel berikut:

   | Variable | Value | Keterangan |
   |---|---|---|
   | `GAS_URL` | `https://script.google.com/macros/s/YOUR_ID/exec` | URL deployment GAS dari langkah 1 |
   | `API_SECRET_KEY` | `simpatih_s3cr3t_2026` | Harus sama persis dengan value di GAS Script Properties |
   | `CORS_ORIGIN` | `https://nama-project.vercel.app` | URL frontend Vercel Anda |

4. Klik **Save** lalu **Redeploy**

> **Catatan:** Setiap kali mengubah Environment Variables di Vercel, lakukan **Redeploy** agar perubahan berlaku.

---

### 3. Setup Awal Aplikasi

1. Buka URL frontend Vercel di browser
2. Login menggunakan akun admin default
3. Buka menu **Pengaturan → Setup & Maintenance**
4. Klik **Jalankan Setup Awal** — proses ini akan membuat semua sheet yang diperlukan di Google Sheets dan folder penyimpanan di Google Drive secara otomatis

---

### 4. Konfigurasi Template Surat

1. Buka **Pengaturan → Template Cetak Surat**
2. Isi data instansi, nama TTD, NIP, dan URL logo
3. Klik **Simpan Template Surat**
4. Ulangi untuk **Template Cetak Laporan**

---

## Akun Default

> Akun default dibuat otomatis saat Setup Awal dijalankan. **Segera ganti password setelah login pertama.**

```
Username : admin
Password : (sesuai konfigurasi di GAS backend)
Role     : admin
```

---

## Sistem Cache (Background Prefetch)

SIMPATIH menggunakan sistem cache berbasis `window._gc` untuk mempercepat navigasi antar menu. Setelah login, data semua menu di-fetch di background secara waterfall dengan jeda 1,2 detik per request, sehingga klik menu berikutnya terasa instan tanpa loading screen.

### API Cache

```javascript
window._gcGet(key)       // Ambil data dari cache (null jika expired/tidak ada)
window._gcSet(key, data) // Simpan data ke cache (TTL: 5 menit)
window._gcDel(key)       // Hapus satu key — panggil setelah submit/hapus data
window._gcClear()        // Hapus semua cache — panggil saat logout
window._gcRefresh(key)   // Refresh satu key di background
window._prefetchAll()    // Mulai prefetch semua menu — panggil setelah login
```

### Cache Keys

| Key | Data | Invalidasi saat |
|---|---|---|
| `suratMasuk` | `{ suratRes, permRes }` | Tambah/hapus surat masuk, approval |
| `suratKeluar` | `{ suratRes }` | Tambah/hapus surat keluar, approval |
| `penduduk` | `{ res }` | Tambah/edit/hapus penduduk |
| `agenda` | `{ res }` | Tambah/edit/hapus agenda |
| `arsip` | `{ res }` | Upload/hapus arsip |
| `laporan` | `{ res, bulan }` | Hanya bulan berjalan; ganti bulan fetch ulang |
| `pengaturan` | `{ res }` | Tambah/hapus user *(admin only)* |

---

## Role & Hak Akses

| Fitur | User | Admin |
|---|---|---|
| Lihat semua menu | ✓ | ✓ |
| Input permohonan | ✓ | ✓ |
| Tambah/hapus surat | — | ✓ |
| Approval surat & permohonan | — | ✓ |
| Tambah/edit/hapus penduduk | — | ✓ |
| Tambah/edit/hapus agenda | — | ✓ |
| Upload arsip | — | ✓ |
| Pengaturan sistem | — | ✓ |
| Manajemen akun | — | ✓ |

> Role `lurah` diperlakukan sama dengan `admin`.

---

## Catatan Teknis

- Menu **Peta** tidak di-prefetch karena berat (Leaflet tile & marker loading)
- Cache laporan hanya berlaku untuk bulan berjalan; ganti bulan akan fetch ulang dari GAS
- File upload maksimal **5 MB per file**
- Format dokumen yang didukung: PDF, JPG, JPEG, PNG, DOC, DOCX
- Sesi login disimpan di `sessionStorage` — otomatis hilang saat tab/browser ditutup
- Seluruh dokumen disimpan di **Google Drive** milik akun yang men-deploy GAS

---

## Lisensi

Aplikasi ini dikembangkan khusus untuk **Kelurahan Kepatihan, Kecamatan Ponorogo, Kabupaten Ponorogo**.
Hak cipta © 2026 Ahmad Abdul Basith, S.Tr.I.P. Seluruh hak dilindungi.
