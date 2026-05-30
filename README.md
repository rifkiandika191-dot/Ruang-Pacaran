# 💕 Website Pacaran — Nonton Bareng Online

Website untuk pasangan yang berjauhan: **nonton video bareng** (dari link YouTube / video langsung) dengan pemutar yang **tersinkron otomatis**, **berbagi layar (share screen)**, dan **chat real-time**.

## ✨ Fitur

- 💑 Buat / gabung "Ruang Pacaran" pakai kode atau link undangan
- 📺 Nonton bareng video dari **link YouTube** atau **link video langsung (.mp4)** — play, pause, dan seek otomatis ikut tersinkron untuk berdua
- 🖥️ **Share screen** langsung antar pasangan (WebRTC, peer-to-peer)
- 📞 **Panggilan** dengan **mic & kamera independen** — tiap orang bebas nyalakan/matikan mic & kamera sendiri, plus **zoom kamera pasangan**
- 🖥️ **Layar penuh (fullscreen)** untuk nonton bareng / share screen / video call
- 💌 **Tombol Kangen** — kirim animasi "Kangen kamu" + getar ke layar pasangan
- 🎮 **Game bareng** — Tic-Tac-Toe real-time & Truth or Dare romantis
- 🎨 **Papan gambar bareng** — corat-coret di kanvas yang tersinkron langsung
- 🎡 **Roda keputusan** — putar untuk menentukan "makan apa / kencan ke mana"
- 🚪 **Keluar room** dengan konfirmasi + 🔔 **popup notifikasi** saat pasangan masuk/keluar
- 🖼️ **Galeri foto kenangan** — unggah & lihat momen indah kalian
- 💌 **Catatan cinta harian** — tulis pesan manis yang tersimpan
- 💬 Chat real-time + reaksi cinta melayang (❤️😘🥰)
- 💖 Setelan pasangan: nama berdua + **hitung mundur** menuju hari spesial
- 🌙 **Dark mode**
- 🔗 Tombol salin link undangan untuk dikirim ke pasangan

## 🚀 Cara Menjalankan

### 1. Install Node.js
Kalau belum punya, unduh & install dari https://nodejs.org (pilih versi LTS).

### 2. Install dependency
Buka folder ini di Terminal / PowerShell, lalu jalankan:

```powershell
cd D:\WebsitePacaran
npm install
```

### 3. Jalankan server
```powershell
npm start
```

Atau klik dua kali file **`start.bat`**.

### 4. Buka di browser
```
http://localhost:3000
```

## 📱 Nonton Bareng Beda Tempat / Beda HP

**Satu jaringan WiFi yang sama:**
1. Di komputer server, jalankan `ipconfig` untuk lihat IP (contoh `192.168.1.5`).
2. Pasangan buka `http://192.168.1.5:3000` di HP/laptopnya.

**Beda jaringan (lewat internet):**
Gunakan tunnel gratis, contoh dengan [ngrok](https://ngrok.com):
```powershell
ngrok http 3000
```
Lalu bagikan URL `https://xxxx.ngrok-free.app` ke pasanganmu.

> ⚠️ **Catatan share screen:** Browser hanya mengizinkan share screen pada koneksi aman.
> `localhost` aman secara default. Untuk akses dari luar, pakai `https` (ngrok sudah https).

## 🗂️ Struktur Folder

```
D:\WebsitePacaran\
├── server.js              # Server Express + Socket.IO (sinkron video/musik, WebRTC, chat, API galeri/catatan)
├── package.json           # Daftar dependency & script
├── start.bat              # Klik 2x untuk install + jalankan (Windows)
├── render.yaml            # Blueprint deploy Render
├── Procfile               # Untuk deploy (Heroku/Railway)
├── DEPLOY.md              # Panduan deploy online gratis
├── README.md
├── data\                  # Penyimpanan galeri.json & notes.json (otomatis)
└── public\                # Frontend
    ├── index.html         # Halaman depan (buat / gabung ruangan)
    ├── room.html          # Ruang nonton bareng / musik / video call
    ├── gallery.html       # Galeri foto kenangan
    ├── notes.html         # Catatan cinta harian
    ├── uploads\           # Foto yang diunggah (otomatis)
    ├── css\style.css      # Tema romantis + dark mode
    ├── js\main.js         # Logika halaman depan
    ├── js\room.js         # Sinkron video/musik, share screen, video call, chat
    ├── js\gallery.js      # Logika galeri
    ├── js\notes.js        # Logika catatan
    └── assets\            # (untuk gambar/aset tambahan)
```

> 📄 Cara publikasikan ke internet ada di **[DEPLOY.md](DEPLOY.md)**.

## 🛠️ Teknologi
- **Node.js + Express** — web server
- **Socket.IO** — sinkronisasi real-time & signaling
- **WebRTC** — share screen peer-to-peer
- **YouTube IFrame API** — pemutar YouTube tersinkron

---
Dibuat dengan 💖 untuk kalian berdua.
