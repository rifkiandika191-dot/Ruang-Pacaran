// ============================================================
//  Room — nonton bareng, share screen, chat
// ============================================================

const params = new URLSearchParams(location.search);
const ROOM = (params.get("room") || "").toUpperCase();
const NAME = params.get("name") || "Sayang";

if (!ROOM) location.href = "/";

const socket = io();
let myId = null;
let otherUsers = []; // user lain (selain aku)

// Elemen
const el = (id) => document.getElementById(id);
const roomCodeEl = el("roomCode");
const usersPill = el("usersPill");
const chatList = el("chatList");
const placeholder = el("placeholder");
const ytDiv = el("ytPlayer");
const htmlPlayer = el("htmlPlayer");
const screenPlayer = el("screenPlayer");
const syncNote = el("syncNote");

roomCodeEl.textContent = ROOM;

// ------------------------------------------------------------
//  Toast helper
// ------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ------------------------------------------------------------
//  Durasi selama di room
// ------------------------------------------------------------
// Durasi total room (akumulasi dari server, lanjut walau sempat keluar)
let durBase = 0;          // detik akumulasi dari server
let durFrom = Date.now(); // patokan waktu lokal
function updateRoomDuration() {
  const s = Math.floor(durBase + (Date.now() - durFrom) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  el("roomDuration").textContent = "⏱️ " + (h > 0 ? pad(h) + ":" : "") + pad(m) + ":" + pad(sec);
}
updateRoomDuration();
setInterval(updateRoomDuration, 1000);

// ------------------------------------------------------------
//  Gabung room
// ------------------------------------------------------------
socket.emit("join", { roomId: ROOM, name: NAME });

socket.on("joined", ({ you, users, videoState, durationSeconds, streak, chatHistory }) => {
  myId = you.id;
  updateUsers(users);
  if (typeof durationSeconds === "number") { durBase = durationSeconds; durFrom = Date.now(); }
  if (videoState && videoState.url) {
    applySource(videoState.url, videoState.type, false);
  }
  if (streak) applyStreak(streak);
  saveRoomHistory(); // simpan entry awal
  // Muat riwayat chat dari sesi sebelumnya
  if (chatHistory && chatHistory.length > 0) {
    const sep = document.createElement("div");
    sep.className = "msg system chat-history-sep";
    sep.textContent = "─── Riwayat sebelumnya ───";
    chatList.appendChild(sep);
    chatHistory.forEach((m) => {
      if (m.system) { addMsg({ system: true, text: m.text }); return; }
      addMsg({ name: m.name, text: m.text, mine: m.name === NAME, isHistory: true });
    });
    chatList.scrollTop = chatList.scrollHeight;
  }
});

socket.on("users", updateUsers);
function updateUsers(users) {
  otherUsers = users.filter((u) => u.id !== myId);
  usersPill.textContent = "👥 " + users.length;
}

// ------------------------------------------------------------
//  CHAT
// ------------------------------------------------------------
function addMsg({ name, text, img, audio, mine, system }) {
  const d = document.createElement("div");
  if (system) {
    d.className = "msg system";
    d.textContent = text;
  } else {
    d.className = "msg " + (mine ? "me" : "them");
    let inner = `<span class="who">${escapeHtml(mine ? "Kamu" : name)}</span>`;
    if (text) inner += escapeHtml(text);
    if (img) {
      const imgEl = document.createElement("img");
      imgEl.src = img;
      imgEl.className = "chat-img";
      imgEl.loading = "lazy";
      imgEl.addEventListener("click", () => window.open(img, "_blank"));
      d.className += " msg-img";
      d.innerHTML = inner;
      d.appendChild(imgEl);
      chatList.appendChild(d);
      chatList.scrollTop = chatList.scrollHeight;
      return;
    }
    if (audio) {
      const audioEl = document.createElement("audio");
      audioEl.controls = true;
      audioEl.preload = "metadata";
      audioEl.className = "chat-audio";
      // Gunakan <source> agar browser bisa pilih format yang didukung
      const src = document.createElement("source");
      src.src = audio;
      audioEl.appendChild(src);
      d.className += " msg-audio";
      d.innerHTML = inner;
      d.appendChild(audioEl);
      chatList.appendChild(d);
      chatList.scrollTop = chatList.scrollHeight;
      return;
    }
    d.innerHTML = inner;
  }
  chatList.appendChild(d);
  chatList.scrollTop = chatList.scrollHeight;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

socket.on("chat", (m) => {
  if (m.system) return addMsg({ system: true, text: m.text });
  addMsg({ name: m.name, text: m.text, img: m.img, audio: m.audio, mine: m.id === myId });
});

function sendChat() {
  const inp = el("chatText");
  const text = inp.value.trim();
  if (!text) return;
  socket.emit("chat", { text });
  inp.value = "";
  stopTyping();
}
el("sendBtn").addEventListener("click", sendChat);
el("chatText").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
document.querySelectorAll(".emoji-quick button").forEach((b) => {
  b.addEventListener("click", () => { el("chatText").value += b.textContent; el("chatText").focus(); });
});

// --- Kirim gambar ---
el("imgInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2_000_000) { toast("Gambar terlalu besar (maks 2MB) 🥺"); e.target.value = ""; return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    socket.emit("chat", { img: ev.target.result });
    e.target.value = "";
  };
  reader.readAsDataURL(file);
});

// --- Typing indicator ---
let typingTimeout = null;
function sendTyping() {
  socket.emit("typing", { on: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 2500);
}
function stopTyping() {
  clearTimeout(typingTimeout);
  typingTimeout = null;
  socket.emit("typing", { on: false });
}
el("chatText").addEventListener("input", () => { if (el("chatText").value) sendTyping(); else stopTyping(); });

let partnerTypingTimer = null;
socket.on("typing", ({ name, on }) => {
  const ind = el("typingIndicator");
  if (on) {
    el("typingName").textContent = name;
    ind.classList.remove("hidden");
    clearTimeout(partnerTypingTimer);
    partnerTypingTimer = setTimeout(() => ind.classList.add("hidden"), 3000);
    chatList.scrollTop = chatList.scrollHeight;
  } else {
    ind.classList.add("hidden");
    clearTimeout(partnerTypingTimer);
  }
});

// ------------------------------------------------------------
//  Salin link undangan
// ------------------------------------------------------------
el("copyLinkBtn").addEventListener("click", async () => {
  const url = `${location.origin}/room?room=${ROOM}`;
  try {
    await navigator.clipboard.writeText(url);
    toast("Link undangan disalin! Kirim ke pasanganmu 💌");
  } catch {
    prompt("Salin link ini:", url);
  }
});

// ------------------------------------------------------------
//  TAB sumber (link / screen)
// ------------------------------------------------------------
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const mode = tab.dataset.mode;
    el("panel-link").classList.toggle("hidden", mode !== "link");
    el("panel-screen").classList.toggle("hidden", mode !== "screen");
  });
});

