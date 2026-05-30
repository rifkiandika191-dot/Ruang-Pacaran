# 🚀 Deploy ke Railway + Domain Sendiri

Panduan agar Website Pacaran online permanen (24 jam) di **Railway** dengan **domain milikmu sendiri** — menggantikan link tunnel sementara.

> ✅ Railway otomatis memberi **HTTPS** → fitur kamera, share screen, & video call jalan.

---

## LANGKAH 1 — Taruh kode di GitHub

Railway deploy dari GitHub. Pilih salah satu:

### Opsi A — Pakai git (sudah terinstall)
Di folder `D:\WebsitePacaran`, jalankan di PowerShell:
```powershell
cd D:\WebsitePacaran
git add -A
git commit -m "Website pacaran"
git branch -M main
git remote remove origin
git remote add origin https://github.com/USERNAME/NAMA-REPO.git   # ganti dgn repo-mu
git push -u origin main
```
> Buat repo kosong dulu di https://github.com/new (Public/Private bebas), lalu pakai URL-nya di perintah `git remote add` di atas.

### Opsi B — Upload lewat web GitHub (tanpa perintah)
1. Buat repo di https://github.com/new
2. Klik **uploading an existing file**
3. Seret semua file & folder **KECUALI** `node_modules` (file: server.js, package.json, railway.json, Procfile, folder `public`, dll) → **Commit**

---

## LANGKAH 2 — Deploy di Railway

1. Daftar/masuk di https://railway.app (login pakai GitHub paling mudah).
2. **New Project → Deploy from GitHub repo** → pilih repo tadi.
3. Railway otomatis mendeteksi Node.js, menjalankan `npm install` lalu `npm start`.
4. Tunggu sampai status **Active** (±1-2 menit).
5. Buka tab **Settings → Networking** → klik **Generate Domain** untuk dapat URL `xxxx.up.railway.app` (untuk tes dulu).

> Tidak perlu set PORT manual — server sudah pakai `process.env.PORT` otomatis dari Railway.

---

## LANGKAH 3 — Pasang Domain Sendiri

### Di Railway:
1. **Settings → Networking → Custom Domain → + Add Custom Domain**
2. Ketik domainmu. **Disarankan pakai subdomain**, contoh:
   - `pacaran.domainku.com`  (subdomain — paling mudah)
   - atau root domain `domainku.com`
3. Railway menampilkan **target CNAME**, contoh: `abcd1234.up.railway.app`. **Salin** ini.

### Di penyedia domain kamu (Niagahoster / Cloudflare / GoDaddy / dll):
Buka **DNS Management**, tambahkan record:

**Kalau pakai subdomain (disarankan):**
| Type  | Name      | Value (Target)              |
|-------|-----------|-----------------------------|
| CNAME | `pacaran` | `abcd1234.up.railway.app`   |

**Kalau pakai root domain (`domainku.com`):**
- Banyak provider tidak izinkan CNAME di root. Pakai **CNAME flattening / ALIAS / ANAME** kalau tersedia, atau pakai **Cloudflare** (gratis) yang otomatis mendukungnya.

4. Simpan. Tunggu DNS menyebar (5–30 menit, kadang sampai 1 jam).
5. Railway otomatis menerbitkan **sertifikat SSL (HTTPS)** setelah DNS terverifikasi. Selesai! 🎉

Buka `https://pacaran.domainku.com` — itulah link permanen kamu untuk dibagikan.

---

## LANGKAH 4 — Agar Data Tidak Hilang Saat Deploy Ulang ⚠️

> **Mengapa ini penting?**
> Railway menggunakan filesystem sementara — artinya setiap kali kamu push kode baru dan Railway deploy ulang, file seperti `scores.json`, `durations.json`, dan `streaks.json` akan **terhapus otomatis**.
> Dengan Railway Volume, file-file tersebut tersimpan di disk permanen yang tidak ikut terhapus.

Data yang dilindungi oleh Volume ini:
- 🏆 **Skor game** (XOX, Sambung4, Suit, dll)
- ⏱️ **Durasi room** (berapa lama kalian habiskan bersama)
- 🔥 **Streak harian** (hari berturut-turut login bareng)

---

### Bagian A — Tambahkan Environment Variable

> Langkah ini memberitahu server untuk menyimpan data ke folder `/data` (lokasi Volume).

1. Buka [railway.app](https://railway.app) → login
2. Klik proyek **Ruang Pacaran** kamu
3. Klik service **web** (kotak yang ada nama proyekmu)
4. Klik tab **"Variables"** di panel atas

   ```
   [ Deployments ] [ Variables ] [ Settings ] [ Metrics ]
   ```

5. Klik tombol **"+ New Variable"**
6. Isi:
   - **Key** → `DATA_DIR`
   - **Value** → `/data`
7. Klik **Add** / Enter untuk menyimpan

---

### Bagian B — Buat Volume (Disk Permanen)

> Volume ini adalah disk khusus yang tidak terhapus walau Railway deploy ulang berkali-kali.

1. Masih di halaman proyek yang sama
2. Klik tombol **"+ New"** di pojok kiri atas (atau tombol **"+"** di sidebar)
3. Pilih **"Volume"**

   ```
   ┌─────────────────────────────┐
   │  + New                      │
   │  ┌──────────────────────┐   │
   │  │ 📦 Empty Service     │   │
   │  │ 🗄️  Database         │   │
   │  │ 💾 Volume            │ ← klik ini
   │  └──────────────────────┘   │
   └─────────────────────────────┘
   ```

4. Railway akan meminta kamu menghubungkan Volume ke service.
   - Pilih service web kamu (nama proyekmu)
   - **Mount Path** → ketik: `/data`
   - Klik **Create**

5. Tunggu beberapa detik — Railway otomatis redeploy service kamu dengan Volume terpasang.

---

### Bagian C — Verifikasi (Opsional tapi Direkomendasikan)

Setelah redeploy selesai, cek apakah data tersimpan dengan benar:

1. Masuk ke room bersama pasangan → mainkan game → catat skor
2. Push kode baru (atau tunggu auto-deploy terjadi)
3. Buka room yang sama → cek apakah skor masih ada ✅

Kalau skor masih ada = Volume berhasil terpasang! 🎉

---

### Ringkasan Langkah

| Langkah | Aksi | Keterangan |
|---------|------|------------|
| A | Variables → `DATA_DIR` = `/data` | Arahkan server ke folder Volume |
| B | + New → Volume → mount `/data` | Buat disk permanen |
| C | Test skor setelah deploy ulang | Verifikasi berhasil |

---

## Ringkasan Keseluruhan
| Hal | Status |
|-----|--------|
| PORT | otomatis (`process.env.PORT`) ✅ |
| HTTPS | otomatis dari Railway ✅ |
| WebSocket (Socket.IO) | didukung Railway ✅ |
| WebRTC (kamera/share screen) | jalan karena HTTPS ✅ |
| Domain sendiri | via Custom Domain + CNAME ✅ |
| Data permanen (skor, streak, durasi) | via Railway Volume ✅ |

Setelah online di domainmu, **matikan** tunnel cloudflare lokal (tutup jendela `share-online.bat`) — sudah tidak diperlukan.
