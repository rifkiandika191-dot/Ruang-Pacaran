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