// ============================================================
//  PEMUTAR VIDEO (link)
// ============================================================
let ytPlayer = null;
let ytReady = false;
let currentType = null;
let suppressEvents = false; // cegah loop saat menerapkan kontrol dari pasangan
let syncTimer = null;

// --- Deteksi tipe dari URL ---
function detectSource(url) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { type: "youtube", id: yt[1], url };
  return { type: "html", url };
}

el("loadVideoBtn").addEventListener("click", () => {
  const url = el("videoUrl").value.trim();
  if (!url) return;
  const src = detectSource(url);
  socket.emit("video-source", { url: src.url, type: src.type });
  applySource(src.url, src.type, true);
});
el("videoUrl").addEventListener("keydown", (e) => { if (e.key === "Enter") el("loadVideoBtn").click(); });

socket.on("video-source", ({ url, type }) => applySource(url, type, false));

// --- Stop nonton bareng (bersihkan video, kembali ke placeholder) ---
function stopWatching(mine) {
  stopSyncLoop();
  try { if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo(); } catch (e) {}
  try { htmlPlayer.pause(); htmlPlayer.removeAttribute("src"); htmlPlayer.load(); } catch (e) {}
  currentType = null;
  ytDiv.classList.add("hidden");
  htmlPlayer.classList.add("hidden");
  el("stopWatchBtn").classList.add("hidden");
  syncNote.textContent = "";
  if (!isSharing) { screenPlayer.classList.add("hidden"); placeholder.classList.remove("hidden"); }
  if (mine) { socket.emit("video-stop"); toast("Berhenti nonton bareng ⏹️ — silakan pilih fitur lain 💕"); }
}
el("stopWatchBtn").addEventListener("click", () => stopWatching(true));
socket.on("video-stop", () => stopWatching(false));

function showPlayer(which) {
  placeholder.classList.add("hidden");
  ytDiv.classList.toggle("hidden", which !== "youtube");
  htmlPlayer.classList.toggle("hidden", which !== "html");
  screenPlayer.classList.toggle("hidden", which !== "screen");
}

function applySource(url, type, mine) {
  stopSyncLoop();
  currentType = type;
  if (type === "youtube") {
    const id = detectSource(url).id;
    showPlayer("youtube");
    loadYouTube(id);
  } else {
    showPlayer("html");
    htmlPlayer.src = url;
    htmlPlayer.load();
    bindHtmlPlayer();
  }
  el("stopWatchBtn").classList.remove("hidden"); // tampilkan tombol stop
  if (mine) toast("Video dimuat — nikmati nonton bareng! 🍿");
}

// ---------- YouTube ----------
function onYouTubeIframeAPIReady() { ytReady = true; }
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

function loadYouTube(videoId) {
  const create = () => {
    if (ytPlayer) {
      ytPlayer.loadVideoById(videoId);
      return;
    }
    ytPlayer = new YT.Player("ytPlayer", {
      videoId,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: () => startSyncLoop(),
        onStateChange: onYtState,
      },
    });
  };
  if (ytReady && window.YT && YT.Player) create();
  else {
    const wait = setInterval(() => {
      if (ytReady && window.YT && YT.Player) { clearInterval(wait); create(); }
    }, 200);
  }
}

function onYtState(e) {
  if (suppressEvents) return;
  if (e.data === YT.PlayerState.PLAYING) {
    socket.emit("video-control", { action: "play", time: ytPlayer.getCurrentTime() });
  } else if (e.data === YT.PlayerState.PAUSED) {
    socket.emit("video-control", { action: "pause", time: ytPlayer.getCurrentTime() });
  }
}

// ---------- HTML5 video ----------
let htmlBound = false;
function bindHtmlPlayer() {
  startSyncLoop();
  if (htmlBound) return;
  htmlBound = true;
  htmlPlayer.addEventListener("play", () => {
    if (suppressEvents) return;
    socket.emit("video-control", { action: "play", time: htmlPlayer.currentTime });
  });
  htmlPlayer.addEventListener("pause", () => {
    if (suppressEvents) return;
    socket.emit("video-control", { action: "pause", time: htmlPlayer.currentTime });
  });
  htmlPlayer.addEventListener("seeked", () => {
    if (suppressEvents) return;
    socket.emit("video-control", { action: "seek", time: htmlPlayer.currentTime });
  });
}

// ------------------------------------------------------------
//  Terima kontrol dari pasangan
// ------------------------------------------------------------
socket.on("video-control", ({ action, time, by }) => {
  suppressEvents = true;
  try {
    if (currentType === "youtube" && ytPlayer && ytPlayer.seekTo) {
      if (typeof time === "number") ytPlayer.seekTo(time, true);
      if (action === "play") ytPlayer.playVideo();
      if (action === "pause") ytPlayer.pauseVideo();
    } else if (currentType === "html") {
      if (typeof time === "number") {
        if (action === "seek" || Math.abs(htmlPlayer.currentTime - time) > 0.4) htmlPlayer.currentTime = time;
      }
      if (action === "play") htmlPlayer.play();
      if (action === "pause") htmlPlayer.pause();
    }
    if (action === "play") syncNote.textContent = `▶️ ${by} memutar`;
    if (action === "pause") syncNote.textContent = `⏸️ ${by} menjeda`;
    if (action === "seek") syncNote.textContent = `⏩ ${by} memindahkan waktu`;
  } catch (e) { /* ignore */ }
  setTimeout(() => { suppressEvents = false; }, 350);
});

// ------------------------------------------------------------
//  Loop sinkronisasi waktu (auto-correct drift)
// ------------------------------------------------------------
function startSyncLoop() {
  stopSyncLoop();
  syncTimer = setInterval(() => {
    let time = null, playing = false;
    if (currentType === "youtube" && ytPlayer && ytPlayer.getCurrentTime) {
      time = ytPlayer.getCurrentTime();
      playing = ytPlayer.getPlayerState && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING;
    } else if (currentType === "html" && !htmlPlayer.paused) {
      time = htmlPlayer.currentTime;
      playing = true;
    }
    if (time !== null) socket.emit("video-sync", { time, playing });
  }, 4000);
}
function stopSyncLoop() { if (syncTimer) clearInterval(syncTimer); syncTimer = null; }

