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
        position:fixed;inset:0;z-index:99990;
        background:rgba(0,0,0,.12);
        opacity:0;pointer-events:none;
        transition:opacity .4s;
      }
      #donBackdrop.show{opacity:1;}

      /* Toast */
      #donToast {
        position:fixed;
        top:-160px;
        left:50%;
        transform:translateX(-50%);
        z-index:99999;
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
        pointer-events:none;z-index:99998;
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

    // Toast
    const toast = document.createElement("div");
    toast.id = "donToast";
    toast.innerHTML = `
      <div class="dt-emoji">🎆</div>
      <div class="dt-body">
        <div class="dt-who"  id="dtWho"></div>
        <div class="dt-amt"  id="dtAmt"></div>
        <div class="dt-hint">🎆 min. Rp 10rb = kembang api untuk semua!</div>
      </div>
      <a href="${SAWERIA}" target="_blank" rel="noopener" class="dt-btn">☕ Donasi</a>
      <button class="dt-close" id="dtClose">✕</button>
    `;
    document.body.appendChild(toast);
    document.getElementById("dtClose").addEventListener("click", hide);

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
    for (let i = 0; i < 22; i++) {
      const d = document.createElement("div");
      d.className = "don-dot";
      const size = 6 + Math.random() * 7;
      d.style.cssText = [
        `left:${5 + Math.random() * 90}%`,
        `top:${-size}px`,
        `width:${size}px`,
        `height:${size * .6}px`,
        `background:${CONF_COLORS[i % CONF_COLORS.length]}`,
        `animation-duration:${.7 + Math.random() * .9}s`,
        `animation-delay:${Math.random() * .6}s`,
      ].join(";");
      box.appendChild(d);
    }
    // Bersihkan setelah animasi selesai
    setTimeout(() => { if (box) box.innerHTML = ""; }, 2000);
  }

  // ── Suara — ting! singkat (Web Audio, 3 not saja) ──
  function playTing() {
    try {
      const A = new (window.AudioContext || window.webkitAudioContext)();
      [[880,.14],[1047,.13],[1319,.22]].forEach(([f,d],i)=>{
        const o=A.createOscillator(), g=A.createGain();
        o.connect(g); g.connect(A.destination);
        o.type="triangle"; o.frequency.value=f;
        const t=A.currentTime+i*.12;
        g.gain.setValueAtTime(.18,t);
        g.gain.exponentialRampToValueAtTime(.001,t+d);
        o.start(t); o.stop(t+d);
      });
    } catch(_){}
  }

  // ── Format Rupiah ──
  function fmtRp(n) {
    if (n >= 1_000_000) return `Rp ${+(n/1_000_000).toFixed(1)} juta`;
    if (n >= 1_000)     return `Rp ${Math.floor(n/1_000)} ribu`;
    return `Rp ${n}`;
  }

  // ── Show ──
  function show(donation) {
    inject();
    document.getElementById("dtWho").textContent = `🎉 ${donation.name} baru saja donasi!`;
    document.getElementById("dtAmt").textContent  = fmtRp(donation.amount || 0);

    const toast = document.getElementById("donToast");
    // Reset animasi toast jika sedang tampil
    toast.classList.remove("show");
    void toast.offsetWidth; // reflow
    toast.classList.add("show");

    spawnConfetti();
    playTing();

    clearTimeout(closeTimer);
    closeTimer = setTimeout(hide, 7000);
  }

  // ── Hide ──
  function hide() {
    const toast = document.getElementById("donToast");
    if (toast) toast.classList.remove("show");
    clearTimeout(closeTimer);
  }

  // ── Socket ──
  _sock.on("new-donation", show);

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
