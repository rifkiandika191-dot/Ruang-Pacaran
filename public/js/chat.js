// ============================================================
//  Chat Global — semua pengunjung ngobrol bersama
// ============================================================

const socket = io();
const g = (id) => document.getElementById(id);

let myName = "";
let joined = false;

// ── Toast ──
let _toastTimer;
function toast(msg) {
  const t = g("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ── Escape HTML ──
function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])
  );
}

// ── Format waktu ──
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" });
}

// ── Warna avatar dari nama ──
const AVATAR_COLORS = [
  ["#ec4899","#a855f7"], ["#f97316","#ef4444"], ["#14b8a6","#3b82f6"],
  ["#8b5cf6","#ec4899"], ["#10b981","#06b6d4"], ["#f43f5e","#f97316"],
];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function avatarInitial(name) {
  return (name || "?")[0].toUpperCase();
}

// ── Render satu pesan ──
function addMsg(m, prepend = false) {
  const list = g("gcList");
  const div  = document.createElement("div");

  if (m.system) {
    div.className = m.isQuote ? "gc-quote" : "gc-msg gc-system";
    div.textContent = m.text;
  } else {
    const mine   = m.name === myName;
    const colors = avatarColor(m.name);
    const init   = avatarInitial(m.name);
    div.className = "gc-msg " + (mine ? "gc-me" : "gc-them");

    const avatarStyle = mine
      ? ""
      : `background:linear-gradient(135deg,${colors[0]},${colors[1]})`;

    const badgeHtml = m.badge
      ? `<span class="gc-badge">${m.badge.emoji} ${m.badge.label}</span>`
      : "";

    div.innerHTML = `
      <div class="gc-row">
        <div class="gc-avatar" style="${avatarStyle}">${init}</div>
        <div class="gc-content">
          <div class="gc-who">${esc(mine ? "Kamu" : m.name)}${badgeHtml}</div>
          <div class="gc-bubble">${esc(m.text)}</div>
        </div>
      </div>
      <div class="gc-time">${fmtTime(m.ts)}</div>
    `;
  }

  if (prepend) list.prepend(div);
  else {
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }
}

// ── Join chat ──
function doJoin() {
  const name = g("gcNameInput").value.trim();
  if (!name) { g("gcNameInput").focus(); return; }
  myName = name;
  localStorage.setItem("pacaran_name", name);

  socket.emit("gc-join", { name });
  joined = true;

  // Tampilkan badge nama di header
  const badge  = g("gcMyBadge");
  const avatar = g("gcMyAvatar");
  const label  = g("gcMyName");
  if (badge && avatar && label) {
    const colors = avatarColor(name);
    avatar.style.background = `linear-gradient(135deg,${colors[0]},${colors[1]})`;
    avatar.textContent = avatarInitial(name);
    label.textContent  = name;
    badge.style.display = "flex";
  }

  g("gcJoinWrap").classList.add("hidden");
  g("gcChatWrap").classList.remove("hidden");
  g("gcText").focus();
}

g("gcJoinBtn").addEventListener("click", doJoin);
g("gcNameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doJoin(); });

// Kalau sudah ada nama dari halaman depan, langsung masuk tanpa isi form
const _savedName = localStorage.getItem("pacaran_name") || "";
if (_savedName) {
  g("gcNameInput").value = _savedName;
  doJoin();
}

// ── Kirim pesan ──
function sendMsg() {
  const inp  = g("gcText");
  const text = inp.value.trim();
  if (!text || !joined) return;
  socket.emit("gc-chat", { text });
  inp.value = "";
  inp.focus();
}

g("gcSend").addEventListener("click", sendMsg);
g("gcText").addEventListener("keydown", (e) => { if (e.key === "Enter") sendMsg(); });

// Emoji cepat
document.querySelectorAll(".gc-emoji-row button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const val = btn.dataset.val || btn.textContent;
    if (btn.dataset.val === "!tebak") {
      g("gcText").value = "!tebak";
      sendMsg();
    } else {
      g("gcText").value += val;
      g("gcText").focus();
    }
  });
});

// ── Typing indicator ──
let _typingTimer;
g("gcText").addEventListener("input", () => {
  if (!joined) return;
  socket.emit("gc-typing", { name: myName });
  clearTimeout(_typingTimer);
  _typingTimer = setTimeout(() => socket.emit("gc-stop-typing"), 1500);
});

// ── Socket events ──
socket.on("gc-history", (msgs) => {
  const list = g("gcList");
  list.innerHTML = "";
  if (msgs.length) {
    const sep = document.createElement("div");
    sep.className = "gc-date-sep";
    sep.textContent = "── Pesan sebelumnya ──";
    list.appendChild(sep);
  }
  msgs.forEach((m) => addMsg(m));
});

socket.on("gc-msg", (m) => {
  addMsg(m);
  if (document.hidden && !m.system) {
    document.title = `💬 (${m.name}) ${m.text.slice(0, 20)}...`;
    setTimeout(() => { document.title = "💬 Chat Global — Ruang Pacaran"; }, 4000);
  }
});

socket.on("gc-online", (n) => {
  g("gcOnlineCount").textContent = n;
});

// Typing indicator dari orang lain
socket.on("gc-typing", ({ name }) => {
  if (name === myName) return;
  const el = g("gcTyping");
  if (el) el.textContent = `${name} sedang mengetik...`;
});
socket.on("gc-stop-typing", () => {
  const el = g("gcTyping");
  if (el) el.textContent = "";
});

// ── Tebak Lagu ──
let _tebakInterval = null;

socket.on("tebak-start", ({ ytId, start }) => {
  const overlay = g("tebakOverlay");
  const yt      = g("tebakYt");
  const fill    = g("tebakFill");
  const num     = g("tebakNum");
  if (!overlay || !yt) return;

  // Load YouTube iframe
  yt.src = `https://www.youtube-nocookie.com/embed/${ytId}?start=${start}&autoplay=1&rel=0&modestbranding=1`;
  overlay.classList.add("show");

  // Countdown 30 detik
  let sisa = 30;
  num.textContent = sisa;
  fill.style.transition = "none";
  fill.style.width = "100%";
  void fill.offsetWidth;
  fill.style.transition = "width 30s linear";
  fill.style.width = "0%";

  clearInterval(_tebakInterval);
  _tebakInterval = setInterval(() => {
    sisa--;
    num.textContent = sisa;
    if (sisa <= 0) clearInterval(_tebakInterval);
  }, 1000);
});

socket.on("tebak-end", () => {
  clearInterval(_tebakInterval);
  const overlay = g("tebakOverlay");
  const yt      = g("tebakYt");
  if (overlay) overlay.classList.remove("show");
  if (yt) yt.src = "";
});