socket.on("video-sync", ({ time, playing }) => {
  if (typeof time !== "number") return;
  suppressEvents = true;
  try {
    if (currentType === "youtube" && ytPlayer && ytPlayer.getCurrentTime) {
      if (Math.abs(ytPlayer.getCurrentTime() - time) > 1.5) ytPlayer.seekTo(time, true);
    } else if (currentType === "html") {
      if (Math.abs(htmlPlayer.currentTime - time) > 1.5) htmlPlayer.currentTime = time;
    }
  } catch (e) {}
  setTimeout(() => { suppressEvents = false; }, 300);
});

// ============================================================
//  SHARE SCREEN (WebRTC)
// ============================================================
const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // TURN relay gratis (Open Relay by Metered) — agar panggilan tetap nyambung
    // walau beda jaringan / di balik NAT ketat / pakai data seluler
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ],
  iceCandidatePoolSize: 10,
};
const peers = new Map(); // peerId -> RTCPeerConnection
let localScreenStream = null;
let isSharing = false;

const shareBtn = el("shareScreenBtn");
const stopBtn = el("stopScreenBtn");

// Apakah browser ini mendukung share layar? (HP umumnya TIDAK)
const screenShareSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

// Beri tahu di awal kalau perangkat tidak mendukung (mis. HP)
if (!screenShareSupported) {
  const hint = document.querySelector("#panel-screen .hint");
  if (hint) hint.textContent = "⚠️ Share layar hanya bisa di laptop/PC. Di HP, pakai 📞 Video Call untuk arahkan kamera ke layar.";
  shareBtn.textContent = "🖥️ Share Layar (hanya di laptop/PC)";
}

shareBtn.addEventListener("click", startScreenShare);
stopBtn.addEventListener("click", stopScreenShare);

async function startScreenShare() {
  // HP (iOS Safari & kebanyakan Android) tidak punya API share layar
  if (!screenShareSupported) {
    popupNotif("🖥️", "Share layar tak didukung di HP", "Browser HP belum bisa membagikan layar. Pakai laptop/PC, atau gunakan 📞 Video Call untuk mengarahkan kamera ke layar 💕");
    toast("Share layar tidak didukung di browser HP 🥺");
    return;
  }
  try {
    localScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  } catch (e) {
    const name = e && e.name;
    if (name === "NotAllowedError" || name === "AbortError") {
      toast("Berbagi layar dibatalkan.");
    } else {
      // NotSupportedError / NotFoundError / NotReadableError → umumnya di HP
      popupNotif("🖥️", "Tidak bisa share layar", "Perangkat/browser ini tampaknya tidak mendukung share layar. Coba laptop/PC, atau pakai 📞 Video Call 💕");
      toast("Perangkat ini tidak mendukung share layar 🥺");
    }
    return;
  }
  if (!localScreenStream || localScreenStream.getVideoTracks().length === 0) {
    toast("Tidak ada layar yang dibagikan.");
    return;
  }
  isSharing = true;
  shareBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");

  // Tampilkan preview ke diri sendiri
  showPlayer("screen");
  screenPlayer.srcObject = localScreenStream;
  screenPlayer.muted = true;

  // Berhenti otomatis kalau user klik "Stop sharing" dari browser
  localScreenStream.getVideoTracks()[0].onended = stopScreenShare;

  socket.emit("screen-start");
  // Buat koneksi & kirim offer ke tiap user lain
  for (const u of otherUsers) await createOfferTo(u.id);
  toast("Layarmu sedang dibagikan 🖥️💕");
}

function stopScreenShare() {
  if (localScreenStream) localScreenStream.getTracks().forEach((t) => t.stop());
  localScreenStream = null;
  isSharing = false;
  shareBtn.classList.remove("hidden");
  stopBtn.classList.add("hidden");
  peers.forEach((info) => { try { info.pc.close(); } catch (e) {} });
  peers.clear();
  socket.emit("screen-stop");
  screenPlayer.srcObject = null;
  showPlaceholderIfEmpty();
}

function showPlaceholderIfEmpty() {
  screenPlayer.classList.add("hidden");
  if (!currentType) placeholder.classList.remove("hidden");
  else if (currentType === "youtube") showPlayer("youtube");
  else showPlayer("html");
}

function newPeer(peerId) {
  const pc = new RTCPeerConnection(ICE);
  const info = { pc, pending: [] };
  peers.set(peerId, info);
  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit("ice-candidate", { to: peerId, candidate: e.candidate });
  };
  pc.ontrack = (e) => {
    // Aku menerima layar pasangan
    showPlayer("screen");
    screenPlayer.srcObject = e.streams[0];
    screenPlayer.muted = false;
    syncNote.textContent = "🖥️ Menonton layar pasanganmu";
    // Hentikan audio video lokal agar tidak menumpuk dengan layar pasangan
    try { if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); } catch (e2) {}
    try { htmlPlayer.pause(); } catch (e2) {}
  };
  return info;
}

async function flushScreenCandidates(info) {
  const list = info.pending; info.pending = [];
  for (const c of list) { try { await info.pc.addIceCandidate(c); } catch (e) {} }
}

async function createOfferTo(peerId) {
  const info = newPeer(peerId);
  if (localScreenStream) localScreenStream.getTracks().forEach((t) => info.pc.addTrack(t, localScreenStream));
  const offer = await info.pc.createOffer();
  await info.pc.setLocalDescription(offer);
  socket.emit("screen-offer", { to: peerId, sdp: offer });
}

// Saat pasangan mulai share, aku siap menerima (offer datang dari dia)
socket.on("screen-start", ({ name }) => {
  toast(`${name} membagikan layarnya 🖥️`);
});

socket.on("screen-offer", async ({ from, sdp }) => {
  let info = peers.get(from);
  if (!info) info = newPeer(from);
  // Kalau aku juga sedang share, kirim track-ku juga (dua arah opsional)
  if (localScreenStream) localScreenStream.getTracks().forEach((t) => info.pc.addTrack(t, localScreenStream));
  await info.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  await flushScreenCandidates(info);
  const answer = await info.pc.createAnswer();
  await info.pc.setLocalDescription(answer);
  socket.emit("screen-answer", { to: from, sdp: answer });
});

socket.on("screen-answer", async ({ from, sdp }) => {
  const info = peers.get(from);
  if (info) { await info.pc.setRemoteDescription(new RTCSessionDescription(sdp)); await flushScreenCandidates(info); }
});

