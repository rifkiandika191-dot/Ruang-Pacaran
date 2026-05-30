// ============================================================
//  Website Pacaran - Server
//  Express + Socket.IO
//  - Hosting file statis (frontend)
//  - Room "pacaran" untuk pasangan
//  - Sinkronisasi pemutar video (nonton bareng)
//  - Signaling WebRTC untuk share screen
//  - Chat real-time
// ============================================================

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" })); // Saweria kirim form-encoded

// Sajikan file statis dari folder /public
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------------
//  Penyimpanan DURASI ROOM (persisten per kode room)
//  Total waktu yang dihabiskan di room — tersimpan walau kosong,
//  lanjut lagi saat ada yang masuk dengan kode room sama.
// ------------------------------------------------------------
// DATA_DIR bisa diarahkan ke Railway Volume lewat env (mis. /data) agar persisten
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const DURATIONS_FILE = path.join(DATA_DIR, "durations.json");

let roomSeconds = {};
try { roomSeconds = JSON.parse(fs.readFileSync(DURATIONS_FILE, "utf8")) || {}; } catch { roomSeconds = {}; }
const roomActiveSince = {}; // roomId -> timestamp saat room mulai aktif (ada minimal 1 user)
function saveDurations() { try { fs.writeFileSync(DURATIONS_FILE, JSON.stringify(roomSeconds)); } catch (e) {} }
function currentRoomSeconds(roomId) {
  let s = roomSeconds[roomId] || 0;
  if (roomActiveSince[roomId]) s += (Date.now() - roomActiveSince[roomId]) / 1000;
  return Math.floor(s);
}

// ------------------------------------------------------------
//  SKOR GAME (persisten per kode room) — { roomId: { nama: menang } }
// ------------------------------------------------------------
const SCORES_FILE = path.join(DATA_DIR, "scores.json");
let roomScores = {};
try { roomScores = JSON.parse(fs.readFileSync(SCORES_FILE, "utf8")) || {}; } catch { roomScores = {}; }
function saveScores() { try { fs.writeFileSync(SCORES_FILE, JSON.stringify(roomScores)); } catch (e) {} }

// ------------------------------------------------------------
//  RIWAYAT CHAT (persisten) — { roomId: [{ name, text, ts, system? }] }
//  Gambar & audio tidak disimpan (terlalu besar), hanya ditandai.
// ------------------------------------------------------------
const CHATS_FILE = path.join(DATA_DIR, "chats.json");
let roomChats = {};
try { roomChats = JSON.parse(fs.readFileSync(CHATS_FILE, "utf8")) || {}; } catch { roomChats = {}; }
let chatSaveTimer = null;
function saveChats() {
  clearTimeout(chatSaveTimer);
  chatSaveTimer = setTimeout(() => {
    try { fs.writeFileSync(CHATS_FILE, JSON.stringify(roomChats)); } catch (e) {}
  }, 2000); // debounce agar tidak terlalu sering tulis file
}
const CHAT_LIMIT = 100; // simpan maks 100 pesan per room

// Helper: emit chat ke room DAN simpan ke riwayat
function emitRoomChat(roomId, msg) {
  // Beri ID unik pada setiap pesan (untuk fitur hapus)
  if (!msg.system && !msg.msgId) msg.msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  io.to(roomId).emit("chat", msg);
  if (!roomChats[roomId]) roomChats[roomId] = [];
  const record = { ts: msg.ts || Date.now() };
  if (msg.system) { record.system = true; record.text = msg.text; }
  else {
    record.msgId = msg.msgId;
    record.name = msg.name;
    if (msg.text) record.text = msg.text;
    else if (msg.img) record.text = "[📷 Gambar]";
  }
  if (roomChats[roomId].length >= CHAT_LIMIT) roomChats[roomId].shift();
  roomChats[roomId].push(record);
  saveChats();
}

// ------------------------------------------------------------
//  STREAK HARIAN — { roomId: { lastDate, streak, longest } }
// ------------------------------------------------------------
const STREAKS_FILE = path.join(DATA_DIR, "streaks.json");
let roomStreaks = {};
try { roomStreaks = JSON.parse(fs.readFileSync(STREAKS_FILE, "utf8")) || {}; } catch { roomStreaks = {}; }
function saveStreaks() { try { fs.writeFileSync(STREAKS_FILE, JSON.stringify(roomStreaks)); } catch (e) {} }

