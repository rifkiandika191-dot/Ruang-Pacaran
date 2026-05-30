// ============================================================
//  FITUR SERU — Kangen, Ciuman (+suara), Game (TTT, Truth/Dare,
//  Suit, Siapa Lebih Mungkin), Roda, Zoom & geser kamera,
//  Notifikasi chat mencolok.
//  (Memakai socket/el/toast/escapeHtml/popupNotif/myId dari room.js)
// ============================================================
(function () {
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function openModal(id) { el(id).classList.remove("hidden"); }
  function closeModal(id) { el(id).classList.add("hidden"); }
  ["gameModal", "wheelModal"].forEach((id) => {
    el(id).addEventListener("click", (e) => { if (e.target === el(id)) closeModal(id); });
  });

  // ----------------------------------------------------------
  //  SUARA (Web Audio API — tanpa file)
  // ----------------------------------------------------------
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  function ensureAudio() {
    if (!actx && AudioCtx) { try { actx = new AudioCtx(); } catch (e) {} }
    if (actx && actx.state === "suspended") { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  window.addEventListener("pointerdown", ensureAudio);
  function blip(freq, t0, dur, type, vol) {
    const c = ensureAudio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    const now = c.currentTime + t0;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol || 0.2, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur + 0.03);
  }
  // Suara ciuman realistis (noise burst + sweep = "muah")
  // Ciuman lembut/menggoda (dua "muah" breathy yang halus)
  function kissSound() {
    const c = ensureAudio(); if (!c) return;
    const one = (start) => {
      const dur = 0.34;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length); // breathy decay
      const src = c.createBufferSource(); src.buffer = buf;
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 2.2;
      const g = c.createGain();
      const now = c.currentTime + start;
      bp.frequency.setValueAtTime(1100, now);
      bp.frequency.exponentialRampToValueAtTime(320, now + dur); // turun = lebih "mendesah"
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.4, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(bp); bp.connect(g); g.connect(c.destination);
      src.start(now); src.stop(now + dur + 0.03);
    };
    one(0); one(0.42);
  }
  // Suara bicara (TTS) — bisa diatur nada & kecepatan
  function speak(text, pitch, rate) {
    try {
      if (!("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "id-ID"; u.rate = rate || 1; u.pitch = pitch == null ? 1 : pitch; u.volume = 1;
      const vs = speechSynthesis.getVoices();
      const fem = vs.find((v) => /id[-_]/i.test(v.lang) && /female|wanita|perempuan|gadis|sri|damayanti/i.test(v.name)) || vs.find((v) => /id[-_]|indones/i.test(v.lang + " " + v.name));
      if (fem) u.voice = fem;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }
  try { if ("speechSynthesis" in window) speechSynthesis.getVoices(); } catch (e) {}

  const sfx = {
    chat() { blip(880, 0, 0.12, "sine", 0.18); blip(1320, 0.07, 0.12, "sine", 0.12); },
    kangen() { blip(330, 0, 0.4, "sine", 0.18); blip(262, 0.25, 0.5, "sine", 0.16); speak("Sayang… aku kangen kamu", 0.8, 0.82); },
    kiss() { kissSound(); speak("mmuah", 0.8, 0.75); },
    win() { blip(523, 0, 0.12, "triangle", 0.2); blip(659, 0.1, 0.12, "triangle", 0.2); blip(784, 0.2, 0.2, "triangle", 0.2); },
    bell() {
      // Lonceng notifikasi — harmonik alami seperti bel pintu
      blip(1318, 0,    0.8,  "sine", 0.22);
      blip(1661, 0,    0.5,  "sine", 0.14);
      blip(1975, 0,    0.3,  "sine", 0.10);
      blip(1318, 0.45, 0.8,  "sine", 0.18);
      blip(1661, 0.45, 0.5,  "sine", 0.11);
    },
    spin() { // bunyi roda berputar — tik-tik makin melambat selama ~4 detik
      let t = 0, gap = 0.045;
      for (let i = 0; i < 60 && t < 3.9; i++) { blip(1500, t, 0.025, "square", 0.1); t += gap; gap *= 1.075; }
    },
  };

  // ----------------------------------------------------------
  //  UKURAN KOLOM KAMERA — preset XS/S/M/L/XL, tersimpan lokal
  // ----------------------------------------------------------
  const SIZES = ["xs", "sm", "md", "lg", "xl"];
  const grid = el("camPanelGrid");
  function applySize(s) {
    SIZES.forEach((n) => grid.classList.remove("size-" + n));
    grid.classList.add("size-" + s);
    document.querySelectorAll(".csp-btn").forEach((b) => b.classList.toggle("active", b.dataset.size === s));
    try { localStorage.setItem("cam_size", s); } catch (e) {}
  }
  // Terapkan ukuran tersimpan (default M)
  applySize(localStorage.getItem("cam_size") || "md");
  // Klik preset
  document.querySelectorAll(".csp-btn").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); applySize(b.dataset.size); });
  });

  // ----------------------------------------------------------
  //  KANGEN & CIUMAN (overlay + suara)
  // ----------------------------------------------------------
  function showOverlay(emoji, text, sound) {
    el("myEmoji").textContent = emoji;
    el("missYouText").textContent = text;
    const o = el("missYouOverlay");
    o.classList.add("show");
    try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); } catch (e) {}
    if (sound) sound();
    setTimeout(() => o.classList.remove("show"), 2600);
  }
  el("missYouBtn").addEventListener("click", () => { sfx.kangen(); toast("Sinyal kangen terkirim 💌"); socket.emit("fun", { kind: "miss-you" }); });
  el("kissBtn").addEventListener("click", () => { sfx.kiss(); toast("Ciuman terkirim 😘"); socket.emit("fun", { kind: "kiss" }); });

  // ----------------------------------------------------------
  //  NOTIFIKASI CHAT (suara + kedip + popup)
  // ----------------------------------------------------------
  socket.on("chat", (m) => {
    if (!m || m.system || m.id === myId) return;
    sfx.chat();
    const h = document.querySelector(".chat-head");
    if (h) { h.classList.add("flash"); setTimeout(() => h.classList.remove("flash"), 1600); }
    popupNotif("💬", m.name || "Pesan baru", (m.text || "").slice(0, 60));
  });

  // Cek garis menang umum untuk papan grid (rows x cols, butuh K beruntun)
  function lineWinner(bd, rows, cols, K) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const m = bd[r * cols + c]; if (!m) continue;
      for (const [dr, dc] of dirs) {
        let k = 1, rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < rows && cc >= 0 && cc < cols && bd[rr * cols + cc] === m) { k++; rr += dr; cc += dc; }
        if (k >= K) return m;
      }
    }
    return null;
  }

  // ----------------------------------------------------------
  //  GAME: XOX 5×5 (menang = 4 beruntun)
  // ----------------------------------------------------------
  const TTT_N = 5, TTT_K = 4;
  const tttBoard = el("tttBoard");
  let tttCells = [], board = [], myMark = null, turn = "X", tttOver = false;
  function tttInit() {
    board = Array(TTT_N * TTT_N).fill(""); myMark = null; turn = "X"; tttOver = false;
    tttBoard.style.gridTemplateColumns = `repeat(${TTT_N}, 1fr)`;
    tttBoard.innerHTML = ""; tttCells = [];
    for (let i = 0; i < TTT_N * TTT_N; i++) {
      const c = document.createElement("button");
      c.className = "ttt-cell small";
      c.addEventListener("click", () => tttClick(i));
      tttBoard.appendChild(c); tttCells.push(c);
    }
    renderTtt(); updateTttStatus();
  }
  function renderTtt() {
    board.forEach((m, i) => { tttCells[i].textContent = m; tttCells[i].classList.toggle("x", m === "X"); tttCells[i].classList.toggle("o", m === "O"); });
  }
  function tttClick(i) {
    if (tttOver || board[i]) return;
    if (myMark === null) myMark = "X";
    if (turn !== myMark) { toast("Bukan giliranmu 😋"); return; }
    tttPlace(i, myMark); socket.emit("fun", { kind: "ttt-move", i, mark: myMark });
  }
  function tttPlace(i, mark) {
    if (board[i]) return;
    board[i] = mark; turn = mark === "X" ? "O" : "X"; renderTtt();
    const w = lineWinner(board, TTT_N, TTT_N, TTT_K);
    if (w) { tttOver = true; const win = w === myMark; el("tttStatus").textContent = win ? "Kamu menang! 🎉" : "Pasangan menang 😅"; if (win) { sfx.win(); reportWin(); } return; }
    if (board.every((x) => x)) { tttOver = true; el("tttStatus").textContent = "Seri! 🤝"; return; }
    updateTttStatus();
  }
  function updateTttStatus() {
    if (tttOver) return;
    if (myMark === null) el("tttStatus").textContent = "Giliranmu — kamu jadi ❌ (sambung 4 untuk menang)";
    else el("tttStatus").textContent = turn === myMark ? `Giliranmu (${myMark})` : `Giliran pasangan (${turn})`;
  }
  el("tttReset").addEventListener("click", () => { tttInit(); socket.emit("fun", { kind: "ttt-reset" }); });

  // ----------------------------------------------------------
  //  GAME: SAMBUNG 4 (Connect Four) — 7 kolom × 6 baris
  // ----------------------------------------------------------
  const C4_COLS = 7, C4_ROWS = 6;
  const c4Board = el("c4Board");
  let c4Cells = [], c4 = [], c4Mark = null, c4Turn = "R", c4Over = false;
  function c4Init() {
    c4 = Array(C4_ROWS * C4_COLS).fill(""); c4Mark = null; c4Turn = "R"; c4Over = false;
    c4Board.style.gridTemplateColumns = `repeat(${C4_COLS}, 1fr)`;
    c4Board.innerHTML = ""; c4Cells = [];
    for (let i = 0; i < C4_ROWS * C4_COLS; i++) {
      const cell = document.createElement("button");
      cell.className = "c4-cell";
      const col = i % C4_COLS;
      cell.addEventListener("click", () => c4Click(col));
      c4Board.appendChild(cell); c4Cells.push(cell);
    }
    c4Render(); c4Status();
  }
  function c4Render() {
    c4.forEach((m, i) => { c4Cells[i].classList.toggle("r", m === "R"); c4Cells[i].classList.toggle("y", m === "Y"); });
  }
  function c4DropRow(col) { for (let r = C4_ROWS - 1; r >= 0; r--) { if (!c4[r * C4_COLS + col]) return r; } return -1; }
  function c4Click(col) {
    if (c4Over) return;
    if (c4Mark === null) c4Mark = "R";
    if (c4Turn !== c4Mark) { toast("Bukan giliranmu 😋"); return; }
    if (c4DropRow(col) < 0) return;
    c4Drop(col, c4Mark); socket.emit("fun", { kind: "c4-move", col, mark: c4Mark });
  }
  function c4Drop(col, mark) {
    const r = c4DropRow(col); if (r < 0) return;
    c4[r * C4_COLS + col] = mark; c4Turn = mark === "R" ? "Y" : "R"; c4Render();
    const w = lineWinner(c4, C4_ROWS, C4_COLS, 4);
    if (w) { c4Over = true; const win = w === c4Mark; el("c4Status").textContent = win ? "Kamu menang! 🎉" : "Pasangan menang 😅"; if (win) { sfx.win(); reportWin(); } return; }
    if (c4.every((x) => x)) { c4Over = true; el("c4Status").textContent = "Seri! 🤝"; return; }
    c4Status();
  }
  function c4Status() {
    if (c4Over) return;
    const label = (mk) => mk === "R" ? "🔴" : "🟡";
    if (c4Mark === null) el("c4Status").textContent = "Giliranmu — kamu 🔴";
    else el("c4Status").textContent = c4Turn === c4Mark ? `Giliranmu ${label(c4Mark)}` : `Giliran pasangan ${label(c4Turn)}`;
  }
  el("c4Reset").addEventListener("click", () => { c4Init(); socket.emit("fun", { kind: "c4-reset" }); });

  // ----------------------------------------------------------
  //  SKOR (persisten per room)
  // ----------------------------------------------------------
  function reportWin() { socket.emit("score-win"); }
  function renderScoreboard(s) {
    const sb = el("scoreboard");
    const entries = Object.entries(s || {});
    if (!entries.length) {
      sb.innerHTML = `<span class="sb-trophy">🏆</span><span class="sb-text">Skor tersimpan otomatis</span>`;
      return;
    }
    entries.sort((a, b) => b[1] - a[1]);
    const medals = ["🥇", "🥈", "🥉"];
    const rows = entries.map(([n, w], i) => {
      const isTop = i === 0 && w > 0;
      return `<div class="sb-entry${isTop ? " sb-lead" : ""}">
        <span class="sb-medal">${medals[i] || "🏅"}</span>
        <span class="sb-name">${escapeHtml(n)}</span>
        <span class="sb-score">${w}</span>
      </div>`;
    }).join("");
    sb.innerHTML = `<div class="sb-header"><span>🏆 Papan Skor</span></div><div class="sb-entries">${rows}</div>`;
  }
  socket.on("scoreboard", renderScoreboard);

  // Lonceng saat pasangan bergabung
  socket.on("user-joined", ({ name }) => {
    sfx.bell();
    popupNotif("💕", `${name} masuk ruangan`, "Pasanganmu sudah online!");
  });

  // ----------------------------------------------------------
  //  GAME: TAP BATTLE — tap sebanyak-banyaknya (10 detik)
  //  Anti-zoom: pakai touchstart+preventDefault & touch-action CSS
  // ----------------------------------------------------------
  const TAP_SECS = 10;
  let tapRunning = false, myTaps = 0, theirTapCount = 0, tapDoneMe = false, tapPartnerDone = false, tapInterval = null;

  function tapReset() {
    tapRunning = false; tapDoneMe = false; tapPartnerDone = false;
    myTaps = 0; theirTapCount = 0;
    el("myTapCount").textContent = "0";
    el("theirTapCount").textContent = "—";
    el("tapTimer").textContent = "";
    el("tapBattleBtn").disabled = true;
    el("tapStart").disabled = false;
    el("tapStatus").textContent = "Tekan Mulai, lalu tap tombol di bawah sekencangnya! 👊";
  }

  function tapStartLocal() {
    if (tapRunning) return;
    tapRunning = true; tapDoneMe = false; tapPartnerDone = false;
    myTaps = 0; theirTapCount = 0;
    el("myTapCount").textContent = "0";
    el("theirTapCount").textContent = "—";
    el("tapBattleBtn").disabled = false;
    el("tapStart").disabled = true;
    let left = TAP_SECS;
    el("tapTimer").textContent = left + "s";
    el("tapStatus").textContent = "TAP SEKENCANGNYA! 👊";
    tapInterval = setInterval(() => {
      left--;
      el("tapTimer").textContent = left > 0 ? left + "s" : "";
      if (left <= 0) {
        clearInterval(tapInterval); tapInterval = null;
        tapRunning = false;
        el("tapBattleBtn").disabled = true;
        tapDoneMe = true;
        socket.emit("fun", { kind: "tap-done", count: myTaps });
        tapTryResolve();
      }
    }, 1000);
  }

  function tapTryResolve() {
    if (!tapDoneMe || !tapPartnerDone) {
      el("tapStatus").textContent = tapDoneMe ? "Selesai! Menunggu pasangan... ⏳" : "Pasangan selesai! Tap terus! 👊";
      return;
    }
    const iWin = myTaps > theirTapCount;
    const draw  = myTaps === theirTapCount;
    if (draw) el("tapStatus").textContent = `Seri! 🤝 (${myTaps} vs ${theirTapCount})`;
    else if (iWin) { el("tapStatus").textContent = `Kamu menang! 🎉 (${myTaps} vs ${theirTapCount})`; sfx.win(); reportWin(); }
    else el("tapStatus").textContent = `Pasangan menang 😅 (${myTaps} vs ${theirTapCount})`;
  }

  // Tombol tap — pakai touchstart+preventDefault agar TIDAK zoom di HP
  const tapBtn = el("tapBattleBtn");
  function doTap() {
    if (!tapRunning || tapDoneMe) return;
    myTaps++;
    el("myTapCount").textContent = myTaps;
    // Kirim update tiap 5 tap agar tidak terlalu spam socket
    if (myTaps % 5 === 0) socket.emit("fun", { kind: "tap-update", count: myTaps });
  }
  tapBtn.addEventListener("touchstart", (e) => { e.preventDefault(); doTap(); }, { passive: false });
  tapBtn.addEventListener("click", doTap); // fallback desktop

  el("tapStart").addEventListener("click", () => { tapReset(); tapStartLocal(); socket.emit("fun", { kind: "tap-start" }); });

  // ----------------------------------------------------------
  //  GAME: KUIS PASANGAN
  // ----------------------------------------------------------
  const quizBank = [
    { q: "Campuran warna biru + kuning?", o: ["Hijau", "Ungu", "Oranye", "Coklat"], a: 0 },
    { q: "Ibu kota Indonesia?", o: ["Bandung", "Jakarta", "Surabaya", "Medan"], a: 1 },
    { q: "Berapa hari dalam seminggu?", o: ["5", "6", "7", "8"], a: 2 },
    { q: "Planet terdekat dari Matahari?", o: ["Bumi", "Mars", "Venus", "Merkurius"], a: 3 },
    { q: "Hewan tercepat di darat?", o: ["Cheetah", "Singa", "Kuda", "Rusa"], a: 0 },
    { q: "1 jam = berapa menit?", o: ["30", "60", "90", "100"], a: 1 },
    { q: "Lambang cinta yang umum?", o: ["Bintang", "Bulan", "Hati ❤️", "Matahari"], a: 2 },
    { q: "Air membeku pada suhu?", o: ["10°C", "5°C", "100°C", "0°C"], a: 3 },
    { q: "Warna bendera Indonesia?", o: ["Merah-Putih", "Merah-Biru", "Putih-Hijau", "Biru-Putih"], a: 0 },
    { q: "Buah berwarna kuning melengkung?", o: ["Apel", "Pisang", "Jeruk", "Anggur"], a: 1 },
    { q: "Alat untuk melihat benda jauh?", o: ["Mikroskop", "Kacamata", "Teleskop", "Lup"], a: 2 },
    { q: "Berapa sisi segitiga?", o: ["5", "4", "6", "3"], a: 3 },
  ];
  let quizAnswered = false;
  function quizShow(qi) {
    const Q = quizBank[qi]; quizAnswered = false;
    el("quizQ").textContent = "🧠 " + Q.q; el("quizStatus").textContent = "";
    const box = el("quizOpts"); box.innerHTML = "";
    Q.o.forEach((opt, idx) => {
      const b = document.createElement("button");
      b.className = "quiz-opt"; b.textContent = opt;
      b.addEventListener("click", () => quizAnswer(qi, idx, b));
      box.appendChild(b);
    });
  }
  function quizAnswer(qi, idx, btn) {
    if (quizAnswered) return; quizAnswered = true;
    const Q = quizBank[qi];
    [...el("quizOpts").children].forEach((b, i) => { b.disabled = true; if (i === Q.a) b.classList.add("correct"); });
    if (idx === Q.a) { el("quizStatus").textContent = "Benar! 🎉 +1 skor"; sfx.win(); reportWin(); }
    else { btn.classList.add("wrong"); el("quizStatus").textContent = "Salah 😅 (jawaban benar disorot)"; }
  }
  el("quizNew").addEventListener("click", () => { const qi = Math.floor(Math.random() * quizBank.length); quizShow(qi); socket.emit("fun", { kind: "quiz-q", qi }); });

  // ----------------------------------------------------------
  //  GAME: TRUTH OR DARE
  // ----------------------------------------------------------
  const truths = [
    "Kapan pertama kali kamu sadar suka aku?", "Apa hal favoritmu dari aku?",
    "Kenangan paling berkesan bareng aku?", "Apa yang paling bikin kamu kangen?",
    "Hal kecil apa yang pengen aku lakukan lebih sering?", "Panggilan sayang yang paling kamu suka?",
    "Kalau bisa ulang 1 momen kita, momen apa?", "Apa yang pertama kali kamu perhatikan dari aku?",
    "Mimpi yang pengen kita wujudkan bareng?", "Apa kebiasaanku yang paling kamu suka?",
    "Hal paling manis yang pernah aku lakukan?", "Tempat impian buat liburan berdua?",
    "Apa yang bikin kamu yakin sama aku?", "Lagu yang mengingatkanmu pada aku?",
    "Apa hal yang belum pernah kamu bilang ke aku?", "Versi terbaik dari hubungan kita menurutmu?",
    "Apa yang kamu rasakan saat pertama lihat aku?", "Hal apa yang ingin kita coba bareng?",
    "Momen paling lucu kita?", "Apa arti aku buat kamu dalam 3 kata?",
  ];
  const dares = [
    "Kirim selfie paling lucu sekarang! 🤪", "Voice note bilang 'I love you' 😚",
    "Tiru gaya bicaraku 😂", "Kirim emoji yang menggambarkan perasaanmu sekarang",
    "Nyanyikan 1 baris lagu favorit kita 🎶", "Rencanakan 1 kencan impian dalam 1 kalimat",
    "Kasih 3 pujian buat aku sekarang 💕", "Kirim foto langit/tempatmu sekarang 🌅",
    "Bikin pantun gombal buat aku 😘", "Kirim foto ekspresi paling cute 🥰",
    "Sebut 5 hal yang kamu suka dariku 💖", "Tiru suara hewan kesukaanku 🐱",
    "Ceritakan rencana kencan berikutnya 💑", "Kirim chat pakai bahasa alay total 😆",
    "Buat hati pakai tangan & foto 🫶", "Bilang sesuatu yang romantis sekarang ❤️",
    "Tunjukkan benda terdekat yang warnanya pink 💗", "Kirim GIF paling menggemaskan 🐻",
  ];
  function todShow(kind, text) { el("todCard").innerHTML = `<b>${kind === "truth" ? "💬 Truth" : "🔥 Dare"}</b><br>${escapeHtml(text)}`; }
  el("todTruth").addEventListener("click", () => { const t = rand(truths); todShow("truth", t); socket.emit("fun", { kind: "tod", todKind: "truth", text: t }); });
  el("todDare").addEventListener("click", () => { const t = rand(dares); todShow("dare", t); socket.emit("fun", { kind: "tod", todKind: "dare", text: t }); });

  // ----------------------------------------------------------
  //  GAME: SUIT (Batu-Gunting-Kertas)
  // ----------------------------------------------------------
  let myChoice = null, theirChoice = null;
  const suitEmoji = { batu: "✊", gunting: "✌️", kertas: "✋" };
  function suitReset() {
    myChoice = null; theirChoice = null;
    el("suitStatus").textContent = "Pilih jurusmu! ✊✌️✋";
    el("suitResult").textContent = "";
    document.querySelectorAll(".suit-btn").forEach((b) => b.classList.remove("picked"));
  }
  function suitWinner(a, b) {
    if (a === b) return 0;
    if ((a === "batu" && b === "gunting") || (a === "gunting" && b === "kertas") || (a === "kertas" && b === "batu")) return 1;
    return 2;
  }
  function suitReveal() {
    if (!myChoice || !theirChoice) return;
    const r = suitWinner(myChoice, theirChoice);
    el("suitStatus").textContent = `Kamu ${suitEmoji[myChoice]}  vs  ${suitEmoji[theirChoice]} Pasangan`;
    if (r === 0) el("suitResult").textContent = "Seri! 🤝";
    else if (r === 1) { el("suitResult").textContent = "Kamu menang! 🎉"; sfx.win(); reportWin(); }
    else el("suitResult").textContent = "Pasangan menang 😅";
  }
  function suitPick(c) {
    if (myChoice) return;
    myChoice = c;
    document.querySelectorAll(".suit-btn").forEach((b) => b.classList.toggle("picked", b.dataset.suit === c));
    el("suitStatus").textContent = theirChoice ? "Membuka..." : "Menunggu pasangan... ⏳";
    socket.emit("fun", { kind: "suit", choice: c });
    suitReveal();
  }
  document.querySelectorAll(".suit-btn").forEach((b) => b.addEventListener("click", () => suitPick(b.dataset.suit)));
  el("suitReset").addEventListener("click", () => { suitReset(); socket.emit("fun", { kind: "suit-reset" }); });

  // ----------------------------------------------------------
  //  GAME: SIAPA LEBIH MUNGKIN
  // ----------------------------------------------------------
  const likely = [
    "Siapa lebih mungkin ketiduran duluan? 😴", "Siapa lebih mungkin lupa anniversary? 📅",
    "Siapa lebih mungkin minta maaf duluan? 🥺", "Siapa lebih mungkin nangis nonton film? 😭",
    "Siapa lebih mungkin ngabisin makanan pasangan? 🍟", "Siapa lebih mungkin telat bales chat? 📱",
    "Siapa lebih mungkin jadi overthinking? 💭", "Siapa lebih mungkin rela antri demi makanan? 🍜",
    "Siapa lebih mungkin salah kirim chat? 😅", "Siapa lebih mungkin lebih romantis? 💕",
    "Siapa lebih mungkin lebih cemburuan? 😤", "Siapa lebih mungkin jago masak? 👨‍🍳",
    "Siapa lebih mungkin lupa naruh barang? 🔑", "Siapa lebih mungkin begadang? 🌙",
    "Siapa lebih mungkin ngambek lucu? 😡", "Siapa lebih mungkin traktir duluan? 💸",
  ];
  function likelyShow(t) { el("likelyCard").textContent = "🤔 " + t; }
  el("likelyDraw").addEventListener("click", () => { const t = rand(likely); likelyShow(t); socket.emit("fun", { kind: "likely", text: t }); });

  // Tab game + buka/tutup
  document.querySelectorAll(".gtab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".gtab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    const g = t.dataset.game;
    ["ttt", "connect4", "tap", "quiz", "suit", "tod", "likely"].forEach((name) => {
      el("game-" + name).classList.toggle("hidden", g !== name);
    });
  }));
  el("gameBtn").addEventListener("click", () => { if (!tttCells.length) tttInit(); if (!c4Cells.length) c4Init(); openModal("gameModal"); });
  el("gameClose").addEventListener("click", () => closeModal("gameModal"));

  // ----------------------------------------------------------
  //  RODA KEPUTUSAN
  // ----------------------------------------------------------
  const wheelColors = ["#ff5c8a", "#ffa6c1", "#ff85a1", "#ffc2d4", "#ff7aa8", "#ffb3c6"];
  let wheelRotation = 0, wheelTimer = null;
  function getOptions() { return el("wheelOptions").value.split("\n").map((s) => s.trim()).filter(Boolean); }
  function drawWheel(opts) {
    const cv = el("wheelCanvas");
    // DPI scaling agar tidak blur di layar Retina / mobile
    const dpr = window.devicePixelRatio || 1;
    const size = 280;
    cv.width  = size * dpr;
    cv.height = size * dpr;
    cv.style.width  = size + "px";
    cv.style.height = size + "px";
    const x = cv.getContext("2d");
    x.scale(dpr, dpr);
    const R = size / 2;
    const n = opts.length, slice = (2 * Math.PI) / n;
    x.clearRect(0, 0, size, size);
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * slice, a1 = a0 + slice;
      x.beginPath(); x.moveTo(R, R); x.arc(R, R, R - 4, a0, a1); x.closePath();
      x.fillStyle = wheelColors[i % wheelColors.length]; x.fill();
      x.save(); x.translate(R, R); x.rotate(a0 + slice / 2);
      x.fillStyle = "#5a2330"; x.font = "bold 13px Quicksand, sans-serif"; x.textAlign = "right";
      x.fillText(opts[i].slice(0, 12), R - 12, 5); x.restore();
    }
  }
  function doSpin(opts, i) {
    drawWheel(opts);
    const slice = 360 / opts.length;
    const targetMod = (((360 - (i * slice + slice / 2)) % 360) + 360) % 360;
    const base = Math.floor(wheelRotation / 360) * 360;
    let final = base + 360 * 6 + targetMod;
    if (final <= wheelRotation) final += 360;
    wheelRotation = final;
    const cv = el("wheelCanvas");
    cv.style.transition = "transform 4s cubic-bezier(.17,.67,.2,1)";
    cv.style.transform = `rotate(${final}deg)`;
    el("wheelResult").textContent = "Memutar... 🎡";
    sfx.spin();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { el("wheelResult").textContent = "🎯 " + opts[i]; sfx.win(); }, 4100);
  }
  el("wheelBtn").addEventListener("click", () => { drawWheel(getOptions().length ? getOptions() : ["?"]); openModal("wheelModal"); });
  el("wheelClose").addEventListener("click", () => closeModal("wheelModal"));
  el("wheelSpin").addEventListener("click", () => {
    const opts = getOptions();
    if (opts.length < 2) { toast("Isi minimal 2 pilihan ya 💕"); return; }
    const i = Math.floor(Math.random() * opts.length);
    doSpin(opts, i);
    socket.emit("fun", { kind: "wheel", options: opts, index: i });
  });

  // ----------------------------------------------------------
  //  TERIMA EVENT DARI PASANGAN
  // ----------------------------------------------------------
  socket.on("fun", (d) => {
    if (!d) return;
    switch (d.kind) {
      case "miss-you": showOverlay("🥺💕", `${d.by} kangen kamu!`, sfx.kangen); break;
      case "kiss": showOverlay("😘💋", `${d.by} kirim ciuman!`, sfx.kiss); break;
      case "ttt-move":
        if (!tttCells.length) tttInit();
        if (myMark === null) myMark = d.mark === "X" ? "O" : "X";
        tttPlace(d.i, d.mark);
        break;
      case "ttt-reset": tttInit(); break;
      case "c4-move":
        if (!c4Cells.length) c4Init();
        if (c4Mark === null) c4Mark = d.mark === "R" ? "Y" : "R";
        c4Drop(d.col, d.mark);
        break;
      case "c4-reset": c4Init(); break;
      case "tap-start": tapReset(); tapStartLocal(); break;
      case "tap-update": theirTapCount = d.count; el("theirTapCount").textContent = d.count; break;
      case "tap-done":
        theirTapCount = d.count; el("theirTapCount").textContent = d.count;
        tapPartnerDone = true; tapTryResolve();
        break;
      case "quiz-q": quizShow(d.qi); break;
      case "tod": todShow(d.todKind, d.text); break;
      case "suit":
        theirChoice = d.choice;
        if (myChoice) suitReveal();
        else el("suitStatus").textContent = "Pasangan sudah pilih, giliranmu! 👀";
        break;
      case "suit-reset": suitReset(); break;
      case "likely": likelyShow(d.text); break;
      case "wheel": openModal("wheelModal"); doSpin(d.options, d.index); break;
    }
  });
})();