socket.on("ice-candidate", async ({ from, candidate }) => {
  const info = peers.get(from);
  if (!info || !candidate) return;
  // Kandidat bisa tiba sebelum remoteDescription siap → tampung dulu
  if (info.pc.remoteDescription && info.pc.remoteDescription.type) {
    try { await info.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
  } else {
    info.pending.push(new RTCIceCandidate(candidate));
  }
});

socket.on("screen-stop", ({ from }) => {
  const info = peers.get(from);
  if (info) { info.pc.close(); peers.delete(from); }
  if (!isSharing) { screenPlayer.srcObject = null; showPlaceholderIfEmpty(); }
  syncNote.textContent = "";
  toast("Berbagi layar dihentikan.");
});

// Kalau ada user baru masuk saat aku sedang share → kirim offer ke dia
socket.on("user-joined", async ({ id, name }) => {
  if (isSharing) await createOfferTo(id);
});

// Bersihkan koneksi milik pasangan yang KELUAR / tutup tab (disconnect)
socket.on("user-left", ({ id }) => {
  const sp = peers.get(id);
  if (sp) { try { sp.pc.close(); } catch (e) {} peers.delete(id); }
  if (!isSharing) { screenPlayer.srcObject = null; showPlaceholderIfEmpty(); }
  const cp = callPeers.get(id);
  if (cp) {
    try { cp.pc.close(); } catch (e) {}
    callPeers.delete(id);
    remoteCam.srcObject = null;
    setRemoteVideo(false);
    el("remoteMicIco").textContent = "🎤";
  }
});

// ============================================================
//  DARK MODE
// ============================================================
const themeBtn = el("themeBtn");
function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  themeBtn.textContent = dark ? "☀️" : "🌙";
  localStorage.setItem("pacaran_theme", dark ? "dark" : "light");
}
applyTheme(localStorage.getItem("pacaran_theme") === "dark");
themeBtn.addEventListener("click", () => applyTheme(!document.body.classList.contains("dark")));

// ============================================================
//  REAKSI CINTA (hati melayang)
// ============================================================
const reactionLayer = el("reactionLayer");
function spawnReaction(emoji) {
  const e = document.createElement("div");
  e.className = "float-react";
  e.textContent = emoji;
  e.style.left = 10 + Math.random() * 80 + "%";
  reactionLayer.appendChild(e);
  setTimeout(() => e.remove(), 2500);
}
document.querySelectorAll(".react-buttons button").forEach((b) => {
  b.addEventListener("click", () => {
    const emoji = b.dataset.emoji;
    spawnReaction(emoji);
    socket.emit("reaction", { emoji });
  });
});
socket.on("reaction", ({ emoji }) => spawnReaction(emoji));

// ============================================================
//  SETELAN PASANGAN + COUNTDOWN
// ============================================================
const settingsModal = el("settingsModal");
function loadCouple() {
  return JSON.parse(localStorage.getItem("pacaran_couple") || "{}");
}
function saveCouple(c) { localStorage.setItem("pacaran_couple", JSON.stringify(c)); }

function applyCouple(c) {
  if (c.name1 && c.name2) {
    el("brandText").textContent = `${c.name1} 💕 ${c.name2}`;
  }
  updateCountdown(c.date);
}
function updateCountdown(date) {
  const cd = el("countdown");
  if (!date) { cd.textContent = ""; return; }
  const target = new Date(date + "T00:00:00");
  const now = new Date();
  const diff = Math.ceil((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  if (diff > 0) cd.textContent = `💖 ${diff} hari lagi menuju hari spesial`;
  else if (diff === 0) cd.textContent = `🎉 Hari ini hari spesial kalian!`;
  else cd.textContent = `💞 Sudah ${Math.abs(diff)} hari bersama`;
}

el("settingsBtn").addEventListener("click", () => {
  const c = loadCouple();
  el("setName1").value = c.name1 || NAME;
  el("setName2").value = c.name2 || "";
  el("setDate").value = c.date || "";
  settingsModal.classList.remove("hidden");
});
el("settingsClose").addEventListener("click", () => settingsModal.classList.add("hidden"));
el("settingsSave").addEventListener("click", () => {
  const c = { name1: el("setName1").value.trim(), name2: el("setName2").value.trim(), date: el("setDate").value };
  saveCouple(c);
  applyCouple(c);
  // bagikan ke pasangan juga (sinkron tampilan)
  socket.emit("couple-info", c);
  settingsModal.classList.add("hidden");
  toast("Setelan tersimpan 💖");
});
settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) settingsModal.classList.add("hidden"); });
// couple-info handler dipindah ke bagian LOKASI di bawah (supaya bisa proses data lokasi juga)
applyCouple(loadCouple());
// refresh countdown tiap menit
setInterval(() => updateCountdown(loadCouple().date), 60000);

// ============================================================
//  PANGGILAN — Mic & Kamera DIKONTROL MASING-MASING (independen)
//  Tiap orang bebas nyalakan/matikan mic & kamera sendiri.
//  Pakai "perfect negotiation": addTrack/removeTrack memicu
//  negosiasi ulang otomatis & aman dari tabrakan (glare).
// ============================================================
const localCam = el("localCam");
const remoteCam = el("remoteCam");
const callPeers = new Map();
let inCall = false;
let micOn = false;
let camOn = false;
let remoteVideoOn = false;
let localAudioTrack = null;
let localVideoTrack = null;
let camFacing = "user";

el("joinCallBtn").addEventListener("click", joinCall);
el("endCallBtn").addEventListener("click", endCall);
el("micBtn").addEventListener("click", () => setMic(!micOn));
el("camToggleBtn").addEventListener("click", () => setCam(!camOn));
el("flipCamBtn").addEventListener("click", flipCam);

// Berapa kamera aktif sekarang (lokal + remote)
function activeCamCount() { return (camOn ? 1 : 0) + (remoteVideoOn ? 1 : 0); }
function refreshCamPanel() {
  const n = activeCamCount();
  const panel = el("camPanel");
  if (n > 0) {
    panel.classList.remove("hidden"); panel.classList.add("show");
  } else {
    panel.classList.remove("show");
    setTimeout(() => { if (!activeCamCount()) panel.classList.add("hidden"); }, 350);
  }
  el("camPanelCount").textContent = n + " kamera";
  el("localTile").classList.toggle("hidden", !camOn);
  el("remoteTile").classList.toggle("hidden", !remoteVideoOn);
}