function updateStreak(roomId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const s = roomStreaks[roomId] || { lastDate: null, streak: 0, longest: 0 };
  if (s.lastDate === today) return s; // sudah dihitung hari ini
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  s.streak = (s.lastDate === yesterday) ? s.streak + 1 : 1;
  s.lastDate = today;
  s.longest = Math.max(s.streak, s.longest);
  roomStreaks[roomId] = s;
  saveStreaks();
  return s;
}

// ------------------------------------------------------------
//  DONASI (dari Saweria webhook)
// ------------------------------------------------------------
const DONATIONS_FILE = path.join(DATA_DIR, "donations.json");
let donations = [];
try { donations = JSON.parse(fs.readFileSync(DONATIONS_FILE, "utf8")) || []; } catch { donations = []; }
function saveDonations() { try { fs.writeFileSync(DONATIONS_FILE, JSON.stringify(donations)); } catch (e) {} }

// ------------------------------------------------------------
//  SARAN / FITUR / BUG dari user
// ------------------------------------------------------------
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");
let feedbacks = [];
try { feedbacks = JSON.parse(fs.readFileSync(FEEDBACK_FILE, "utf8")) || []; } catch { feedbacks = []; }
function saveFeedback() { try { fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbacks)); } catch (e) {} }

// ------------------------------------------------------------
//  RESET VOTES — harus di module scope agar votes antar user terkumpul
// ------------------------------------------------------------
const resetVotes = {}; // roomId -> Set<socketId>

// ------------------------------------------------------------
//  MATCHMAKING — antrian cari pacar online
// ------------------------------------------------------------
const matchQueue = []; // [{ id: socketId, name, joinedAt }]

function makeRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "L" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
function broadcastQueueCount() {
  const count = matchQueue.length;
  // Beritahu semua yang sedang antri
  matchQueue.forEach(({ id }) => io.to(id).emit("match-count", count));
  // Broadcast ke semua (landing page bisa tampilkan)
  io.emit("match-online-count", count);
}
function removeFromQueue(socketId) {
  const idx = matchQueue.findIndex(q => q.id === socketId);
  if (idx !== -1) { matchQueue.splice(idx, 1); broadcastQueueCount(); }
}

// Route eksplisit (biar refresh di /room tetap jalan)
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/room", (req, res) => res.sendFile(path.join(__dirname, "public", "room.html")));
app.get("/find", (req, res) => res.sendFile(path.join(__dirname, "public", "find.html")));
app.get("/saran", (req, res) => res.sendFile(path.join(__dirname, "public", "saran.html")));

// ─────────────────────────────────────────────────────────────
//  API: SAWERIA WEBHOOK (terima notifikasi donasi)
//  Isi webhook URL di Saweria: https://domain-kamu/api/donation-webhook
// ─────────────────────────────────────────────────────────────
app.post("/api/donation-webhook", (req, res) => {
  // Log raw payload untuk debug
  console.log("[WEBHOOK] headers:", JSON.stringify(req.headers["content-type"]));
  console.log("[WEBHOOK] body:", JSON.stringify(req.body));

  // Verifikasi secret opsional (set env SAWERIA_SECRET di Railway)
  const secret = process.env.SAWERIA_SECRET;
  if (secret) {
    const incoming = req.headers["x-saweria-key"] || req.query.key || "";
    if (incoming !== secret) return res.status(401).json({ error: "Unauthorized" });
  }
  const body = req.body || {};
  const data = body.data || body;
  if (!data.donator_name) {
    console.log("[WEBHOOK] DITOLAK — donator_name tidak ada. data:", JSON.stringify(data));
    return res.status(400).json({ error: "Invalid payload" });
  }

  // Saweria kirim amount di field "amount_raw", bukan "amount"
  const amountVal = data.amount_raw ?? data.amount ?? (data.etc && data.etc.amount_to_display) ?? 0;
  const rawAmount = String(amountVal).replace(/\./g, "").replace(/,/g, ".");
  const donation = {
    name:    String(data.donator_name).slice(0, 50).trim(),
    amount:  Math.max(0, parseFloat(rawAmount) || 0),
    message: String(data.message || "").slice(0, 300).trim(),
    ts:      Date.now(),
  };
  console.log("[WEBHOOK] donasi tersimpan:", JSON.stringify(donation));

  donations.unshift(donation);
  if (donations.length > 500) donations = donations.slice(0, 500);
  saveDonations();

  // Semua donasi → notif (besar = kembang api, kecil = toast saja)
  if (donation.amount >= 10000) {
    io.emit("new-donation", donation);
  } else {
    io.emit("new-donation-small", donation);
  }
  res.json({ ok: true });
});

