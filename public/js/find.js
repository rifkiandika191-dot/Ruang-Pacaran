// ============================================================
//  Halaman Cari Pacar Online
// ============================================================
const socket = io();
let myName = "", matchedRoom = "", matchedPartner = "";
let countdownTimer = null, tipsTimer = null;

const el = (id) => document.getElementById(id);
function show(id) { el(id).classList.remove("hidden"); }
function hide(id) { el(id).classList.add("hidden"); }
function setState(s) {
  ["stateIdle", "stateSearching", "stateFound"].forEach((id) => hide(id));
  show("state" + s);
}

// Tips saat menunggu (berganti tiap 5 detik)
const tips = [
  "Lagi mencari kamu juga di luar sana 💕",
  "Sabar ya, jodoh tidak kemana 😊",
  "Siapa tahu dia lagi buka halaman yang sama 🌐",
  "Mungkin sudah dekat, tinggal selangkah lagi 🚀",
  "Hati yang terbuka akan menemukan jalannya 💖",
  "Sebentar lagi kamu akan dipasangkan 🌟",
];
let tipIdx = 0;
function rotateTips() {
  el("findTips").textContent = tips[tipIdx % tips.length];
  tipIdx++;
}

// Hati melayang di background (sama seperti landing page)
(function makeHearts() {
  const bg = document.getElementById("heartsBg");
  if (!bg) return;
  const emojis = ["❤️", "💕", "💖", "💗", "🌸", "💝"];
  for (let i = 0; i < 14; i++) {
    const h = document.createElement("div");
    h.className = "heart";
    h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    h.style.left = Math.random() * 100 + "vw";
    h.style.fontSize = 14 + Math.random() * 20 + "px";
    h.style.animationDuration = 7 + Math.random() * 9 + "s";
    h.style.animationDelay = Math.random() * 8 + "s";
    bg.appendChild(h);
  }
})();

// Isi nama dari localStorage
el("findName").value = localStorage.getItem("pacaran_name") || "";

// Auto-mulai mencari (datang dari tombol Skip "/find?auto=1")
const AUTO = new URLSearchParams(location.search).get("auto") === "1";
if (AUTO && el("findName").value.trim()) {
  // tunggu socket siap sebentar lalu langsung cari
  setTimeout(() => startSearch(), 300);
}

// Jumlah pencari real-time
socket.on("match-online-count", (count) => {
  const t = count > 0 ? `${count} orang sedang mencari sekarang` : "Belum ada yang mencari";
  const el2 = document.getElementById("onlineSeeking");
  if (el2) el2.textContent = count;
  const el3 = document.getElementById("searchingCount");
  if (el3) el3.textContent = count > 1 ? `${count - 1} orang lain juga sedang mencari` : "Kamu yang pertama mencari — tunggu sebentar 🌟";
  // Update landing page juga kalau ada
  const idx = document.getElementById("onlineCount");
  if (idx) idx.textContent = count + " orang sedang mencari";
});

// ---- Mulai cari ----
el("startFindBtn").addEventListener("click", startSearch);
el("findName").addEventListener("keydown", (e) => { if (e.key === "Enter") startSearch(); });

function startSearch() {
  const name = el("findName").value.trim();
  if (!name) { el("findName").focus(); el("findName").style.borderColor = "var(--pink)"; return; }
  myName = name;
  localStorage.setItem("pacaran_name", name);
  socket.emit("match-join", { name });
}

// Server bilang masuk antrian
socket.on("match-waiting", () => {
  setState("Searching");
  rotateTips();
  tipsTimer = setInterval(rotateTips, 5000);
});

// ---- Batalkan ----
el("cancelFindBtn").addEventListener("click", () => {
  socket.emit("match-cancel");
  clearInterval(tipsTimer);
});
socket.on("match-cancelled", () => setState("Idle"));

// ---- Ketemu! ----
socket.on("match-found", ({ roomId, partnerName }) => {
  clearInterval(tipsTimer);
  matchedRoom = roomId;
  matchedPartner = partnerName;
  el("partnerNameEl").textContent = partnerName;
  setState("Found");

  // Hitung mundur 3 detik lalu masuk
  let left = 3;
  el("foundCountdown").textContent = left;
  countdownTimer = setInterval(() => {
    left--;
    el("foundCountdown").textContent = left;
    if (left <= 0) { clearInterval(countdownTimer); goToRoom(); }
  }, 1000);
});

// ---- Masuk sekarang ----
el("goNowBtn").addEventListener("click", () => { clearInterval(countdownTimer); goToRoom(); });

function goToRoom() {
  const params = new URLSearchParams({ room: matchedRoom, name: myName, match: "1" });
  window.location.href = "/room?" + params.toString();
}

// Tangani disconnect / reconnect
socket.on("disconnect", () => {
  if (el("stateSearching") && !el("stateSearching").classList.contains("hidden")) {
    clearInterval(tipsTimer);
    setState("Idle");
    alert("Koneksi terputus. Silakan coba lagi.");
  }
});
