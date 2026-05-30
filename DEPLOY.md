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

## (Opsional) Agar Skor & Durasi Room Permanen

Filesystem Railway bersifat sementara — data skor/durasi **reset saat redeploy**. Untuk menyimpannya permanen:

1. Railway → service → **Variables** → tambah:
   - `DATA_DIR` = `/data`
2. Railway → service → **Settings → Volumes → + New Volume** → mount path: `/data`
3. Redeploy. Sekarang `durations.json` & `scores.json` tersimpan di volume permanen.

> Tanpa langkah ini pun website tetap jalan normal — hanya skor/durasi yang ter-reset tiap update kode.

---

## Ringkasan
| Hal | Status |
|-----|--------|
| PORT | otomatis (`process.env.PORT`) ✅ |
| HTTPS | otomatis dari Railway ✅ |
| WebSocket (Socket.IO) | didukung Railway ✅ |
| WebRTC (kamera/share screen) | jalan karena HTTPS ✅ |
| Domain sendiri | via Custom Domain + CNAME ✅ |

Setelah online di domainmu, **matikan** tunnel cloudflare lokal (tutup jendela `share-online.bat`) — sudah tidak diperlukan.
