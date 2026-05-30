// ============================================================
//  donation-effect.js
//  Efek meriah global saat ada donasi masuk:
//  - Fireworks canvas full-screen
//  - Suara petasan + fanfare (Web Audio API, tanpa file)
//  - Overlay notifikasi donasi + tombol "Yuk Donasi Juga!"
// ============================================================

(function () {
  const SAWERIA = "https://saweria.co/ikkkyyyy";

  // ── Buat koneksi socket sendiri agar tidak bentrok ──
  const _sock = (typeof io !== "undefined") ? io() : null;
  if (!_sock) return;

  // ── State ──
  let overlay, fwCanvas, fwCtx, animId, countdownId;
  const rockets   = [];
  const particles = [];

  // ══════════════════════════════════════════════════════
  //  DOM — inject sekali
  // ══════════════════════════════════════════════════════
  function inject() {
    if (document.getElementById("donOverlay")) return;

    // CSS inline agar tidak butuh file CSS terpisah
    const style = document.createElement("style");
    style.textContent = `
      #donOverlay {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(0,0,0,.72);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; pointer-events: none;
        transition: opacity .4s;
      }
      #donOverlay.show { opacity: 1; pointer-events: auto; }
      #donCanvas {
        position: absolute; inset: 0; width: 100%; height: 100%;
        pointer-events: none;
      }
      .don-card {
        position: relative; z-index: 2;
        background: #fff; border-radius: 24px;
        padding: 28px 22px 22px; width: 90%; max-width: 360px;
        text-align: center;
        box-shadow: 0 24px 70px rgba(0,0,0,.55);
        animation: donPop .5s cubic-bezier(.2,1.2,.3,1) both;
      }
      @keyframes donPop {
        from { transform: scale(.55) translateY(60px); opacity: 0; }
        to   { transform: scale(1)   translateY(0);    opacity: 1; }
      }
      .don-close {
        position: absolute; top: 12px; right: 14px;
        cursor: pointer; font-size: 18px; color: #aaa;
        background: none; border: none; padding: 4px 7px;
        border-radius: 50%; transition: background .12s, color .12s; line-height: 1;
      }
      .don-close:hover { background: #f5f5f5; color: #333; }
      .don-firework-emoji {
        font-size: 54px; line-height: 1; margin-bottom: 6px;
        animation: donBounce .8s ease-in-out infinite alternate;
      }
      @keyframes donBounce { from { transform: scale(1); } to { transform: scale(1.18); } }
      .don-who {
        font-size: 18px; font-weight: 700; color: #222; margin-bottom: 6px;
        font-family: Quicksand, system-ui, sans-serif;
      }
      .don-amount {
        font-size: 36px; font-weight: 800;
        background: linear-gradient(135deg,#f59e0b,#ef4444);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text; margin-bottom: 6px; line-height: 1.15;
        font-family: Quicksand, system-ui, sans-serif;
      }
      .don-msg {
        font-size: 14px; color: #666; font-style: italic;
        margin-bottom: 10px; line-height: 1.4;
        font-family: Quicksand, system-ui, sans-serif;
      }
      .don-hero {
        font-size: 13px; font-weight: 700; color: #b45309;
        background: #fff7ed; border-radius: 999px; padding: 5px 14px;
        display: inline-block; margin-bottom: 16px;
        font-family: Quicksand, system-ui, sans-serif;
      }
      .don-btn {
        display: block; width: 100%; padding: 15px;
        font-size: 16px; font-weight: 700; text-decoration: none;
        background: linear-gradient(135deg,#f59e0b,#ef4444);
        color: #fff; border-radius: 14px;
        box-shadow: 0 6px 20px rgba(239,68,68,.35);
        transition: filter .15s, transform .15s;
        font-family: Quicksand, system-ui, sans-serif;
        animation: donBtnPulse 1.8s ease-in-out infinite;
      }
      @keyframes donBtnPulse {
        0%,100% { box-shadow: 0 6px 20px rgba(239,68,68,.35); }
        50%      { box-shadow: 0 8px 28px rgba(239,68,68,.65); }
      }
      .don-btn:hover { filter: brightness(1.1); transform: scale(1.02); animation: none; }
      .don-timer {
        font-size: 11px; color: #ccc; margin-top: 12px;
        font-family: Quicksand, system-ui, sans-serif;
      }
      /* Floating donate button di room */
      .float-donate {
        position: fixed; bottom: 22px; right: 20px; z-index: 500;
        width: 54px; height: 54px; border-radius: 50%;
        background: linear-gradient(135deg,#f59e0b,#ef4444);
        color: #fff; font-size: 26px;
        display: flex; align-items: center; justify-content: center;
        text-decoration: none;
        box-shadow: 0 4px 18px rgba(239,68,68,.45);
        transition: transform .15s, box-shadow .15s;
        animation: floatPulse 2.2s ease-in-out infinite;
      }
      .float-donate:hover { transform: scale(1.12); animation: none;
        box-shadow: 0 6px 24px rgba(239,68,68,.65); }
      @keyframes floatPulse {
        0%,100% { box-shadow: 0 4px 18px rgba(239,68,68,.45); }
        50%      { box-shadow: 0 4px 30px rgba(239,68,68,.75); }
      }
      @media (max-width: 600px) {
        .don-amount { font-size: 28px; }
        .don-card { padding: 24px 16px 18px; }
        .float-donate { width: 48px; height: 48px; font-size: 22px; bottom: 16px; right: 14px; }
      }
    `;
    document.head.appendChild(style);

    const el = document.createElement("div");
    el.id = "donOverlay";
    el.innerHTML = `
      <canvas id="donCanvas"></canvas>
      <div class="don-card">
        <button class="don-close" id="donClose">✕</button>
        <div class="don-firework-emoji">🎆</div>
        <div class="don-who"  id="donWho"></div>
        <div class="don-amount" id="donAmt"></div>
        <div class="don-msg"  id="donMsg"></div>
        <div class="don-hero">🦸 Pahlawan Ruang Pacaran!</div>
        <a href="${SAWERIA}" target="_blank" rel="noopener" class="don-btn">
          ☕ Yuk Donasi Juga!
        </a>
        <div class="don-timer" id="donTimer"></div>
      </div>
    `;
    document.body.appendChild(el);

    overlay  = el;
    fwCanvas = document.getElementById("donCanvas");
    fwCtx    = fwCanvas.getContext("2d");

    document.getElementById("donClose").addEventListener("click", hide);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) hide(); });
  }

  // ══════════════════════════════════════════════════════
  //  FIREWORKS
  // ══════════════════════════════════════════════════════
  class Rocket {
    constructor(w, h) {
      this.x     = 80 + Math.random() * (w - 160);
      this.y     = h;
      this.vy    = -(9 + Math.random() * 7);
      this.targetY = h * (0.08 + Math.random() * 0.35);
      this.hue   = Math.floor(Math.random() * 360);
      this.done  = false;
      this.trail = [];
    }
    update(w, h) {
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > 10) this.trail.pop();
      this.vy  += 0.18;
      this.y   += this.vy;
      if (this.y <= this.targetY && !this.done) { this.explode(w, h); this.done = true; }
    }
    explode(w, h) {
      const n = 90 + Math.floor(Math.random() * 50);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + (Math.random() - .5) * .3;
        const s = 1.5 + Math.random() * 6;
        particles.push(new Particle(this.x, this.y, Math.cos(a)*s, Math.sin(a)*s, this.hue));
      }
    }
    draw(ctx) {
      for (let i = 1; i < this.trail.length; i++) {
        const a = 1 - i / this.trail.length;
        ctx.beginPath();
        ctx.moveTo(this.trail[i-1].x, this.trail[i-1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.strokeStyle = `hsla(${this.hue},90%,80%,${a})`;
        ctx.lineWidth = 3 * a;
        ctx.stroke();
      }
      if (!this.done) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI*2);
        ctx.fillStyle = `hsl(${this.hue},90%,90%)`;
        ctx.fill();
      }
    }
  }

  class Particle {
    constructor(x, y, vx, vy, hue) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.hue = hue; this.alpha = 1;
      this.decay = 0.012 + Math.random() * 0.014;
      this.r = 2 + Math.random() * 2.5;
      this.bright = 55 + Math.random() * 20;
    }
    update() {
      this.vx *= 0.97; this.vy *= 0.97;
      this.vy += 0.09;
      this.x  += this.vx; this.y += this.vy;
      this.alpha -= this.decay;
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
      ctx.fillStyle = `hsl(${this.hue},90%,${this.bright}%)`;
      ctx.fill();
      ctx.restore();
    }
  }

  let lastLaunch = 0;

  function runFireworks(ts) {
    if (!overlay.classList.contains("show")) return;
    const W = fwCanvas.width, H = fwCanvas.height;
    fwCtx.fillStyle = "rgba(0,0,0,0.2)";
    fwCtx.fillRect(0, 0, W, H);

    if (ts - lastLaunch > 380) {
      rockets.push(new Rocket(W, H));
      lastLaunch = ts;
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      rockets[i].update(W, H);
      rockets[i].draw(fwCtx);
      if (rockets[i].done && rockets[i].y > H + 80) rockets.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw(fwCtx);
      if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
    animId = requestAnimationFrame(runFireworks);
  }

  // ══════════════════════════════════════════════════════
  //  AUDIO — Web Audio API (tanpa file)
  // ══════════════════════════════════════════════════════
  function playDonationSound() {
    try {
      const A = new (window.AudioContext || window.webkitAudioContext)();
      const now = A.currentTime;

      // Whistle + boom (3 kali, petasan)
      function whistle(t, dur) {
        const o = A.createOscillator(), g = A.createGain();
        o.connect(g); g.connect(A.destination);
        o.type = "sine";
        o.frequency.setValueAtTime(300, t);
        o.frequency.exponentialRampToValueAtTime(1400, t + dur * 0.85);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
      }
      function boom(t) {
        const buf = A.createBuffer(1, A.sampleRate * 0.5, A.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++)
          d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 1.5);
        const src = A.createBufferSource(), g = A.createGain();
        g.gain.setValueAtTime(0.65, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        src.buffer = buf; src.connect(g); g.connect(A.destination);
        src.start(t);
      }
      function note(freq, t, dur, type = "triangle", vol = 0.18) {
        const o = A.createOscillator(), g = A.createGain();
        o.connect(g); g.connect(A.destination);
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
      }

      // 3 petasan
      whistle(now + 0.0, 0.38); boom(now + 0.42);
      whistle(now + 0.5, 0.32); boom(now + 0.86);
      whistle(now + 1.0, 0.28); boom(now + 1.32);

      // Fanfare gembira: C-E-G-C-E-G-C-high
      const melody = [
        [523,.13],[659,.13],[784,.13],
        [1047,.22],[880,.11],[1047,.11],
        [1175,.35],
      ];
      let t = now + 1.6;
      melody.forEach(([f, d]) => { note(f, t, d+.08); t += d; });

      // Chord penutup
      [523, 659, 784, 1047].forEach((f) => note(f, t + 0.1, 0.7, "triangle", 0.12));

    } catch (_) { /* browser yang tidak support — diam saja */ }
  }

  // ══════════════════════════════════════════════════════
  //  FORMAT RUPIAH
  // ══════════════════════════════════════════════════════
  function fmtRp(n) {
    if (n >= 1_000_000) return `Rp ${(n/1_000_000).toFixed(n%1_000_000===0?0:1)} juta`;
    if (n >= 1_000)     return `Rp ${Math.floor(n/1_000)} ribu`;
    return `Rp ${n}`;
  }

  // ══════════════════════════════════════════════════════
  //  SHOW / HIDE
  // ══════════════════════════════════════════════════════
  function show(donation) {
    inject();

    document.getElementById("donWho").textContent =
      `🎉 ${donation.name} baru saja donasi!`;
    document.getElementById("donAmt").textContent = fmtRp(donation.amount || 0);
    const msgEl = document.getElementById("donMsg");
    if (donation.message) {
      msgEl.textContent = `"${donation.message}"`;
      msgEl.style.display = "";
    } else {
      msgEl.style.display = "none";
    }

    // Resize canvas
    fwCanvas.width  = window.innerWidth;
    fwCanvas.height = window.innerHeight;

    // Reset state
    rockets.length = particles.length = 0;
    cancelAnimationFrame(animId);
    fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);

    overlay.classList.add("show");
    lastLaunch = 0;
    animId = requestAnimationFrame(runFireworks);
    playDonationSound();

    // Countdown auto-close
    clearInterval(countdownId);
    let secs = 12;
    const timer = document.getElementById("donTimer");
    timer.textContent = `Menutup dalam ${secs}s`;
    countdownId = setInterval(() => {
      secs--;
      timer.textContent = `Menutup dalam ${secs}s`;
      if (secs <= 0) { clearInterval(countdownId); hide(); }
    }, 1000);
  }

  function hide() {
    if (!overlay) return;
    overlay.classList.remove("show");
    clearInterval(countdownId);
    cancelAnimationFrame(animId);
    if (fwCtx) fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);
  }

  // ══════════════════════════════════════════════════════
  //  SOCKET LISTENER
  // ══════════════════════════════════════════════════════
  _sock.on("new-donation", show);

  // Inject floating button (hanya di halaman room)
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector(".layout")) { // hanya di room.html
      const fb = document.createElement("a");
      fb.href = SAWERIA;
      fb.target = "_blank";
      fb.rel = "noopener";
      fb.className = "float-donate";
      fb.title = "Dukung Ruang Pacaran ☕";
      fb.textContent = "☕";
      document.body.appendChild(fb);
    }
  });

  // Expose untuk test manual di console: _testDonasi()
  window._testDonasi = () => show({
    name:    "Test Donatur",
    amount:  50000,
    message: "Semangat terus ya! 🎉",
  });

})();
