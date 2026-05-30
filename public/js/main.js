// ============================================================
//  Landing page — buat / gabung ruangan
// ============================================================

// Buat hati melayang di background
(function makeHearts() {
  const bg = document.getElementById("heartsBg");
  if (!bg) return;
  const emojis = ["❤️", "💕", "💖", "💗", "🌸", "💞"];
  for (let i = 0; i < 18; i++) {
    const h = document.createElement("div");
    h.className = "heart";
    h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    h.style.left = Math.random() * 100 + "vw";
    h.style.fontSize = 14 + Math.random() * 22 + "px";
    h.style.animationDuration = 7 + Math.random() * 9 + "s";
    h.style.animationDelay = Math.random() * 8 + "s";
    bg.appendChild(h);
  }
})();

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");

// Ingat nama terakhir
nameInput.value = localStorage.getItem("pacaran_name") || "";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function go(roomId) {
  const name = (nameInput.value || "Sayang").trim();
  localStorage.setItem("pacaran_name", name);
  const params = new URLSearchParams({ room: roomId, name });
  window.location.href = "/room?" + params.toString();
}

document.getElementById("createBtn").addEventListener("click", () => {
  go(makeCode());
});

document.getElementById("joinBtn").addEventListener("click", () => {
  const code = roomInput.value.trim().toUpperCase();
  if (!code) {
    roomInput.focus();
    roomInput.style.borderColor = "#ff5c8a";
    return;
  }
  go(code);
});

roomInput.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("joinBtn").click(); });
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") roomInput.focus(); });

// Jumlah orang sedang mencari pacar (real-time)
try {
  const socket = io();
  socket.on("match-online-count", (count) => {
    const el = document.getElementById("onlineCount");
    if (el) el.textContent = count > 0 ? count + " orang sedang mencari sekarang" : "Jadilah yang pertama mencari 💝";
  });
} catch (e) {}

// ============================================================
//  RIWAYAT ROOM — tampilkan room yang sudah 30+ menit dipakai
//  Hilang otomatis jika tidak masuk dalam 24 jam
// ============================================================
const HISTORY_KEY = "pacaran_room_history";
const MIN_DURATION = 1800;   // 30 menit
const MAX_AGE_MS   = 86400000; // 24 jam

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000)     return "baru saja";
  if (diff < 3600000)   return Math.floor(diff / 60000) + " menit lalu";
  if (diff < 86400000)  return Math.floor(diff / 3600000) + " jam lalu";
  return "kemarin";
}

function formatDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h} jam ${m > 0 ? m + " menit" : ""}`.trim();
  return `${m} menit`;
}

function loadRoomHistory() {
  const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  const now = Date.now();
  // Filter: kunjungi dalam 24 jam DAN durasi >= 30 menit
  const valid = all.filter(r => (now - r.lastVisited) < MAX_AGE_MS && r.durationSeconds >= MIN_DURATION);
  // Bersihkan yang sudah kadaluarsa dari storage
  if (valid.length !== all.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(valid));
  return valid;
}

function renderRoomHistory() {
  const rooms = loadRoomHistory();
  const historyEl = document.getElementById("roomHistory");
  const listEl    = document.getElementById("rhList");
  if (!rooms.length) { historyEl.classList.add("hidden"); return; }

  historyEl.classList.remove("hidden");
  listEl.innerHTML = "";

  rooms.forEach((r) => {
    const partnerText = r.partnerNames && r.partnerNames.length
      ? `dengan ${r.partnerNames.join(" & ")} · `
      : "";
    const card = document.createElement("div");
    card.className = "rh-card";
    card.innerHTML = `
      <div class="rh-info">
        <div class="rh-code">🏠 ${r.roomId}</div>
        <div class="rh-meta">${partnerText}${formatDuration(r.durationSeconds)}</div>
        <div class="rh-time">${formatTimeAgo(r.lastVisited)}</div>
      </div>
      <button class="btn btn-primary rh-btn">Masuk Lagi →</button>
    `;
    card.querySelector(".rh-btn").addEventListener("click", () => {
      const name = (nameInput.value || localStorage.getItem("pacaran_name") || "Sayang").trim();
      localStorage.setItem("pacaran_name", name);
      window.location.href = `/room?room=${r.roomId}&name=${encodeURIComponent(name)}`;
    });
    listEl.appendChild(card);
  });
}

renderRoomHistory();