function showCallUI() {
  el("joinCallBtn").classList.add("hidden");
  el("endCallBtn").classList.remove("hidden");
  el("micBtn").classList.remove("hidden");
  el("camToggleBtn").classList.remove("hidden");
  el("callStatus").classList.remove("hidden");
  setCallStatus("📞 Menghubungkan...");
  refreshLocalTile();
}
function hideCallUI() {
  el("joinCallBtn").classList.remove("hidden");
  el("endCallBtn").classList.add("hidden");
  el("micBtn").classList.add("hidden");
  el("camToggleBtn").classList.add("hidden");
  el("flipCamBtn").classList.add("hidden");
  el("callStatus").classList.add("hidden");
  camOn = false; remoteVideoOn = false;
  refreshCamPanel();
}
function refreshLocalTile() {
  el("micBtn").textContent = micOn ? "🎤 Mic: Nyala" : "🔇 Mic: Mati";
  el("micBtn").classList.toggle("active", micOn);
  el("camToggleBtn").textContent = camOn ? "📷 Kamera: Nyala" : "📷 Kamera: Mati";
  el("camToggleBtn").classList.toggle("active", camOn);
  el("flipCamBtn").classList.toggle("hidden", !camOn);
  el("localOff").classList.toggle("hidden", camOn);
  localCam.classList.toggle("hidden", !camOn);
  el("localMicBadge").textContent = micOn ? "🎤" : "🔇";
  refreshCamPanel();
}

// --- Balik kamera depan/belakang ---
async function flipCam() {
  if (!camOn) { toast("Nyalakan kamera dulu 📷"); return; }
  camFacing = camFacing === "user" ? "environment" : "user";
  let s;
  try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing } } }); }
  catch (e) {
    try { s = await navigator.mediaDevices.getUserMedia({ video: true }); }
    catch (e2) { toast("Tidak bisa ganti kamera 🥺"); camFacing = camFacing === "user" ? "environment" : "user"; return; }
  }
  const newTrack = s.getVideoTracks()[0];
  callPeers.forEach((info) => {
    const sender = info.pc.getSenders().find((se) => se.track && se.track.kind === "video");
    if (sender) sender.replaceTrack(newTrack);
  });
  if (localVideoTrack) localVideoTrack.stop();
  localVideoTrack = newTrack;
  localCam.srcObject = new MediaStream([newTrack]);
  const p = localCam.play(); if (p && p.catch) p.catch(() => {});
  toast(camFacing === "user" ? "Kamera depan 🤳" : "Kamera belakang 📷");
}
function setRemoteVideo(on) {
  remoteVideoOn = on;
  el("remoteOff").classList.toggle("hidden", on);
  remoteCam.classList.toggle("hidden", !on);
  // Update nama pasangan dari daftar user
  const partner = otherUsers[0];
  if (partner) el("remoteName").textContent = partner.name;
  refreshCamPanel();
}

// --- Toggle MIC milikku sendiri ---
async function setMic(on) {
  if (on) {
    if (!localAudioTrack) {
      try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); localAudioTrack = s.getAudioTracks()[0]; }
      catch (e) { toast("Tidak bisa akses mikrofon 🥺 (izinkan akses)"); return; }
    }
    callPeers.forEach((info) => {
      if (!info.pc.getSenders().some((s) => s.track === localAudioTrack)) info.pc.addTrack(localAudioTrack);
    });
    micOn = true;
  } else {
    callPeers.forEach((info) => {
      info.pc.getSenders().forEach((s) => { if (s.track && s.track.kind === "audio") { try { info.pc.removeTrack(s); } catch (e) {} } });
    });
    if (localAudioTrack) { localAudioTrack.stop(); localAudioTrack = null; }
    micOn = false;
  }
  refreshLocalTile();
  socket.emit("call-media", { mic: micOn, cam: camOn });
}

// --- Toggle KAMERA milikku sendiri ---
async function setCam(on) {
  if (on) {
    if (!localVideoTrack) {
      try {
        let s;
        try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing } } }); }
        catch (e1) { s = await navigator.mediaDevices.getUserMedia({ video: true }); }
        localVideoTrack = s.getVideoTracks()[0];
      }
      catch (e) { toast("Tidak bisa akses kamera 🥺 (izinkan akses)"); return; }
    }
    callPeers.forEach((info) => {
      if (!info.pc.getSenders().some((s) => s.track === localVideoTrack)) info.pc.addTrack(localVideoTrack);
    });
    localCam.srcObject = new MediaStream([localVideoTrack]);
    const p = localCam.play(); if (p && p.catch) p.catch(() => {});
    camOn = true;
  } else {
    callPeers.forEach((info) => {
      info.pc.getSenders().forEach((s) => { if (s.track && s.track.kind === "video") { try { info.pc.removeTrack(s); } catch (e) {} } });
    });
    if (localVideoTrack) { localVideoTrack.stop(); localVideoTrack = null; }
    localCam.srcObject = null;
    camOn = false;
  }
  refreshLocalTile();
  socket.emit("call-media", { mic: micOn, cam: camOn });
}

async function joinCall() {
  if (inCall) return;
  inCall = true;
  showCallUI();
  socket.emit("call-start");
  // buat koneksi ke semua yang sudah di ruangan
  for (const u of otherUsers) createPeer(u.id);
  // default: nyalakan mic-ku (di balik klik tombol = ada izin gesture)
  await setMic(true);
  toast("Kamu gabung panggilan 📞 — atur 🎤 mic & 📷 kamera sesukamu");
}

function endCall() {
  if (localAudioTrack) localAudioTrack.stop();
  if (localVideoTrack) localVideoTrack.stop();
  localAudioTrack = localVideoTrack = null;
  micOn = camOn = false;
  inCall = false;
  callPeers.forEach((p) => p.pc.close());
  callPeers.clear();
  localCam.srcObject = null;
  remoteCam.srcObject = null;
  setRemoteVideo(false);
  el("remoteMicIco").textContent = "🎤";
  hideCallUI();
  socket.emit("call-stop");
}

function setCallStatus(txt) { el("callStatus").textContent = txt; }

