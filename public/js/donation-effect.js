// ============================================================
//  donation-effect.js  v3  — Realistic Fireworks
//  Teknik: globalCompositeOperation "lighter" + shadow glow
//  Semua efek suara via Web Audio API (tanpa file eksternal)
// ============================================================
(function () {
  const SAWERIA = "https://saweria.co/ikkkyyyy";
  const _sock   = typeof io !== "undefined" ? io() : null;
  if (!_sock) return;

  let overlay, cvs, ctx, animId, cdId;
  let allRockets = [], allParticles = [], allConfetti = [];
  let lastLaunch = 0;

  // ════════════════════════════════════════════════════════
  //  INJECT CSS + HTML (sekali)
  // ════════════════════════════════════════════════════════
  function inject() {
    if (document.getElementById("donOverlay")) return;

    const style = document.createElement("style");
    style.textContent = `
      #donOverlay {
        position:fixed;inset:0;z-index:99999;
        background:rgba(0,0,0,.45);
        display:flex;align-items:center;justify-content:center;
        opacity:0;pointer-events:none;
        transition:opacity .45s ease;
      }
      #donOverlay.show{opacity:1;pointer-events:auto;}
      #donCvs{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}

      /* ── Kartu notifikasi ── */
      .don-card{
        position:relative;z-index:3;
        background:linear-gradient(160deg,#fff 0%,#fff8f0 100%);
        border-radius:26px;padding:26px 22px 20px;
        width:92%;max-width:370px;text-align:center;
        box-shadow:0 0 0 2px rgba(251,191,36,.6),0 28px 80px rgba(0,0,0,.55);
        animation:donPop .55s cubic-bezier(.18,1.3,.4,1) both;
        overflow:hidden;
      }
      /* Garis emas di atas */
      .don-card::before{
        content:"";position:absolute;top:0;left:0;right:0;height:4px;
        background:linear-gradient(90deg,#f59e0b,#ef4444,#a855f7,#3b82f6,#f59e0b);
        background-size:200% 100%;
        animation:donShine 2s linear infinite;
      }
      @keyframes donShine{to{background-position:200% 0;}}
      @keyframes donPop{
        from{transform:scale(.5) translateY(60px);opacity:0;}
        to  {transform:scale(1)   translateY(0);   opacity:1;}
      }

      .don-close{
        position:absolute;top:13px;right:15px;
        border:none;background:rgba(0,0,0,.06);
        width:30px;height:30px;border-radius:50%;
        font-size:14px;cursor:pointer;color:#888;
        display:flex;align-items:center;justify-content:center;
        transition:background .15s,color .15s;
      }
      .don-close:hover{background:rgba(0,0,0,.12);color:#333;}

      .don-boom{font-size:56px;line-height:1;margin-bottom:4px;
        animation:donBoom .6s ease-in-out infinite alternate;}
      @keyframes donBoom{from{transform:scale(1) rotate(-4deg);}to{transform:scale(1.2) rotate(4deg);}}

      .don-who{font-size:17px;font-weight:700;color:#1e1e1e;margin-bottom:4px;
        font-family:Quicksand,system-ui,sans-serif;}

      .don-amt{
        font-size:40px;font-weight:800;margin-bottom:8px;line-height:1.1;
        font-family:Quicksand,system-ui,sans-serif;
        background:linear-gradient(135deg,#f59e0b 20%,#ef4444 80%);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;
        background-clip:text;
        filter:drop-shadow(0 2px 8px rgba(239,68,68,.25));
      }
      .don-msg{font-size:14px;color:#666;font-style:italic;margin-bottom:10px;
        line-height:1.45;font-family:Quicksand,system-ui,sans-serif;}
      .don-badge{
        display:inline-block;margin-bottom:16px;
        background:linear-gradient(135deg,#fff7ed,#fef3c7);
        border:1.5px solid #fcd34d;border-radius:999px;
        padding:5px 16px;font-size:13px;font-weight:700;color:#92400e;
        font-family:Quicksand,system-ui,sans-serif;
      }
      .don-cta{
        display:block;width:100%;padding:15px 20px;
        font-size:16px;font-weight:700;text-decoration:none;
        background:linear-gradient(135deg,#f59e0b,#ef4444);
        color:#fff;border-radius:16px;
        box-shadow:0 6px 22px rgba(239,68,68,.4);
        font-family:Quicksand,system-ui,sans-serif;
        transition:filter .15s,transform .15s;
        animation:ctaPulse 1.8s ease-in-out infinite;
        position:relative;overflow:hidden;
      }
      /* Shimmer di tombol */
      .don-cta::after{
        content:"";position:absolute;top:0;left:-80%;width:60%;height:100%;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);
        animation:ctaShimmer 2s ease-in-out infinite;
      }
      @keyframes ctaShimmer{to{left:140%;}}
      @keyframes ctaPulse{
        0%,100%{box-shadow:0 6px 22px rgba(239,68,68,.4);}
        50%    {box-shadow:0 8px 32px rgba(239,68,68,.7);}
      }
      .don-cta:hover{filter:brightness(1.1);transform:scale(1.02);animation:none;}
      .don-timer{font-size:11px;color:#bbb;margin-top:12px;
        font-family:Quicksand,system-ui,sans-serif;}

      /* Float button di room */
      .float-donate{
        position:fixed;bottom:22px;right:20px;z-index:500;
        width:54px;height:54px;border-radius:50%;
        background:linear-gradient(135deg,#f59e0b,#ef4444);
        color:#fff;font-size:26px;
        display:flex;align-items:center;justify-content:center;
        text-decoration:none;
        box-shadow:0 4px 18px rgba(239,68,68,.5);
        transition:transform .15s,box-shadow .15s;
        animation:floatPulse 2.2s ease-in-out infinite;
      }
      .float-donate:hover{transform:scale(1.13);animation:none;
        box-shadow:0 6px 26px rgba(239,68,68,.7);}
      @keyframes floatPulse{
        0%,100%{box-shadow:0 4px 18px rgba(239,68,68,.5);}
        50%    {box-shadow:0 4px 32px rgba(239,68,68,.8);}
      }
      @media(max-width:600px){
        .don-amt{font-size:32px;}
        .don-card{padding:22px 16px 18px;}
        .float-donate{width:48px;height:48px;font-size:22px;bottom:16px;right:14px;}
      }
    `;
    document.head.appendChild(style);

    const wrap = document.createElement("div");
    wrap.id = "donOverlay";
    wrap.innerHTML = `
      <canvas id="donCvs"></canvas>
      <div class="don-card">
        <button class="don-close" id="donClose">✕</button>
        <div class="don-boom">🎆</div>
        <div class="don-who"  id="donWho"></div>
        <div class="don-amt"  id="donAmt"></div>
        <div class="don-msg"  id="donMsg"></div>
        <div class="don-badge">🦸 Pahlawan Ruang Pacaran!</div><br>
        <a href="${SAWERIA}" target="_blank" rel="noopener" class="don-cta">
          ☕ Yuk Donasi Juga! (min. Rp 10rb)
        </a>
        <div style="font-size:11px;color:#aaa;margin-top:8px;font-family:Quicksand,system-ui,sans-serif">
          🎆 Donasi ≥ Rp 10.000 = kembang api meriah untuk semua!
        </div>
        <div class="don-timer" id="donTimer"></div>
      </div>
    `;
    document.body.appendChild(wrap);

    overlay = wrap;
    cvs     = document.getElementById("donCvs");
    ctx     = cvs.getContext("2d");

    document.getElementById("donClose").addEventListener("click", hide);
    overlay.addEventListener("click", e => { if (e.target === overlay) hide(); });
  }

  // ════════════════════════════════════════════════════════
  //  FIREWORKS — Roket
  // ════════════════════════════════════════════════════════
  class Rocket {
    constructor() {
      this.x  = cvs.width  * (0.1 + Math.random() * 0.8);
      this.y  = cvs.height + 8;
      this.ty = cvs.height * (0.04 + Math.random() * 0.38);
      this.vy = -(14 + Math.random() * 9);
      this.hue   = Math.floor(Math.random() * 360);
      this.done  = false;
      this.trail = [];
    }
    update() {
      this.trail.push({ x: this.x, y: this.y, a: 1 });
      this.vy += 0.22;
      this.y  += this.vy;
      this.trail.forEach(t => t.a -= 0.07);
      this.trail = this.trail.filter(t => t.a > 0);
      if (this.y <= this.ty && !this.done) { this.done = true; this.explode(); }
    }
    explode() {
      const types = ['sphere','willow','star','ring'];
      const t = types[Math.floor(Math.random() * types.length)];
      const n = 130 + Math.floor(Math.random() * 90);
      // Flash burst
      const g = ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,90);
      g.addColorStop(0, `hsla(${this.hue},100%,92%,.9)`);
      g.addColorStop(1, `hsla(${this.hue},100%,60%,0)`);
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=g; ctx.beginPath();
      ctx.arc(this.x,this.y,90,0,Math.PI*2); ctx.fill(); ctx.restore();

      for (let i=0;i<n;i++) {
        let angle = (Math.PI*2/n)*i + (Math.random()-.5)*.25;
        let spd;
        if (t==='willow')      spd = 1 + Math.random()*7;
        else if (t==='ring')   spd = 6 + Math.random()*1.5;
        else if (t==='star')   spd = (i%2===0) ? 5+Math.random()*4 : 2+Math.random()*2;
        else                   spd = 1.5 + Math.random()*7;

        allParticles.push(new Particle(
          this.x, this.y,
          Math.cos(angle)*spd, Math.sin(angle)*spd,
          this.hue, t
        ));
      }
    }
    draw() {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.trail.forEach(t => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, 2.5*t.a, 0, Math.PI*2);
        ctx.shadowBlur = 12; ctx.shadowColor = `hsl(45,100%,80%)`;
        ctx.fillStyle = `hsla(45,100%,85%,${t.a*0.8})`;
        ctx.fill();
      });
      if (!this.done) {
        ctx.shadowBlur=20; ctx.shadowColor='#fff';
        ctx.beginPath(); ctx.arc(this.x,this.y,4,0,Math.PI*2);
        ctx.fillStyle='white'; ctx.fill();
      }
      ctx.restore();
    }
  }

  // ════════════════════════════════════════════════════════
  //  FIREWORKS — Partikel (bercahaya)
  // ════════════════════════════════════════════════════════
  class Particle {
    constructor(x,y,vx,vy,hue,type) {
      this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.hue=hue;
      this.type=type;
      this.alpha=1;
      this.decay  = 0.007 + Math.random()*0.012;
      this.r      = 2.2 + Math.random()*2.5;
      this.bright = 60 + Math.random()*30;
      this.sat    = 90 + Math.random()*10;
      this.grav   = type==='willow' ? 0.14 : type==='ring' ? 0.04 : 0.07;
      this.trail  = [];
      this.fx     = type==='friction' ? 0.94 : 0.97;
    }
    update() {
      this.trail.push({x:this.x,y:this.y});
      if (this.trail.length>8) this.trail.shift();
      this.vx *= 0.97; this.vy *= 0.97;
      this.vy += this.grav;
      this.x  += this.vx; this.y += this.vy;
      this.alpha -= this.decay;
    }
    draw() {
      const a = Math.max(0, this.alpha);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Trail (bercahaya)
      if (this.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i=1;i<this.trail.length;i++) ctx.lineTo(this.trail[i].x,this.trail[i].y);
        ctx.strokeStyle = `hsla(${this.hue},${this.sat}%,${this.bright}%,${a*0.35})`;
        ctx.lineWidth = this.r * 0.8;
        ctx.shadowBlur = 8; ctx.shadowColor=`hsl(${this.hue},100%,${this.bright}%)`;
        ctx.stroke();
      }

      // Outer glow
      ctx.globalAlpha = a*0.25;
      ctx.shadowBlur  = 22; ctx.shadowColor=`hsl(${this.hue},100%,${this.bright}%)`;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r*3.5,0,Math.PI*2);
      ctx.fillStyle=`hsl(${this.hue},${this.sat}%,${this.bright}%)`;
      ctx.fill();

      // Core bright
      ctx.globalAlpha = a;
      ctx.shadowBlur  = 14;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
      ctx.fillStyle=`hsl(${this.hue},100%,88%)`;
      ctx.fill();

      ctx.restore();
    }
  }

  // ════════════════════════════════════════════════════════
  //  CONFETTI — kertas warna-warni berjatuhan
  // ════════════════════════════════════════════════════════
  class Confetti {
    constructor() {
      this.x  = Math.random() * cvs.width;
      this.y  = -20;
      this.w  = 8  + Math.random()*8;
      this.h  = 5  + Math.random()*5;
      this.vx = (Math.random()-.5)*4;
      this.vy = 3  + Math.random()*5;
      this.rot= Math.random()*Math.PI*2;
      this.drot=(.04+Math.random()*.06)*(Math.random()>.5?1:-1);
      this.hue= Math.floor(Math.random()*360);
      this.alpha=1;
    }
    update() {
      this.x  +=this.vx; this.y+=this.vy;
      this.vx *=0.99;    this.rot+=this.drot;
      if (this.y > cvs.height+20) this.alpha=0;
    }
    draw() {
      ctx.save();
      ctx.globalAlpha=this.alpha*0.9;
      ctx.translate(this.x,this.y);
      ctx.rotate(this.rot);
      ctx.fillStyle=`hsl(${this.hue},90%,65%)`;
      ctx.fillRect(-this.w/2,-this.h/2,this.w,this.h);
      ctx.restore();
    }
  }

  // ════════════════════════════════════════════════════════
  //  LOOP ANIMASI
  // ════════════════════════════════════════════════════════
  let confettiTimer = 0;

  function loop(ts) {
    if (!overlay || !overlay.classList.contains("show")) return;

    // Fade trail (kunci efek cahaya berekor)
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    // Launch roket tiap 320ms
    if (ts - lastLaunch > 320) {
      allRockets.push(new Rocket());
      lastLaunch = ts;
    }

    // Confetti terus keluar
    if (ts - confettiTimer > 40) {
      for (let i=0;i<4;i++) allConfetti.push(new Confetti());
      confettiTimer = ts;
    }

    // Update & draw
    for (let i=allRockets.length-1;i>=0;i--) {
      allRockets[i].update(); allRockets[i].draw();
      if (allRockets[i].done && allRockets[i].y>cvs.height+100) allRockets.splice(i,1);
    }
    for (let i=allParticles.length-1;i>=0;i--) {
      allParticles[i].update(); allParticles[i].draw();
      if (allParticles[i].alpha<=0) allParticles.splice(i,1);
    }
    for (let i=allConfetti.length-1;i>=0;i--) {
      allConfetti[i].update(); allConfetti[i].draw();
      if (allConfetti[i].alpha<=0) allConfetti.splice(i,1);
    }

    animId = requestAnimationFrame(loop);
  }

  // ════════════════════════════════════════════════════════
  //  AUDIO — Suara petasan + fanfare (Web Audio)
  // ════════════════════════════════════════════════════════
  function playSound() {
    try {
      const A   = new (window.AudioContext || window.webkitAudioContext)();
      const now = A.currentTime;

      // Whistle naik
      function whistle(t, dur) {
        const o=A.createOscillator(), g=A.createGain();
        o.connect(g); g.connect(A.destination);
        o.type='sine';
        o.frequency.setValueAtTime(280,t);
        o.frequency.exponentialRampToValueAtTime(1600,t+dur*.9);
        g.gain.setValueAtTime(.16,t);
        g.gain.exponentialRampToValueAtTime(.001,t+dur);
        o.start(t); o.stop(t+dur);
      }
      // Ledakan noise
      function boom(t, vol=0.7) {
        const buf=A.createBuffer(1,A.sampleRate*.55,A.sampleRate);
        const d=buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.6);
        const src=A.createBufferSource(), g=A.createGain();
        g.gain.setValueAtTime(vol,t);
        g.gain.exponentialRampToValueAtTime(.001,t+.55);
        src.buffer=buf; src.connect(g); g.connect(A.destination); src.start(t);
      }
      // Shimmer glitter (high-freq noise singkat)
      function shimmer(t) {
        const buf=A.createBuffer(1,A.sampleRate*.15,A.sampleRate);
        const d=buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);
        const src=A.createBufferSource(), bpf=A.createBiquadFilter(), g=A.createGain();
        bpf.type='bandpass'; bpf.frequency.value=6000; bpf.Q.value=1;
        src.buffer=buf; src.connect(bpf); bpf.connect(g); g.connect(A.destination);
        g.gain.setValueAtTime(.3,t); g.gain.exponentialRampToValueAtTime(.001,t+.15);
        src.start(t);
      }
      // Not musik
      function note(freq,t,dur,type='triangle',vol=.18) {
        const o=A.createOscillator(), g=A.createGain();
        o.connect(g); g.connect(A.destination);
        o.type=type; o.frequency.value=freq;
        g.gain.setValueAtTime(vol,t);
        g.gain.exponentialRampToValueAtTime(.001,t+dur);
        o.start(t); o.stop(t+dur);
      }

      // 4 ledakan
      whistle(now+.00, .42); boom(now+.45,.65); shimmer(now+.5);
      whistle(now+.55, .36); boom(now+.95,.55); shimmer(now+1.0);
      whistle(now+1.05,.30); boom(now+1.38,.5); shimmer(now+1.42);
      whistle(now+1.55,.25); boom(now+1.83,.6); shimmer(now+1.88);

      // Fanfare meriah
      const melody=[
        [523,.12],[659,.12],[784,.12],[1047,.24],
        [880,.10],[1047,.10],[784,.10],[1047,.10],[1175,.28],
      ];
      let t=now+2.0;
      melody.forEach(([f,d])=>{ note(f,t,d+.1,'triangle',.2); t+=d; });
      // Chord penutup
      [523,659,784,1047,1319].forEach(f=>note(f,t+.1,.8,'triangle',.12));

    } catch(_) {}
  }

  // ════════════════════════════════════════════════════════
  //  FORMAT RUPIAH
  // ════════════════════════════════════════════════════════
  function fmtRp(n) {
    if (n>=1_000_000) return `Rp ${+(n/1_000_000).toFixed(1)} juta`;
    if (n>=1_000)     return `Rp ${Math.floor(n/1_000)} ribu`;
    return `Rp ${n}`;
  }

  // ════════════════════════════════════════════════════════
  //  SHOW / HIDE
  // ════════════════════════════════════════════════════════
  function show(donation) {
    inject();

    document.getElementById("donWho").textContent = `🎉 ${donation.name} baru saja donasi!`;
    document.getElementById("donAmt").textContent = fmtRp(donation.amount||0);
    const msgEl = document.getElementById("donMsg");
    if (donation.message) {
      msgEl.textContent = `"${donation.message}"`;
      msgEl.style.display = "";
    } else { msgEl.style.display = "none"; }

    cvs.width  = window.innerWidth;
    cvs.height = window.innerHeight;
    allRockets.length = allParticles.length = allConfetti.length = 0;
    cancelAnimationFrame(animId);
    ctx.clearRect(0,0,cvs.width,cvs.height);

    overlay.classList.add("show");
    lastLaunch = 0; confettiTimer = 0;
    animId = requestAnimationFrame(loop);
    playSound();

    clearInterval(cdId);
    let s = 14;
    const timerEl = document.getElementById("donTimer");
    timerEl.textContent = `Menutup dalam ${s}s`;
    cdId = setInterval(()=>{
      s--;
      timerEl.textContent = `Menutup dalam ${s}s`;
      if (s<=0) { clearInterval(cdId); hide(); }
    },1000);
  }

  function hide() {
    if (!overlay) return;
    overlay.classList.remove("show");
    clearInterval(cdId);
    cancelAnimationFrame(animId);
    if (ctx) ctx.clearRect(0,0,cvs.width,cvs.height);
  }

  // ════════════════════════════════════════════════════════
  //  SOCKET & FLOATING BUTTON
  // ════════════════════════════════════════════════════════
  _sock.on("new-donation", show);

  document.addEventListener("DOMContentLoaded", ()=>{
    if (document.querySelector(".layout")) {   // hanya di room.html
      const fb = document.createElement("a");
      fb.href=SAWERIA; fb.target="_blank"; fb.rel="noopener";
      fb.className="float-donate"; fb.title="Dukung Ruang Pacaran ☕";
      fb.textContent="☕"; document.body.appendChild(fb);
    }
  });

  // Test via console — kirim ke SEMUA pengunjung lewat server
  window._testDonasi = async (name, amount, message) => {
    await fetch("/api/test-donation",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        name:    name    || "Test Donatur",
        amount:  amount  || 75000,
        message: message || "Website ini keren banget! 🎉",
      }),
    });
    console.log("✅ Test donasi dikirim ke semua pengunjung!");
  };

})();
