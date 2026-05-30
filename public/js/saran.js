// ============================================================
//  Halaman Saran / Fitur / Bug
// ============================================================

// Hati mengambang (sama seperti landing)
(function makeHearts() {
  const bg = document.getElementById("heartsBg");
  if (!bg) return;
  const emojis = ["❤️", "💕", "💖", "💡", "✨", "🌸"];
  for (let i = 0; i < 12; i++) {
    const h = document.createElement("div");
    h.className = "heart";
    h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    h.style.left = Math.random() * 100 + "vw";
    h.style.fontSize = 14 + Math.random() * 18 + "px";
    h.style.animationDuration = 7 + Math.random() * 9 + "s";
    h.style.animationDelay = Math.random() * 8 + "s";
    bg.appendChild(h);
  }
})();

const g = (id) => document.getElementById(id);

function escHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000)    return "baru saja";
  if (d < 3600000)  return Math.floor(d / 60000) + " menit lalu";
  if (d < 86400000) return Math.floor(d / 3600000) + " jam lalu";
  return Math.floor(d / 86400000) + " hari lalu";
}

const typeLabel = { saran: "💡 Saran", fitur: "✨ Fitur", bug: "🐛 Bug" };
const typeClass = { saran: "tag-saran", fitur: "tag-fitur", bug: "tag-bug" };

// ── Tab type ──
let currentType   = "saran";
let currentFilter = "all";
let allFeedbacks  = [];

document.querySelectorAll(".sf-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sf-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentType = btn.dataset.type;
    g("fbType").value = currentType;
    const labels = {
      saran: "Tuliskan saranmu",
      fitur: "Fitur apa yang kamu inginkan?",
      bug:   "Jelaskan bug yang kamu temukan",
    };
    const placeholders = {
      saran: "Ceritakan idenya...",
      fitur: "Contoh: bisa kirim stiker di chat...",
      bug:   "Contoh: tombol X tidak berfungsi saat...",
    };
    g("fbMsgLabel").textContent = labels[currentType];
    g("fbMsg").placeholder = placeholders[currentType];
  });
});

// ── Filter list ──
document.querySelectorAll(".slf").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".slf").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderList();
  });
});

// ── Submit ──
g("fbSubmit").addEventListener("click", async () => {
  const name    = g("fbName").value.trim();
  const message = g("fbMsg").value.trim();
  const type    = currentType;

  if (!message) { showStatus("Tuliskan pesanmu dulu ya 🙏", "error"); return; }

  g("fbSubmit").disabled = true;
  g("fbSubmit").textContent = "Mengirim...";

  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, message }),
    });
    const data = await res.json();
    if (data.ok) {
      g("fbMsg").value = "";
      showStatus("Terkirim! Terima kasih atas masukanmu 💖", "success");
      loadFeedbacks();
    } else {
      showStatus("Gagal mengirim, coba lagi.", "error");
    }
  } catch (e) {
    showStatus("Tidak bisa terhubung ke server.", "error");
  }

  g("fbSubmit").disabled = false;
  g("fbSubmit").textContent = "Kirim 🚀";
});

function showStatus(msg, type) {
  const el = g("fbStatus");
  el.textContent = msg;
  el.className = "fb-status " + type;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

// ── Load & render list ──
async function loadFeedbacks() {
  try {
    const res = await fetch("/api/feedback");
    allFeedbacks = await res.json();
    renderList();
  } catch (e) {
    g("slList").innerHTML = `<div class="sl-empty">Tidak bisa memuat masukan saat ini.</div>`;
  }
}

function renderList() {
  const list = g("slList");
  const items = currentFilter === "all"
    ? allFeedbacks
    : allFeedbacks.filter((f) => f.type === currentFilter);

  if (!items.length) {
    list.innerHTML = `<div class="sl-empty">Belum ada ${currentFilter === "all" ? "masukan" : typeLabel[currentFilter]} — jadilah yang pertama! 💕</div>`;
    return;
  }

  list.innerHTML = items.map((f) => `
    <div class="sl-item" data-id="${f.id}">
      <div class="sl-top">
        <span class="sl-tag ${typeClass[f.type] || "tag-saran"}">${typeLabel[f.type] || "💡 Saran"}</span>
        <span class="sl-name">${escHtml(f.name)}</span>
        <span class="sl-time">${timeAgo(f.ts)}</span>
      </div>
      <div class="sl-msg">${escHtml(f.message)}</div>
      <div class="sl-foot">
        <button class="sl-like" data-id="${f.id}">👍 ${f.likes || 0}</button>
      </div>
    </div>
  `).join("");

  // Like buttons
  list.querySelectorAll(".sl-like").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      try {
        const res  = await fetch(`/api/feedback/${id}/like`, { method: "POST" });
        const data = await res.json();
        if (data.ok) { btn.textContent = `👍 ${data.likes}`; btn.disabled = true; }
      } catch (e) {}
    });
  });
}

// Live update via socket
try {
  const socket = io();
  socket.on("new-feedback", (fb) => {
    allFeedbacks.unshift(fb);
    renderList();
  });
} catch (e) {}

loadFeedbacks();