// Buat koneksi peer dengan pola perfect negotiation
function createPeer(peerId) {
  if (callPeers.has(peerId)) return callPeers.get(peerId);
  const pc = new RTCPeerConnection(ICE);
  const info = {
    pc, makingOffer: false, ignoreOffer: false, isSettingRemote: false,
    polite: String(myId) > String(peerId), remoteStream: new MediaStream(),
    pendingCandidates: [], restartTries: 0,
  };
  callPeers.set(peerId, info);

  pc.onnegotiationneeded = async () => {
    try {
      info.makingOffer = true;
      await pc.setLocalDescription();
      socket.emit("call-signal", { to: peerId, description: pc.localDescription });
    } catch (e) { console.warn("negotiation error", e); } finally { info.makingOffer = false; }
  };
  pc.onicecandidate = (e) => { if (e.candidate) socket.emit("call-signal", { to: peerId, candidate: e.candidate }); };
  pc.ontrack = (e) => {
    info.remoteStream.addTrack(e.track);
    remoteCam.srcObject = info.remoteStream;
    const p = remoteCam.play(); if (p && p.catch) p.catch(() => {});
    if (e.track.kind === "video") {
      e.track.onunmute = () => setRemoteVideo(true);
      e.track.onmute = () => setRemoteVideo(false);
      e.track.onended = () => setRemoteVideo(false);
      setRemoteVideo(!e.track.muted);
    }
  };
  pc.oniceconnectionstatechange = () => {
    const st = pc.iceConnectionState;
    if (st === "checking") setCallStatus("📞 Menghubungkan...");
    else if (st === "connected" || st === "completed") { setCallStatus("📞 Tersambung"); info.restartTries = 0; }
    else if (st === "disconnected") setCallStatus("📞 Sambungan terputus, mencoba ulang...");
    else if (st === "failed") setCallStatus("📞 Gagal — mencoba sambung ulang...");
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") {
      // Coba pulihkan: restart ICE (maks 3x)
      if (info.restartTries < 3) {
        info.restartTries++;
        // restartIce() otomatis memicu onnegotiationneeded → offer baru dgn iceRestart
        try { pc.restartIce(); } catch (e) {}
      } else {
        setCallStatus("📞 Gagal tersambung 🥺");
        popupNotif("📵", "Panggilan gagal tersambung", "Coba: matikan & nyalakan lagi mic/kamera, atau keluar lalu Gabung ulang.");
      }
    }
  };
  // Tambahkan track lokal yang sudah aktif ke peer baru ini
  if (localAudioTrack) pc.addTrack(localAudioTrack);
  if (localVideoTrack) pc.addTrack(localVideoTrack);
  return info;
}

async function flushCandidates(info) {
  const list = info.pendingCandidates;
  info.pendingCandidates = [];
  for (const c of list) { try { await info.pc.addIceCandidate(c); } catch (e) {} }
}

socket.on("call-start", ({ name }) =>
  popupNotif("📞", `${name} mengajak panggilan`, "Nyalakan 🎤 mic atau 📷 kamera kamu untuk gabung.")
);

// Satu kanal sinyal untuk semua (offer/answer/ICE) — perfect negotiation
socket.on("call-signal", async ({ from, description, candidate }) => {
  let info = callPeers.get(from);
  if (!info) {
    if (!inCall) { inCall = true; showCallUI(); }
    info = createPeer(from);
  }
  const pc = info.pc;
  try {
    if (description) {
      const offerCollision = description.type === "offer" && (info.makingOffer || pc.signalingState !== "stable");
      info.ignoreOffer = !info.polite && offerCollision;
      if (info.ignoreOffer) return;
      if (offerCollision) {
        // Polite: rollback eksplisit lalu terima offer pasangan (kompatibel lebih banyak browser)
        try {
          await Promise.all([
            pc.setLocalDescription({ type: "rollback" }).catch(() => {}),
            pc.setRemoteDescription(description),
          ]);
        } catch (e) { await pc.setRemoteDescription(description); }
      } else {
        await pc.setRemoteDescription(description);
      }
      await flushCandidates(info);
      if (description.type === "offer") {
        await pc.setLocalDescription();
        socket.emit("call-signal", { to: from, description: pc.localDescription });
        socket.emit("call-media", { mic: micOn, cam: camOn });
      }
    } else if (candidate) {
      // Kandidat bisa tiba sebelum remoteDescription siap → tampung dulu
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try { await pc.addIceCandidate(candidate); } catch (e) { if (!info.ignoreOffer) console.warn("ICE add error", e); }
      } else {
        info.pendingCandidates.push(candidate);
      }
    }
  } catch (e) { console.warn("call-signal error", e); }
});

socket.on("call-stop", ({ from }) => {
  const info = callPeers.get(from);
  if (info) { info.pc.close(); callPeers.delete(from); }
  remoteCam.srcObject = null;
  setRemoteVideo(false);
  el("remoteMicIco").textContent = "🎤";
  if (inCall) popupNotif("📵", "Pasangan keluar panggilan", "Kamu masih bisa lanjut atau keluar juga.");
});

// Status mic/kamera pasangan
socket.on("call-media", ({ mic, cam }) => {
  el("remoteMicIco").textContent = mic ? "🎤" : "🔇";
  if (!cam) setRemoteVideo(false);
});

// User baru masuk saat aku di panggilan → siapkan koneksi (kirim track aktif)
socket.on("user-joined", ({ id }) => {
  if (inCall) createPeer(id);
});

// ============================================================
//  POPUP NOTIFIKASI
// ============================================================
const popupEl = el("popupNotif");
let popupTimer;
function popupNotif(emoji, title, sub) {
  el("pnEmoji").textContent = emoji;
  el("pnTitle").textContent = title;
  el("pnSub").textContent = sub || "";
  popupEl.classList.add("show");
  clearTimeout(popupTimer);
  popupTimer = setTimeout(() => popupEl.classList.remove("show"), 4500);
  // Notifikasi browser bila tab tidak aktif
  try {
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body: sub || "", icon: "/favicon.ico" });
    }
  } catch (e) {}
}
popupEl.addEventListener("click", () => popupEl.classList.remove("show"));
// Minta izin notifikasi browser (sekali)
try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}

// Popup saat pasangan keluar (kangen dihandle fun.js yang juga play lonceng)
socket.on("user-left", ({ name }) => {
  popupNotif("🥺", `${name} keluar ruangan`, "Pasanganmu meninggalkan ruangan.");
});

// ============================================================
//  KELUAR DARI ROOM
// ============================================================
const leaveModal = el("leaveModal");
el("leaveBtn").addEventListener("click", () => leaveModal.classList.remove("hidden"));
el("leaveCancel").addEventListener("click", () => leaveModal.classList.add("hidden"));
leaveModal.addEventListener("click", (e) => { if (e.target === leaveModal) leaveModal.classList.add("hidden"); });
el("leaveConfirm").addEventListener("click", () => {
  cleanupBeforeLeave();
  try { socket.disconnect(); } catch (e) {}
  window.location.href = "/";
});
function cleanupBeforeLeave() {
  try { if (isSharing) stopScreenShare(); } catch (e) {}
  try { if (inCall) endCall(); } catch (e) {}
}