// API: top donatur (aggregate per nama)
app.get("/api/top-donors", (req, res) => {
  const map = {};
  donations.forEach((d) => {
    const key = d.name.toLowerCase();
    if (!map[key]) map[key] = { name: d.name, total: 0, count: 0 };
    map[key].total += d.amount;
    map[key].count++;
  });
  const top = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  res.json(top);
});

// API: donasi terbaru
app.get("/api/recent-donations", (req, res) => res.json(donations.slice(0, 10)));

// API: test donasi — broadcast ke SEMUA user (hanya untuk testing)
app.post("/api/test-donation", (req, res) => {
  const donation = {
    name:    (req.body && req.body.name)    || "Test Donatur",
    amount:  (req.body && req.body.amount)  || 50000,
    message: (req.body && req.body.message) || "Semangat terus! 🎉",
  };
  io.emit("new-donation", donation);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
//  GLOBAL CHAT — semua pengunjung bisa chat bersama
// ─────────────────────────────────────────────────────────────
const GLOBAL_ROOM = "__global__";
let globalMessages = []; // simpan 100 pesan terakhir di memori
let globalOnline = 0;    // jumlah user di halaman chat global

app.get("/chat", (req, res) => res.sendFile(path.join(__dirname, "public", "chat.html")));

// ─────────────────────────────────────────────────────────────
//  API: SARAN / FITUR / BUG
// ─────────────────────────────────────────────────────────────
app.post("/api/feedback", (req, res) => {
  const { name, type, message } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: "Pesan kosong" });
  const types = ["saran", "fitur", "bug"];
  const fb = {
    id:      Date.now(),
    name:    String(name || "Anonim").slice(0, 40).trim() || "Anonim",
    type:    types.includes(type) ? type : "saran",
    message: String(message).slice(0, 800).trim(),
    ts:      Date.now(),
    likes:   0,
  };
  feedbacks.unshift(fb);
  if (feedbacks.length > 300) feedbacks = feedbacks.slice(0, 300);
  saveFeedback();
  io.emit("new-feedback", fb);
  res.json({ ok: true, id: fb.id });
});

app.get("/api/feedback", (req, res) => res.json(feedbacks.slice(0, 100)));

// Like feedback
app.post("/api/feedback/:id/like", (req, res) => {
  const fb = feedbacks.find((f) => f.id === Number(req.params.id));
  if (!fb) return res.status(404).json({ error: "Not found" });
  fb.likes = (fb.likes || 0) + 1;
  saveFeedback();
  res.json({ ok: true, likes: fb.likes });
});

// ------------------------------------------------------------
//  State sederhana di memori: { roomId: { users: Map<socketId, name>, videoState } }
// ------------------------------------------------------------
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Map(),
      videoState: { url: null, type: null, time: 0, playing: false, updatedAt: Date.now() },
    });
  }
  return rooms.get(roomId);
}

