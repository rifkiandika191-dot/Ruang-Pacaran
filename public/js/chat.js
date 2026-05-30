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

// ── Render satu pesan ──
function addMsg(m, prepend = false) {
  const list = g("gcList");
  const div  = document.createElement("div");

  if (m.system) {
    div.className = "gc-msg gc-system";
    div.textContent = m.text;
  } else {
    const mine = m.name === myName;
    div.className = "gc-msg " + (mine ? "gc-me" : "gc-them");
    div.innerHTML = `
      <div class="gc-who">${esc(mine ? "Kamu" : m.name)}</div>
      <div class="gc-bubble">${esc(m.text)}</div>
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
    g("gcText").value += btn.textContent;
    g("gcText").focus();
  });
});

// ── Socket events ──
socket.on("gc-history", (msgs) => {
  const list = g("gcList");
  list.innerHTML = "";
  if (msgs.length) {
    const sep = document.createElement("div");
    sep.className = "gc-msg gc-system";
    sep.textContent = "─── Pesan sebelumnya ───";
    list.appendChild(sep);
  }
  msgs.forEach((m) => addMsg(m));
});

socket.on("gc-msg", (m) => {
  addMsg(m);
  // Kedipkan tab jika tidak fokus
  if (document.hidden && !m.system) {
    document.title = `💬 (${m.name}) ${m.text.slice(0, 20)}...`;
    setTimeout(() => { document.title = "💬 Chat Global — Ruang Pacaran"; }, 4000);
  }
});

socket.on("gc-online", (n) => {
  g("gcOnlineCount").textContent = n;
});

// ── Notifikasi donasi (injection dari donation-effect.js) ──
// sudah include di bawah lewat script tag terpisah