// ============================================================
//  SKIP — cari pasangan lain (khusus room dari "Cari Pacar Online")
// ============================================================
const IS_MATCH = params.get("match") === "1";
if (IS_MATCH) el("skipBtn").classList.remove("hidden");

el("skipBtn").addEventListener("click", () => {
  socket.emit("match-skip");          // beri tahu pasangan
  cleanupBeforeLeave();
  try { socket.disconnect(); } catch (e) {}
  // langsung ke pencarian & auto mulai cari lagi
  window.location.href = "/find?auto=1";
});

// Pasangan men-skip kita
const skippedModal = el("skippedModal");
socket.on("partner-skipped", ({ name }) => {
  el("skippedTitle").textContent = `${name || "Pasanganmu"} pergi…`;
  el("skippedText").textContent = "Dia pindah mencari yang lain. Mau cari pasangan baru juga?";
  skippedModal.classList.remove("hidden");
  try { popupNotif("🥺", `${name || "Pasangan"} pergi`, "Mencari yang lain…"); } catch (e) {}
});
el("skippedStay").addEventListener("click", () => skippedModal.classList.add("hidden"));
el("skippedFindNew").addEventListener("click", () => {
  cleanupBeforeLeave();
  try { socket.disconnect(); } catch (e) {}
  window.location.href = "/find?auto=1";
});

// ============================================================
//  LAYAR PENUH (FULLSCREEN)
// ============================================================
const playerWrap = document.querySelector(".player-wrap");
const fsBtn = el("fsBtn");

function isIOS() {
  return /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement);
}
function activeVideoEl() {
  if (!screenPlayer.classList.contains("hidden")) return screenPlayer;
  if (!htmlPlayer.classList.contains("hidden")) return htmlPlayer;
  return null;
}
function requestFs(elm) {
  if (!elm) return false;
  const fn = elm.requestFullscreen || elm.webkitRequestFullscreen || elm.webkitRequestFullScreen || elm.mozRequestFullScreen || elm.msRequestFullscreen;
  if (fn) { try { const r = fn.call(elm); if (r && r.catch) r.catch(() => {}); return true; } catch (e) {} }
  return false;
}
function exitFs() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (fn) { try { fn.call(document); } catch (e) {} }
}
async function lockLandscape() {
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape"); } catch (e) {}
}
async function toggleFullscreen() {
  if (isFullscreen()) { exitFs(); return; }
  const v = activeVideoEl();
  // iPhone/iPad: HANYA elemen <video> yang bisa fullscreen
  if (isIOS()) {
    if (v && v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); return; } catch (e) {} }
    if (v && requestFs(v)) { lockLandscape(); return; }
    toast("Di iPhone: putar video (.mp4) atau share screen untuk layar penuh; untuk YouTube pakai tombol ⛶ di pemutarnya 🙏");
    return;
  }
  // Desktop & Android: fullscreen kontainer (mencakup YouTube, video, & kamera)
  if (requestFs(playerWrap)) { lockLandscape(); return; }
  // Cadangan: langsung ke elemen video
  if (requestFs(v)) { lockLandscape(); return; }
  if (v && v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); return; } catch (e) {} }
  toast("Browser ini belum mendukung layar penuh di sini 🙏");
}
function updateFsIcon() {
  fsBtn.textContent = isFullscreen() ? "🗗" : "⛶";
  if (!isFullscreen()) { try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) {} }
}

fsBtn.addEventListener("click", toggleFullscreen);
// Klik 2x pada layar untuk fullscreen (abaikan klik pada tombol/kamera)
playerWrap.addEventListener("dblclick", (e) => {
  if (e.target.closest(".fs-btn")) return;
  toggleFullscreen();
});
// Tombol "F" untuk fullscreen (saat tidak sedang mengetik)
document.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    const t = document.activeElement;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    toggleFullscreen();
  }
});
document.addEventListener("fullscreenchange", updateFsIcon);
document.addEventListener("webkitfullscreenchange", updateFsIcon);
[htmlPlayer, screenPlayer].forEach((v) => {
  v.addEventListener("webkitbeginfullscreen", () => (fsBtn.textContent = "🗗"));
  v.addEventListener("webkitendfullscreen", () => (fsBtn.textContent = "⛶"));
});

window.addEventListener("beforeunload", () => {
  if (isSharing) stopScreenShare();
  if (inCall) endCall();
});

// ============================================================
//  STREAK HARIAN
// ============================================================
function applyStreak({ streak, longest }) {
  const badge = el("streakBadge");
  if (!streak || streak === 0) { badge.classList.add("hidden"); return; }
  badge.classList.remove("hidden");
  badge.textContent = `🔥 ${streak}`;
  badge.title = `Streak: ${streak} hari berturut-turut!\nTerpanjang: ${longest} hari`;
}
socket.on("streak", applyStreak);

// ============================================================
//  VOICE NOTE
// ============================================================
let mediaRecorderVoice = null;
let audioChunks = [];
let isRecordingVoice = false;

el("voiceBtn").addEventListener("click", () => {
  if (isRecordingVoice) stopVoiceRecording();
  else startVoiceRecording();
});

async function startVoiceRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast("Browser ini tidak mendukung rekaman suara 🥺");
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    toast("Tidak bisa akses mikrofon 🥺 — izinkan akses di browser");
    return;
  }
  audioChunks = [];

  // Cari MIME type yang didukung browser (iOS pakai mp4, desktop pakai webm)
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  const mimeType = candidates.find((t) => {
    try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
  }) || "";

  try {
    mediaRecorderVoice = new MediaRecorder(stream, mimeType ? { mimeType } : {});
  } catch (e) {
    mediaRecorderVoice = new MediaRecorder(stream); // fallback tanpa opsi
  }

  const actualMime = mediaRecorderVoice.mimeType || mimeType || "audio/webm";

  mediaRecorderVoice.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorderVoice.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    if (audioChunks.length === 0) { toast("Rekaman kosong 🥺"); return; }
    const blob = new Blob(audioChunks, { type: actualMime });
    if (blob.size === 0) { toast("Rekaman kosong 🥺"); return; }
    if (blob.size > 600_000) { toast("Rekaman terlalu panjang (maks ~30 detik) 🥺"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => socket.emit("chat", { audio: ev.target.result });
    reader.readAsDataURL(blob);
  };

  mediaRecorderVoice.start(250); // timeslice 250ms — pastikan data dikumpulkan bertahap
  isRecordingVoice = true;
  el("voiceBtn").classList.add("recording");
  el("voiceBtn").textContent = "⏹️";
  toast("Merekam... Tekan ⏹️ untuk kirim 🎙️");
}