io.on("connection", (socket) => {
  let currentRoom = null;
  let myName = "Sayang";

  // --- Gabung room ---
  socket.on("join", ({ roomId, name }) => {
    roomId = (roomId || "").trim().toUpperCase();
    if (!roomId) return;

    currentRoom = roomId;
    myName = (name || "Sayang").trim().slice(0, 24) || "Sayang";

    const room = getRoom(roomId);

    // Maksimal 2 orang (pacaran = berdua) — tapi izinkan lebih kalau mau ramai
    socket.join(roomId);
    room.users.set(socket.id, myName);

    // Room jadi aktif → mulai/lanjutkan hitung durasi
    if (!roomActiveSince[roomId]) roomActiveSince[roomId] = Date.now();

    // Pastikan skor untuk nama ini ada (biar scoreboard tampil lengkap)
    if (!roomScores[roomId]) roomScores[roomId] = {};
    if (!(myName in roomScores[roomId])) { roomScores[roomId][myName] = 0; saveScores(); }

    // Kirim daftar user & state video saat ini ke yang baru masuk
    socket.emit("joined", {
      roomId,
      you: { id: socket.id, name: myName },
      users: Array.from(room.users, ([id, n]) => ({ id, name: n })),
      videoState: room.videoState,
      durationSeconds: currentRoomSeconds(roomId),
      streak: roomStreaks[roomId] || { streak: 0, longest: 0, lastDate: null },
      chatHistory: roomChats[roomId] || [],
    });

    // Update streak ketika ada 2+ orang di room (kedua pasangan hadir)
    if (room.users.size >= 2) {
      const streak = updateStreak(roomId);
      io.to(roomId).emit("streak", streak);
    }

    // Beri tahu yang lain
    socket.to(roomId).emit("user-joined", { id: socket.id, name: myName });
    io.to(roomId).emit(
      "users",
      Array.from(room.users, ([id, n]) => ({ id, name: n }))
    );
    io.to(roomId).emit("scoreboard", roomScores[roomId]);

    // Pesan sistem
    emitRoomChat(roomId, { system: true, text: `${myName} masuk ke ruangan 💕`, ts: Date.now() });
  });

  // --- Chat ---
  socket.on("chat", ({ text, img }) => {
    if (!currentRoom) return;
    if (!text && !img) return;
    const msg = { id: socket.id, name: myName, ts: Date.now() };
    if (text) msg.text = String(text).slice(0, 500);
    if (img && typeof img === "string" && img.length < 2_200_000) msg.img = img;
    emitRoomChat(currentRoom, msg);
  });

  // --- Hapus pesan chat ---
  socket.on("chat-delete", ({ msgId }) => {
    if (!currentRoom || !msgId) return;
    // Hanya pemilik pesan yang bisa hapus (cek via socket.id + prefix)
    socket.to(currentRoom).emit("chat-delete", { msgId, by: myName });
    // Tandai di riwayat sebagai dihapus (ganti text)
    if (roomChats[currentRoom]) {
      const m = roomChats[currentRoom].find((r) => r.msgId === msgId);
      if (m) { m.text = "[🚫 Pesan dihapus]"; m.deleted = true; saveChats(); }
    }
  });

  // --- Typing indicator ---
  socket.on("typing", ({ on }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("typing", { id: socket.id, name: myName, on: !!on });
  });

  // --- Set sumber video (link) ---
  socket.on("video-source", ({ url, type }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.videoState = { url, type, time: 0, playing: false, updatedAt: Date.now() };
    io.to(currentRoom).emit("video-source", { url, type });
    emitRoomChat(currentRoom, { system: true, text: `${myName} memutar video baru 🎬`, ts: Date.now() });
  });

  // --- Stop nonton bareng (bersihkan video) ---
  socket.on("video-stop", () => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.videoState = { url: null, type: null, time: 0, playing: false, updatedAt: Date.now() };
    socket.to(currentRoom).emit("video-stop");
    emitRoomChat(currentRoom, { system: true, text: `${myName} menghentikan nonton bareng ⏹️`, ts: Date.now() });
  });

  // --- Kontrol pemutar (play/pause/seek) ---
  socket.on("video-control", ({ action, time }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (action === "play") room.videoState.playing = true;
    if (action === "pause") room.videoState.playing = false;
    if (typeof time === "number") room.videoState.time = time;
    room.videoState.updatedAt = Date.now();
    // Teruskan ke pasangan (bukan ke diri sendiri)
    socket.to(currentRoom).emit("video-control", { action, time, by: myName });
  });

  // --- Sinkronisasi waktu berkala (host kirim posisi) ---
  socket.on("video-sync", ({ time, playing }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("video-sync", { time, playing });
  });

  // ----------------------------------------------------------
  //  REAKSI CINTA (hati melayang) & info pasangan
  // ----------------------------------------------------------
  socket.on("reaction", ({ emoji }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("reaction", { emoji, name: myName });
  });

  socket.on("couple-info", (info) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("couple-info", info);
  });

  // ----------------------------------------------------------
  //  FITUR SERU (kangen, game, roda) — satu kanal relay
  // ----------------------------------------------------------
  socket.on("fun", (data) => {
    if (!currentRoom || !data) return;
    socket.to(currentRoom).emit("fun", { ...data, by: myName });
  });

  // ----------------------------------------------------------
  //  SKOR GAME — menang +1, tersimpan per room
  // ----------------------------------------------------------
  socket.on("score-win", () => {
    if (!currentRoom) return;
    if (!roomScores[currentRoom]) roomScores[currentRoom] = {};
    roomScores[currentRoom][myName] = (roomScores[currentRoom][myName] || 0) + 1;
    saveScores();
    io.to(currentRoom).emit("scoreboard", roomScores[currentRoom]);
  });
  // Reset skor: butuh SEMUA orang di room setuju
  socket.on("score-reset-vote", () => {
    if (!currentRoom) return;
    if (!resetVotes[currentRoom]) resetVotes[currentRoom] = new Set();
    resetVotes[currentRoom].add(socket.id);
    const room = getRoom(currentRoom);
    const needed = room.users.size;
    const got = resetVotes[currentRoom].size;
    if (got >= needed) {
      // Semua setuju — reset
      resetVotes[currentRoom] = new Set();
      if (roomScores[currentRoom]) {
        Object.keys(roomScores[currentRoom]).forEach((k) => (roomScores[currentRoom][k] = 0));
        saveScores();
      }
      io.to(currentRoom).emit("score-reset-done");
      io.to(currentRoom).emit("scoreboard", roomScores[currentRoom] || {});
    } else {
      // Belum semua — beritahu yang lain
      socket.to(currentRoom).emit("score-reset-requested", { by: myName, got, needed });
      socket.emit("score-reset-waiting", { got, needed });
    }
  });

  // ----------------------------------------------------------
  //  WebRTC signaling untuk VIDEO CALL (kamera + mikrofon)
  // ----------------------------------------------------------
  socket.on("call-offer", ({ to, sdp, mode }) => {
    io.to(to).emit("call-offer", { from: socket.id, name: myName, sdp, mode });
  });
  socket.on("call-answer", ({ to, sdp }) => {
    io.to(to).emit("call-answer", { from: socket.id, sdp });
  });
  socket.on("call-ice", ({ to, candidate }) => {
    io.to(to).emit("call-ice", { from: socket.id, candidate });
  });
  socket.on("call-start", ({ mode } = {}) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("call-start", { from: socket.id, name: myName, mode });
  });
  socket.on("call-media", ({ mic, cam } = {}) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("call-media", { from: socket.id, mic, cam });
  });
  // Kanal sinyal terpadu (perfect negotiation): offer/answer/ICE
  socket.on("call-signal", ({ to, description, candidate }) => {
    if (!to) return;
    io.to(to).emit("call-signal", { from: socket.id, description, candidate });
  });
  socket.on("call-stop", () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("call-stop", { from: socket.id });
  });

  // ----------------------------------------------------------
  //  WebRTC signaling untuk SHARE SCREEN
  // ----------------------------------------------------------
  socket.on("screen-offer", ({ to, sdp }) => {
    io.to(to).emit("screen-offer", { from: socket.id, name: myName, sdp });
  });
  socket.on("screen-answer", ({ to, sdp }) => {
    io.to(to).emit("screen-answer", { from: socket.id, sdp });
  });
  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });
  socket.on("screen-start", () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("screen-start", { from: socket.id, name: myName });
  });
  socket.on("screen-stop", () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("screen-stop", { from: socket.id });
  });

  // --- Keluar ---
  socket.on("disconnect", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.users.delete(socket.id);
      // Bersihkan vote reset skor milik socket ini
      if (resetVotes[currentRoom]) resetVotes[currentRoom].delete(socket.id);
      io.to(currentRoom).emit("user-left", { id: socket.id, name: myName });
      io.to(currentRoom).emit(
        "users",
        Array.from(room.users, ([id, n]) => ({ id, name: n }))
      );
      emitRoomChat(currentRoom, { system: true, text: `${myName} keluar dari ruangan 🥺`, ts: Date.now() });
      if (room.users.size === 0) {
        if (roomActiveSince[currentRoom]) {
          roomSeconds[currentRoom] = (roomSeconds[currentRoom] || 0) + (Date.now() - roomActiveSince[currentRoom]) / 1000;
          roomActiveSince[currentRoom] = null;
          saveDurations();
        }
        delete resetVotes[currentRoom];
        rooms.delete(currentRoom);
      }
    }
    // Keluarkan dari antrian matchmaking jika disconnect
    removeFromQueue(socket.id);
  });

  // ----------------------------------------------------------
  //  MATCHMAKING — cari pacar online
  // ----------------------------------------------------------
  socket.on("match-join", ({ name }) => {
    removeFromQueue(socket.id); // cegah duplikat
    const cleanName = (name || "Anonim").trim().slice(0, 24) || "Anonim";

    if (matchQueue.length > 0) {
      // Ada yang menunggu → cocokkan!
      const partner = matchQueue.shift();
      const roomId = makeRoomId();
      socket.emit("match-found", { roomId, partnerName: partner.name });
      io.to(partner.id).emit("match-found", { roomId, partnerName: cleanName });
      broadcastQueueCount();
    } else {
      // Masuk antrian
      matchQueue.push({ id: socket.id, name: cleanName, joinedAt: Date.now() });
      broadcastQueueCount();
      socket.emit("match-waiting", { count: matchQueue.length });
    }
  });

  socket.on("match-cancel", () => {
    removeFromQueue(socket.id);
    socket.emit("match-cancelled");
  });

  // ── GLOBAL CHAT ──
  let gcName = null;

  socket.on("gc-join", ({ name }) => {
    gcName = (name || "Anonim").trim().slice(0, 24) || "Anonim";
    socket.join(GLOBAL_ROOM);
    globalOnline++;
    // Kirim riwayat pesan ke yang baru masuk
    socket.emit("gc-history", globalMessages);
    // Beritahu jumlah online
    io.to(GLOBAL_ROOM).emit("gc-online", globalOnline);
    // Pesan sistem
    const msg = { system: true, text: `${gcName} bergabung 👋`, ts: Date.now() };
    io.to(GLOBAL_ROOM).emit("gc-msg", msg);
    globalMessages.push(msg);
    if (globalMessages.length > 100) globalMessages.shift();
  });

  socket.on("gc-chat", ({ text }) => {
    if (!gcName || !text) return;
    const clean = String(text).trim().slice(0, 300);
    if (!clean) return;
    const msg = { id: socket.id, name: gcName, text: clean, ts: Date.now() };
    io.to(GLOBAL_ROOM).emit("gc-msg", msg);
    globalMessages.push(msg);
    if (globalMessages.length > 100) globalMessages.shift();
  });

  socket.on("disconnecting", () => {
    if (socket.rooms.has(GLOBAL_ROOM) && gcName) {
      globalOnline = Math.max(0, globalOnline - 1);
      const msg = { system: true, text: `${gcName} meninggalkan chat 🌸`, ts: Date.now() };
      io.to(GLOBAL_ROOM).emit("gc-msg", msg);
      io.to(GLOBAL_ROOM).emit("gc-online", globalOnline);
      globalMessages.push(msg);
      if (globalMessages.length > 100) globalMessages.shift();
    }
  });

  // Skip: beri tahu pasangan di room bahwa kita pergi mencari yang lain
  socket.on("match-skip", () => {
    if (currentRoom) socket.to(currentRoom).emit("partner-skipped", { name: myName });
  });

  // Kirim jumlah pencari ke socket yang baru connect (untuk landing page)
  socket.emit("match-online-count", matchQueue.length);
});

server.listen(PORT, () => {
  console.log("\n💕  Website Pacaran berjalan!");
  console.log(`💻  Buka di komputer ini : http://localhost:${PORT}`);
  console.log(`📱  Buka di HP/jaringan  : http://<IP-komputer>:${PORT}`);
  console.log("    (cek IP dengan perintah: ipconfig)\n");
});
