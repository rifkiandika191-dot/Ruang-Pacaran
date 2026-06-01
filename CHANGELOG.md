# Changelog — Ruang Pacaran 💕

Semua perubahan penting dicatat di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.0.0/).

---

## [4.0.0] — 2026-06-01

### Ditambahkan
- **🎶 Playlist Bareng** — antri lagu YouTube bersama langsung dari panel "Link Musik"
  - Tombol **➕ Antri** di samping ▶ Putar: masuk antrian, bukan langsung diputar
  - Antrian tampil inline di bawah input — thumbnail, judul, nama yang tambah
  - Keduanya bebas tambah lagu kapan saja tanpa sistem giliran
  - Tombol **⏭ Lagu Berikutnya** dan **🗑 Kosongkan** antrian
  - **Auto-play**: saat lagu habis, lagu berikutnya di antrian langsung diputar otomatis
  - Judul lagu diambil otomatis dari YouTube via noembed API
  - Sinkronisasi antrian real-time lewat Socket.IO (kedua sisi selalu sama)

### Diperbaiki
- **📱 Responsif mobile** — layout disesuaikan untuk semua ukuran layar HP
  - Player menggunakan `aspect-ratio: 16/9` dengan fallback `min-height` untuk HP lama
  - Input musik: grid 2 kolom (Putar & Antri berdampingan, bukan bertumpuk)
  - Semua `min-width` keras di-reset ke `0` pada mobile (input, tile kamera, board game)
  - Modal memiliki `max-height` dan `overflow-y: auto` — tidak terpotong di layar kecil
  - Lebar modal dikunci `calc(100vw - 24px)` agar tidak melebihi layar
  - Popup notifikasi dan toast tidak lagi keluar frame di HP sempit
  - Board game Sambung 4 (`c4-board`) dan XOX (`ttt-board`) dibatasi `max-width: 100%`
  - Tile kamera video call (`cpg-tile`) tidak lagi overflow saat dua kamera aktif
  - Fun bar 3 kolom → 2 kolom di HP ≤480px
  - Countdown & session timer disembunyikan di HP ≤480px untuk hemat ruang topbar
  - Global fix: `*, *::before, *::after { max-width: 100%; box-sizing: border-box }`

---

## [3.0.0] — 2026-05-30

### Ditambahkan
- **💬 Global Chat** — semua pengunjung bisa ngobrol tanpa masuk room
  - Badge / level: Pendatang Baru 🌱 → Reguler 💬 → Warga Tetap 🌸 → Legend 👑
  - Leaderboard mingguan — top 3 paling aktif
  - Quote romantis harian — muncul otomatis saat ada yang masuk
  - Typing indicator di global chat
- **🎵 Tebak Lagu** — game di global chat dengan perintah `!tebak`
  - 80+ lagu pop/indie Indonesia, petunjuk huruf pertama tiap kata
  - Jawaban otomatis diperiksa, waktu 30 detik
- **💝 Cari Pacar Online** — matchmaking antar pengunjung
  - Halaman `/find` dengan antrian real-time
  - Tombol ⏭ Skip — langsung cari pasangan baru
  - Live counter "orang sedang mencari" di landing page
- **🌸 Dinding Cinta** — papan pesan publik untuk semua pengunjung
  - Tulis pesan + foto ke seseorang, like, auto-hapus setelah 3 jam
- **💸 Donasi via Saweria** — webhook notifikasi donasi real-time
  - Animasi kembang api untuk donasi ≥ Rp3.000
  - Top donatur mingguan & riwayat donasi terbaru
- **📝 Halaman Saran** — kirim masukan, lapor bug, atau request fitur dengan like

### Diperbaiki
- `resetVotes` dipindah ke module scope — reset skor tidak pernah bekerja sebelumnya karena tiap socket punya objek sendiri
- HTML5 video seek threshold — seek action sekarang selalu diterapkan tanpa batas 0.4 detik

---

## [2.0.0] — 2026-05-15

### Ditambahkan
- **🎮 Game Bareng** — 7 game dalam satu modal
  - ⭕ XOX 5×5, 🔴 Sambung 4, 👊 Tap Battle, 🧠 Kuis Pasangan
  - ✊ Suit, 💋 Truth or Dare, 🤔 "Lebih Mungkin..."
  - Scoreboard persisten per room (tersimpan walau keluar)
- **🎡 Roda Keputusan** — putar roda untuk pilih makan apa / kencan ke mana
- **🌍 Lokasi & Waktu Lokal** — tampilkan jarak antar kota dan perbedaan zona waktu
- **🎵 Musik Bareng** — putar lagu YouTube/playlist di tab terpisah (tidak ganggu nonton bareng)
- **💌 Tombol Kangen & Ciuman** — animasi layar penuh + lonceng notifikasi
- **🔥 Streak Harian** — hitung berturut-turut hari kalian masuk room bersama
- **✏️ Typing Indicator** — "sedang mengetik..." tampil di chat pasangan
- **📷 Kirim Gambar di Chat** — base64, kompresi otomatis, maks 2MB
- **⏱️ Timer Durasi Room** — total waktu yang dihabiskan bersama di room, persisten
- **📅 Countdown Anniversary** — hitung mundur ke tanggal spesial di topbar
- **📞 Video Call** — mic & kamera independen, flip kamera, zoom kamera pasangan
- **🔗 Salin Link Undangan** — Web Share API di HP, clipboard fallback di desktop
- **📋 Riwayat Room** — 20 room terakhir tersimpan di localStorage halaman utama
- **🗑️ Hapus Pesan Chat** — hanya pemilik pesan yang bisa hapus

### Diperbaiki
- Stabilitas sinkronisasi video HTML5 (threshold seek dihapus)
- Reconnect ICE otomatis saat koneksi WebRTC gagal (maks 3x restart)

---

## [1.0.0] — 2026-04-01

### Rilis Pertama
- **📺 Nonton Bareng** — sinkronisasi YouTube & video HTML5 (.mp4) secara real-time
  - Play, pause, seek tersinkron otomatis untuk berdua
  - Koreksi drift waktu setiap 4 detik
- **🖥️ Share Screen** — berbagi layar peer-to-peer via WebRTC
- **💬 Chat Real-time** — dengan reaksi emoji melayang (❤️ 😘 🥰 😂 🔥 🎉)
- **💑 Setelan Pasangan** — simpan nama berdua, sinkron ke pasangan
- **🌙 Dark Mode** — tema gelap romantis, tersimpan di localStorage
- **⛶ Layar Penuh** — fullscreen player + klik 2x atau tekan F
- **🔔 Popup Notifikasi** — saat pasangan masuk / keluar room
- **💖 Buat & Gabung Room** — kode 7 karakter unik atau langsung dari link

---

*Dibuat dengan 💖 untuk pasangan yang berjauhan.*