function stopVoiceRecording() {
  if (mediaRecorderVoice && mediaRecorderVoice.state === "recording") mediaRecorderVoice.stop();
  isRecordingVoice = false;
  el("voiceBtn").classList.remove("recording");
  el("voiceBtn").textContent = "🎙️";
}

// ============================================================
//  LOKASI & WAKTU LOKAL
// ============================================================
let myGeo = null;      // { lat, lon, city, tz }
let partnerGeo = null; // { lat, lon, city, tz }
let locTimeTimer = null;

el("locationBtn").addEventListener("click", () => {
  const c = loadCouple();
  el("cityInput").value = c.myCity || "";
  el("locHint").textContent = "";
  el("locationModal").classList.remove("hidden");
  refreshLocationDisplay();
  // Auto-detect lokasi dari GPS perangkat (hanya jika belum diset)
  if (!c.myCity && navigator.geolocation) {
    el("locHint").textContent = "📡 Mendeteksi lokasi perangkatmu...";
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=id`,
            { headers: { "User-Agent": "RuangPacaran/1.0" } }
          );
          const data = await res.json();
          const city = data.address.city || data.address.town || data.address.county || data.address.state || "Lokasiku";
          el("cityInput").value = city;
          el("locHint").textContent = `📍 Terdeteksi: ${city} — tekan Simpan untuk bagikan`;
        } catch {
          el("locHint").textContent = "Deteksi otomatis gagal — isi nama kota manual.";
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          el("locHint").textContent = "Izin lokasi ditolak — isi nama kota manual di bawah.";
        } else {
          el("locHint").textContent = "Tidak bisa deteksi otomatis — isi nama kota manual.";
        }
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }
});
el("locationClose").addEventListener("click", () => el("locationModal").classList.add("hidden"));
el("locationModal").addEventListener("click", (e) => { if (e.target === el("locationModal")) el("locationModal").classList.add("hidden"); });

el("locationSave").addEventListener("click", async () => {
  const cityName = el("cityInput").value.trim();
  if (!cityName) { toast("Masukkan nama kota dulu 📍"); return; }
  el("locHint").textContent = "Mencari koordinat...";
  el("locationSave").disabled = true;
  try {
    const geo = await geocodeCity(cityName);
    if (!geo) { el("locHint").textContent = "Kota tidak ditemukan, coba nama lain."; el("locationSave").disabled = false; return; }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    myGeo = { lat: geo.lat, lon: geo.lon, city: cityName, tz };
    const c = loadCouple();
    c.myCity = cityName;
    c.myLat = geo.lat;
    c.myLon = geo.lon;
    c.myTz = tz;
    saveCouple(c);
    socket.emit("couple-info", c);
    el("locHint").textContent = `✅ Tersimpan: ${geo.display.split(",")[0]}`;
    refreshLocationDisplay();
    toast("Lokasi dibagikan ke pasangan 📍");
  } catch (e) {
    el("locHint").textContent = "Gagal mengambil data, periksa koneksi.";
  }
  el("locationSave").disabled = false;
});

async function geocodeCity(city) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "User-Agent": "RuangPacaran/1.0" } });
  const data = await res.json();
  if (!data || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name };
}

function getTzOffsetMins(tz) {
  try {
    const now = new Date();
    // Format tanggal+waktu di zona target & UTC, hitung selisih menit
    const fmt = (t) => new Date(now.toLocaleString("en-US", { timeZone: t }));
    return (fmt(tz) - fmt("UTC")) / 60000;
  } catch { return 0; }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function localTimeStr(tz) {
  if (!tz) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date());
  } catch { return "—"; }
}

function refreshLocationDisplay() {
  const c = loadCouple();
  // Sisi kita
  if (c.myCity) {
    myGeo = { lat: c.myLat, lon: c.myLon, city: c.myCity, tz: c.myTz || Intl.DateTimeFormat().resolvedOptions().timeZone };
    el("myCityName").textContent = c.myCity;
    el("myLocalTime").textContent = localTimeStr(myGeo.tz);
  } else {
    el("myCityName").textContent = "Belum diset";
    el("myLocalTime").textContent = "—";
  }
  // Sisi pasangan
  if (c.partnerCity) {
    partnerGeo = { lat: c.partnerLat, lon: c.partnerLon, city: c.partnerCity, tz: c.partnerTz };
    el("partnerCityName").textContent = c.partnerCity;
    el("partnerLocalTime").textContent = localTimeStr(c.partnerTz);
  } else {
    el("partnerCityName").textContent = "Belum diset";
    el("partnerLocalTime").textContent = "—";
  }
  // Jarak
  if (myGeo && partnerGeo) {
    const km = haversineKm(myGeo.lat, myGeo.lon, partnerGeo.lat, partnerGeo.lon);
    el("distanceKm").textContent = km.toLocaleString("id-ID");
    // Beda waktu antara dua zona
    try {
      const myOffMins = getTzOffsetMins(myGeo.tz);
      const pOffMins = getTzOffsetMins(partnerGeo.tz);
      const diffHrs = Math.round((pOffMins - myOffMins) / 60);
      el("tzDiff").textContent = diffHrs === 0 ? "Zona waktu sama ⏰" : `Selisih ${Math.abs(diffHrs)} jam ${diffHrs > 0 ? "(pasangan lebih maju)" : "(kamu lebih maju)"}`;
    } catch { el("tzDiff").textContent = ""; }
  } else {
    el("distanceKm").textContent = "—";
    el("tzDiff").textContent = "";
  }
  // Update waktu setiap menit
  clearInterval(locTimeTimer);
  locTimeTimer = setInterval(refreshLocationDisplay, 60000);
}

// Terima lokasi pasangan via couple-info (menggantikan handler yang lama)
socket.on("couple-info", (c) => {
  const local = loadCouple();
  // Data lokasi pasangan (field myCity/myLat/myLon/myTz = milik pengirim)
  if (c.myCity) { local.partnerCity = c.myCity; local.partnerLat = c.myLat; local.partnerLon = c.myLon; local.partnerTz = c.myTz; }
  // Nama & tanggal (sinkron tampilan seperti dulu)
  if (c.name1) local.name1 = c.name1;
  if (c.name2) local.name2 = c.name2;
  if (c.date) local.date = c.date;
  saveCouple(local);
  applyCouple(local);
  refreshLocationDisplay();
});
