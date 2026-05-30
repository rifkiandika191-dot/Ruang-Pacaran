// ============================================================
//  donation-effect.js  v4  — Ringan, tidak ganggu, CSS-only
//  Tidak ada canvas, tidak ada Web Audio berat
// ============================================================
(function () {
  const SAWERIA = "https://saweria.co/ikkkyyyy";
  const _sock   = typeof io !== "undefined" ? io() : null;
  if (!_sock) return;

  let closeTimer;

  // ── Style + HTML (inject sekali) ──
  function inject() {
    if (document.getElementById("donToast")) return;

    const style = document.createElement("style");
    style.textContent = `
      /* Backdrop tipis — sedikit redup di belakang */
      #donBackdrop {
        position:fixed;inset:0;z-index:2147483640;
        background:rgba(0,0,0,.12);
        opacity:0;pointer-events:none;
        transition:opacity .4s;
      }
      #donBackdrop.show{opacity:1;}

      /* Toast — z-index tertinggi yang mungkin di browser */
      #donToast {
        position:fixed;
        top:-160px;
        left:50%;
        transform:translateX(-50%);
        z-index:2147483647;
        width:94%;
        max-width:400px;
        background:#fff;
        border-radius:22px;
        padding:16px 14px 14px 18px;
        display:flex;align-items:center;gap:12px;
        transition:top .52s cubic-bezier(.18,1.25,.4,1);
        /* Glow berwarna */
        box-shadow:
          0 0 0 2.5px #fbbf24,
          0 12px 40px rgba(245,158,11,.25),
          0 4px 16px rgba(0,0,0,.14);
        animation:toastGlow 2s ease-in-out infinite;
        overflow:hidden;
      }
      #donToast.show{top:14px;}
      @keyframes toastGlow {
        0%,100%{box-shadow:0 0 0 2.5px #fbbf24,0 12px 40px rgba(245,158,11,.25),0 4px 16px rgba(0,0,0,.14);}
        50%    {box-shadow:0 0 0 2.5px #ef4444,0 12px 50px rgba(239,68,68,.35),0 4px 20px rgba(0,0,0,.18);}
      }

      /* Garis pelangi di atas */
      #donToast::before {
        content:"";
        position:absolute;top:0;left:0;right:0;height:4px;
        background:linear-gradient(90deg,#f59e0b,#ef4444,#a855f7,#3b82f6,#10b981,#f59e0b);
        background-size:300% 100%;
        animation:rainbowSlide 2s linear infinite;
      }
      @keyframes rainbowSlide{to{background-position:300% 0;}}

      /* Konfeti */
      #donConfetti {
        position:fixed;top:0;left:50%;
        transform:translateX(-50%);
        width:420px;height:110px;
        pointer-events:none;z-index:2147483646;
        overflow:hidden;
      }
      .don-dot {
        position:absolute;border-radius:3px;opacity:0;
        animation:donFall linear forwards;
      }
      @keyframes donFall {
        0%  {opacity:1;transform:translateY(0) rotate(0deg);}
        85% {opacity:.9;}
        100%{opacity:0;transform:translateY(110px) rotate(480deg);}
      }

      /* Emoji */
      .dt-emoji {
        font-size:40px;flex-shrink:0;line-height:1;
        animation:dtBounce .55s ease-in-out infinite alternate;
      }
      @keyframes dtBounce{
        from{transform:scale(1) rotate(-5deg);}
        to  {transform:scale(1.18) rotate(5deg);}
      }

      /* Body */
      .dt-body{flex:1;min-width:0;}
      .dt-who {
        font-size:14px;font-weight:700;color:#222;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        font-family:Quicksand,system-ui,sans-serif;
      }
      .dt-amt {
        font-size:26px;font-weight:800;line-height:1.15;
        background:linear-gradient(135deg,#f59e0b 20%,#ef4444 80%);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;
        background-clip:text;
        font-family:Quicksand,system-ui,sans-serif;
        filter:drop-shadow(0 1px 4px rgba(239,68,68,.2));
      }
      .dt-hint{
        font-size:11px;color:#b45309;margin-top:1px;
        font-family:Quicksand,system-ui,sans-serif;
      }

      /* Tombol donasi */
      .dt-btn {
        flex-shrink:0;
        background:linear-gradient(135deg,#f59e0b,#ef4444);
        color:#fff;border-radius:14px;padding:10px 14px;
        font-size:12px;font-weight:700;text-decoration:none;
        white-space:nowrap;
        font-family:Quicksand,system-ui,sans-serif;
        box-shadow:0 4px 14px rgba(239,68,68,.35);
        transition:filter .12s,transform .12s;
        position:relative;overflow:hidden;
      }
      /* Shimmer di tombol */
      .dt-btn::after{
        content:"";
        position:absolute;top:0;left:-70%;width:50%;height:100%;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);
        animation:btnShimmer 2s ease-in-out infinite;
      }
      @keyframes btnShimmer{to{left:130%;}}
      .dt-btn:hover{filter:brightness(1.1);transform:scale(1.05);}

      .dt-close{
        flex-shrink:0;background:none;border:none;cursor:pointer;
        color:#bbb;font-size:15px;padding:3px 5px;border-radius:6px;
        transition:color .12s,background .12s;
      }
      .dt-close:hover{color:#555;background:#f0f0f0;}

      /* Progress bar countdown */
      #donProgress {
        position:absolute;bottom:0;left:0;
        height:3px;border-radius:0 0 22px 22px;
        background:linear-gradient(90deg,#f59e0b,#ef4444);
        transition:width 1s linear;
        width:100%;
      }

      /* Dark mode */
      body.dark #donToast{
        background:#1e0d15;
        box-shadow:0 0 0 2.5px #92400e,0 12px 40px rgba(0,0,0,.5);
      }
      body.dark .dt-who {color:#f5e2ea;}
      body.dark .dt-hint{color:#d97706;}
      body.dark .dt-close:hover{background:#2a1018;color:#f5e2ea;}

      /* Float button */
      .float-donate {
        position:fixed;bottom:20px;right:18px;z-index:500;
        width:50px;height:50px;border-radius:50%;
        background:linear-gradient(135deg,#f59e0b,#ef4444);
        color:#fff;font-size:24px;
        display:flex;align-items:center;justify-content:center;
        text-decoration:none;
        box-shadow:0 4px 16px rgba(239,68,68,.5);
        transition:transform .15s;
        animation:floatPulse 2.5s ease-in-out infinite;
      }
      .float-donate:hover{transform:scale(1.13);animation:none;}
      @keyframes floatPulse{
        0%,100%{box-shadow:0 4px 16px rgba(239,68,68,.5);}
        50%    {box-shadow:0 4px 28px rgba(239,68,68,.8);}
      }

      @media(max-width:600px){
        #donToast{max-width:96%;padding:13px 10px 12px 14px;gap:9px;}
        .dt-emoji{font-size:32px;}
        .dt-amt  {font-size:22px;}
        .dt-btn  {padding:9px 11px;font-size:11px;}
        #donConfetti{width:96vw;}
        .float-donate{width:44px;height:44px;font-size:21px;bottom:14px;right:12px;}
      }
    `;
    document.head.appendChild(style);

    // Backdrop
    const bd = document.createElement("div");
    bd.id = "donBackdrop";
    document.body.appendChild(bd);

    // Toast
    const toast = document.createElement("div");
    toast.id = "donToast";
    toast.innerHTML = `
      <div class="dt-emoji" id="dtEmoji">🎆</div>
      <div class="dt-body">
        <div class="dt-who"  id="dtWho"></div>
        <div class="dt-amt"  id="dtAmt"></div>
        <div class="dt-hint">🎆 min. Rp 10rb = efek untuk semua!</div>
      </div>
      <a href="${SAWERIA}" target="_blank" rel="noopener" class="dt-btn">☕ Donasi</a>
      <button class="dt-close" id="dtClose">✕</button>
      <div id="donProgress"></div>
    `;
    document.body.appendChild(toast);
    document.getElementById("dtClose").addEventListener("click", hide);
    bd.addEventListener("click", hide);

    // Konfeti container
    const conf = document.createElement("div");
    conf.id = "donConfetti";
    document.body.appendChild(conf);
  }

  // ── Konfeti CSS — tetes warna ringan ──
  const CONF_COLORS = ["#f59e0b","#ef4444","#3b82f6","#a855f7","#10b981","#ec4899","#fde68a","#6ee7b7"];

  function spawnConfetti() {
    const box = document.getElementById("donConfetti");
    if (!box) return;
    box.innerHTML = "";
    for (let i = 0; i < 32; i++) {
      const d   = document.createElement("div");
      d.className = "don-dot";
      const size = 5 + Math.random() * 9;
      d.style.cssText = [
        `left:${2 + Math.random() * 96}%`,
        `top:${-size}px`,
        `width:${size}px`,
        `height:${size * .55}px`,
        `background:${CONF_COLORS[i % CONF_COLORS.length]}`,
        `animation-duration:${.65 + Math.random() * 1}s`,
        `animation-delay:${Math.random() * .7}s`,
      ].join(";");
      box.appendChild(d);
    }
    setTimeout(() => { if (box) box.innerHTML = ""; }, 2200);
  }

  // ════════════════════════════════════════════════════════
  //  AUDIO — Render offline → WAV blob → <audio> HTML
  //  OfflineAudioContext tidak butuh user gesture untuk render.
  //  <audio> HTML jauh lebih reliable di iOS/Android
  //  dibanding WebAudio yang butuh gesture tiap kali.
  // ════════════════════════════════════════════════════════
  let _tingEl = null;   // elemen <audio>
  let _unlocked = false;

  // Konversi AudioBuffer → ArrayBuffer WAV
  function _toWav(buf) {
    const sr = buf.sampleRate, len = buf.length;
    const out = new ArrayBuffer(44 + len * 2);
    const v = new DataView(out);
    const s = (o, t) => [...t].forEach((c,i) => v.setUint8(o+i, c.charCodeAt(0)));
    s(0,"RIFF"); v.setUint32(4, 36+len*2, true); s(8,"WAVE");
    s(12,"fmt "); v.setUint32(16,16,true); v.setUint16(20,1,true);
    v.setUint16(22,1,true); v.setUint32(24,sr,true);
    v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
    s(36,"data"); v.setUint32(40,len*2,true);
    const ch = buf.getChannelData(0);
    let off = 44;
    for (let i=0;i<len;i++) {
      v.setInt16(off, Math.max(-1,Math.min(1,ch[i])) * 0x7FFF, true);
      off += 2;
    }
    return out;
  }

  // Render ting offline (tidak butuh gesture) lalu simpan sebagai <audio>
  async function _buildTing() {
    try {
      const sr = 22050, dur = 1.3;
      const off = new OfflineAudioContext(1, Math.ceil(sr*dur), sr);
      [[880,0,.18],[1047,.15,.18],[1319,.32,.28]].forEach(([f,t,d]) => {
        const o=off.createOscillator(), g=off.createGain();
        o.connect(g); g.connect(off.destination);
        o.type="triangle"; o.frequency.value=f;
        g.gain.setValueAtTime(.45,t);
        g.gain.exponentialRampToValueAtTime(.001,t+d);
        o.start(t); o.stop(t+d+.02);
      });
      const rendered = await off.startRendering();
      const blob = new Blob([_toWav(rendered)], {type:"audio/wav"});
      _tingEl = new Audio(URL.createObjectURL(blob));
      _tingEl.preload = "auto";
    } catch(_) {}
  }
  _buildTing(); // render segera saat halaman load

  // Unlock <audio> pada gesture pertama (wajib di iOS)
  function _unlockTing() {
    if (_unlocked || !_tingEl) return;
    _tingEl.play()
      .then(() => { _tingEl.pause(); _tingEl.currentTime = 0; _unlocked = true; })
      .catch(() => {});
  }
  ["touchstart","touchend","pointerdown","click"].forEach(ev =>
    document.addEventListener(ev, _unlockTing, { passive: true })
  );

  function playTing() {
    if (!_tingEl) return;
    _tingEl.currentTime = 0;
    _tingEl.play().catch(() => {});
  }

  // ── Format Rupiah ──
  function fmtRp(n) {
    if (n >= 1_000_000) return `Rp ${+(n/1_000_000).toFixed(1)} juta`;
    if (n >= 1_000)     return `Rp ${Math.floor(n/1_000)} ribu`;
    return `Rp ${n}`;
  }

  // ── Show ──
  const DURATION = 8; // detik sebelum auto-close

  function show(donation) {
    inject();

    // Emoji bergantian tiap donasi
    const emojis = ["🎆","🎇","✨","🎊","🎉"];
    document.getElementById("dtEmoji").textContent =
      emojis[Math.floor(Math.random() * emojis.length)];
    document.getElementById("dtWho").textContent = `🎉 ${donation.name} baru saja donasi!`;
    document.getElementById("dtAmt").textContent  = fmtRp(donation.amount || 0);

    const toast = document.getElementById("donToast");
    const bd    = document.getElementById("donBackdrop");
    const prog  = document.getElementById("donProgress");

    // Reset lalu tampilkan
    toast.classList.remove("show"); bd.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show"); bd.classList.add("show");

    // Progress bar countdown
    if (prog) {
      prog.style.transition = "none";
      prog.style.width = "100%";
      void prog.offsetWidth;
      prog.style.transition = `width ${DURATION}s linear`;
      prog.style.width = "0%";
    }

    spawnConfetti();
    playTing();

    clearTimeout(closeTimer);
    closeTimer = setTimeout(hide, DURATION * 1000);
  }

  // ── Hide ──
  function hide() {
    const toast = document.getElementById("donToast");
    const bd    = document.getElementById("donBackdrop");
    if (toast) toast.classList.remove("show");
    if (bd)    bd.classList.remove("show");
    clearTimeout(closeTimer);
  }

  // ── Socket ──
  _sock.on("new-donation", show);
  // Donasi kecil (<10rb) — toast tanpa konfeti & suara
  _sock.on("new-donation-small", (d) => {
    inject();
    document.getElementById("dtEmoji").textContent = "☕";
    document.getElementById("dtWho").textContent = `🙏 ${d.name} baru saja donasi!`;
    document.getElementById("dtAmt").textContent  = fmtRp(d.amount || 0);

    const toast = document.getElementById("donToast");
    const bd    = document.getElementById("donBackdrop");
    const prog  = document.getElementById("donProgress");
    toast.classList.remove("show"); bd.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show"); bd.classList.add("show");
    if (prog) {
      prog.style.transition = "none"; prog.style.width = "100%";
      void prog.offsetWidth;
      prog.style.transition = `width ${DURATION}s linear`; prog.style.width = "0%";
    }
    clearTimeout(closeTimer);
    closeTimer = setTimeout(hide, DURATION * 1000);
  });

  // ── Tombol mengambang di room ──
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector(".layout")) {
      const fb = document.createElement("a");
      fb.href = SAWERIA; fb.target = "_blank"; fb.rel = "noopener";
      fb.className = "float-donate"; fb.title = "Dukung Ruang Pacaran ☕";
      fb.textContent = "☕";
      document.body.appendChild(fb);
    }
  });

  // ── Test (lewat server → semua pengunjung) ──
  window._testDonasi = async (name, amount, message) => {
    await fetch("/api/test-donation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:    name    || "Test Donatur",
        amount:  amount  || 75000,
        message: message || "Semangat terus! 🎉",
      }),
    });
    console.log("✅ Test donasi dikirim ke semua pengunjung!");
  };

})();
