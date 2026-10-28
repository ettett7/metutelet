/* המטוטלת · engine: visuals, sound, voice */
(function () {
  "use strict";
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const hex = h => { h = String(h).replace("#", "").trim(); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const reduced = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();

  const css = getComputedStyle(document.documentElement);
  const tok = (n, fb) => (css.getPropertyValue(n) || "").trim() || fb;
  const C = {
    night: hex(tok("--night", "#100d1f")),
    dusk: hex(tok("--dusk", "#1b1631")),
    mist: hex(tok("--mist", "#ece6fa")),
    ember: hex(tok("--ember", "#ffb45e")),
    hot: hex(tok("--ember-hot", "#ffd9a3")),
    deep: [5, 4, 11]
  };

  /* ================= visuals ================= */
  class Stage {
    constructor(canvas, opts) {
      opts = opts || {};
      this.c = canvas; this.x = canvas.getContext("2d"); this.mini = !!opts.mini;
      this.visual = "dot"; this.motion = "pendulum";
      this.ph = 0; this.period = 3.2; this.periodT = 3.2; this.amp = .9; this.ampT = .9;
      this.depth = .1; this.depthT = .1; this.dim = 0; this.dimT = 0; this.lift = 0; this.liftT = 0;
      this.accent = C.ember; this.accentT = C.ember;
      this.spiral = false; this.spiralA = 0; this.rot = 0; this.tz = 0;
      this.breathMode = "auto"; this.bFrom = .5; this.bTo = .5; this.bStart = 0; this.bDur = 1; this.breath = .5;
      this.trail = []; this.parts = null; this.onTick = null; this.lastHalf = null; this.clock = 0;
      this.resize();
    }
    resize() {
      const r = this.c.getBoundingClientRect(); const d = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.c.width = Math.round(this.w * d); this.c.height = Math.round(this.h * d);
      this.x.setTransform(d, 0, 0, d, 0, 0); this.trail.length = 0; this.parts = null;
    }
    setAccent(hexColor, instant) { this.accentT = hex(hexColor); if (instant) this.accent = this.accentT.slice(); }
    breathTo(v, secs) { this.breathMode = "tween"; this.bFrom = this.breath; this.bTo = v; this.bStart = this.clock; this.bDur = Math.max(.1, secs); }
    breathAuto() { this.breathMode = "auto"; }
    center() { return { cx: this.w / 2, cy: this.h * (this.mini ? .5 : .42) - this.lift * this.h * .3 }; }
    step(dt) {
      this.clock += dt;
      const k = 1 - Math.exp(-dt / 2.5), kd = 1 - Math.exp(-dt / 4), kf = 1 - Math.exp(-dt / 1.2);
      this.period += (this.periodT - this.period) * k;
      this.amp += (this.ampT - this.amp) * k;
      this.depth += (this.depthT - this.depth) * kd;
      this.dim += (this.dimT - this.dim) * (1 - Math.exp(-dt / (this.dimT > this.dim ? 6 : 1.5)));
      this.lift += (this.liftT - this.lift) * kf;
      this.accent = mix(this.accent, this.accentT, kf);
      this.spiralA += ((this.spiral ? 1 : 0) - this.spiralA) * kf;
      this.ph += dt * TAU / this.period;
      const slow = (1 - this.depth * .55) * (reduced ? .35 : 1);
      this.rot += dt * .11 * slow;
      this.tz += dt * .22 * slow;
      if (this.breathMode === "tween") {
        const t = clamp((this.clock - this.bStart) / this.bDur, 0, 1);
        this.breath = this.bFrom + (this.bTo - this.bFrom) * ease(t);
      } else {
        const target = .5 + .3 * Math.sin(this.clock * TAU / 9);
        this.breath += (target - this.breath) * (1 - Math.exp(-dt / 1.5));
      }
      const half = Math.floor((this.ph + Math.PI / 2) / Math.PI);
      if (this.lastHalf !== null && half !== this.lastHalf && this.onTick) this.onTick(half % 2 ? .45 : -.45);
      this.lastHalf = half;
    }
    ground(cx, cy, R) {
      const ctx = this.x, d = this.depth;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, rgba(mix(mix(C.dusk, this.accent, .1), C.night, d * .55), 1));
      g.addColorStop(1, rgba(mix(C.night, C.deep, .35 + d * .5), 1));
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    }
    glowDot(x, y, sc) {
      const ctx = this.x, br = this.breath, gr = (46 + 50 * br) * sc;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, gr);
      gg.addColorStop(0, rgba(this.accent, .55)); gg.addColorStop(.35, rgba(this.accent, .17)); gg.addColorStop(1, rgba(this.accent, 0));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, gr, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(mix(this.accent, [255, 255, 255], .55), 1); ctx.beginPath(); ctx.arc(x, y, (7 + 3.5 * br) * sc, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(x, y, (2.6 + 1.2 * br) * sc, 0, TAU); ctx.fill();
    }
    drawSpiral(cx, cy, R, strength) {
      const ctx = this.x; const maxT = 5 * TAU; const b = R / maxT; const band = b * Math.PI * .5;
      const a0 = strength * (1 - this.depth * .35);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, rgba(C.mist, 0)); g.addColorStop(.08, rgba(C.mist, 0));
      g.addColorStop(.35, rgba(C.mist, a0)); g.addColorStop(1, rgba(C.mist, a0 * .6));
      ctx.fillStyle = g;
      for (let arm = 0; arm < 2; arm++) {
        const off = this.rot * 2.2 + arm * Math.PI;
        ctx.beginPath();
        for (let t = 0; t <= maxT; t += .09) { const r = b * t, an = t + off; ctx.lineTo(cx + r * Math.cos(an), cy + r * Math.sin(an)); }
        for (let t = maxT; t >= 0; t -= .09) { const r = Math.max(0, b * t - band), an = t + off; ctx.lineTo(cx + r * Math.cos(an), cy + r * Math.sin(an)); }
        ctx.closePath(); ctx.fill();
      }
    }
    dotPos(cx, cy) {
      const { w, h, mini } = this; const s = Math.sin(this.ph), a = this.amp;
      if (this.motion === "eight") {
        const ax = Math.min(w * .34, h * (mini ? .5 : .42)); const ay = Math.min(ax * .5, h * (mini ? .26 : .17));
        return { x: cx + ax * a * s, y: cy + ay * a * Math.sin(2 * this.ph) };
      }
      if (this.motion === "circle") {
        const r = Math.min(w * .3, h * (mini ? .3 : .2)) * a;
        return { x: cx + r * Math.sin(this.ph), y: cy - r * Math.cos(this.ph) };
      }
      const L = h * (mini ? .8 : .7); const py = cy - L; const maxX = Math.min(w * .36, L * .62);
      const th = Math.asin(maxX / L) * a * s;
      return { x: cx + L * Math.sin(th), y: py + L * Math.cos(th), px: cx, py };
    }
    draw() {
      const ctx = this.x, w = this.w, h = this.h; const { cx, cy } = this.center();
      const R = Math.hypot(w, h) * .62;
      const sc = this.mini ? .72 : clamp(Math.min(w, h) / 800, .8, 1.3);
      this.ground(cx, cy, R);
      const v = this.visual;
      if (v === "dot") this.drawDot(cx, cy, R, sc);
      else if (v === "spiral") { this.drawSpiral(cx, cy, R, .13); this.glowDot(cx, cy, sc); }
      else if (v === "tunnel") this.drawTunnel(cx, cy, R, sc);
      else if (v === "mandala") this.drawMandala(cx, cy, sc);
      else if (v === "orb") this.drawOrb(cx, cy, sc);
      else if (v === "galaxy") this.drawGalaxy(cx, cy, R, sc);
      if (this.dim > .002) { ctx.fillStyle = rgba(C.night, clamp(this.dim, 0, 1)); ctx.fillRect(0, 0, w, h); }
    }
    drawDot(cx, cy, R, sc) {
      const ctx = this.x;
      if (this.spiralA > .01) this.drawSpiral(cx, cy, R, .05 * this.spiralA);
      const p = this.dotPos(cx, cy);
      if (this.motion === "pendulum") {
        ctx.strokeStyle = rgba(C.mist, .12); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      this.trail.push([p.x, p.y]);
      const maxT = reduced ? 6 : (this.mini ? 12 : 20);
      while (this.trail.length > maxT) this.trail.shift();
      for (let i = 0; i < this.trail.length - 1; i++) {
        const t = i / this.trail.length, q = this.trail[i];
        ctx.fillStyle = rgba(this.accent, .1 * t); ctx.beginPath(); ctx.arc(q[0], q[1], (4 + 6 * t) * sc, 0, TAU); ctx.fill();
      }
      this.glowDot(p.x, p.y, sc);
    }
    drawTunnel(cx, cy, R, sc) {
      const ctx = this.x, N = this.mini ? 12 : 18;
      const ox = cx + this.w * .035 * Math.sin(this.clock * .31), oy = cy + this.h * .03 * Math.sin(this.clock * .23);
      const f = this.tz % 1;
      for (let i = N - 1; i >= 0; i--) {
        const z = (i + f) / N; const r = R * z * z * 1.05;
        if (r < 2) continue;
        const ix = cx + (ox - cx) * (1 - z), iy = cy + (oy - cy) * (1 - z);
        const a = Math.sin(Math.PI * z) * .26 * (1 - this.depth * .3);
        const isAcc = ((i + Math.floor(this.tz)) % 4) === 0;
        ctx.strokeStyle = isAcc ? rgba(this.accent, a * 1.2) : rgba(C.mist, a * .7);
        ctx.lineWidth = (1 + z * 5) * sc;
        ctx.beginPath(); ctx.ellipse(ix, iy, r, r * .9, 0, 0, TAU); ctx.stroke();
      }
      this.glowDot(ox, oy, sc * .85);
    }
    drawMandala(cx, cy, sc) {
      const ctx = this.x, br = this.breath; const base = Math.min(this.w, this.h) * (this.mini ? .36 : .3);
      ctx.save(); ctx.translate(cx, cy); ctx.globalCompositeOperation = "lighter";
      const layers = [[12, base * (.55 + .12 * br), base * .34, this.rot * 1.6, .3], [8, base * (.9 + .1 * br), base * .5, -this.rot * 1.1, .16], [16, base * (.28 + .1 * br), base * .16, -this.rot * 2.4, .4]];
      for (const [n, dist, len, rot, a] of layers) {
        for (let i = 0; i < n; i++) {
          ctx.save(); ctx.rotate(rot + i * TAU / n); ctx.translate(dist * .5, 0);
          ctx.beginPath(); ctx.ellipse(0, 0, len, len * .26, 0, 0, TAU);
          ctx.fillStyle = rgba(this.accent, a * .14); ctx.fill();
          ctx.strokeStyle = rgba(i % 2 ? C.mist : this.accent, a * (1 - this.depth * .3)); ctx.lineWidth = 1.2 * sc; ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore(); ctx.globalCompositeOperation = "source-over";
      this.glowDot(cx, cy, sc * .8);
    }
    drawOrb(cx, cy, sc) {
      const ctx = this.x, br = this.breath; const base = Math.min(this.w, this.h) * (this.mini ? .3 : .22);
      const r = base * (.55 + .45 * br);
      for (let k = 0; k < 3; k++) {
        const t = ((this.clock * .12) + k / 3) % 1; const rr = r * (1.1 + t * 1.3);
        ctx.strokeStyle = rgba(this.accent, .22 * (1 - t) * (1 - this.depth * .3)); ctx.lineWidth = 1.5 * sc;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
      }
      const g = this.x.createRadialGradient(cx, cy - r * .2, r * .05, cx, cy, r);
      g.addColorStop(0, rgba(mix(this.accent, [255, 255, 255], .45), .9));
      g.addColorStop(.55, rgba(this.accent, .45)); g.addColorStop(1, rgba(this.accent, .05));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      const halo = ctx.createRadialGradient(cx, cy, r * .8, cx, cy, r * 2.2);
      halo.addColorStop(0, rgba(this.accent, .16)); halo.addColorStop(1, rgba(this.accent, 0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, TAU); ctx.fill();
    }
    drawGalaxy(cx, cy, R, sc) {
      const ctx = this.x, n = this.mini ? 170 : (this.w < 600 ? 300 : 440), maxR = Math.min(R * .95, Math.max(this.w, this.h) * .7);
      if (!this.parts || this.parts.length !== n) {
        this.parts = [];
        for (let i = 0; i < n; i++) this.parts.push(this.spawn(maxR, Math.random()));
      }
      const slow = (1 - this.depth * .5) * (reduced ? .35 : 1);
      const dt = this._dt || .016;
      ctx.lineCap = "round";
      for (const p of this.parts) {
        const px = cx + p.r * Math.cos(p.a), py = cy + p.r * Math.sin(p.a) * .82;
        p.a += dt * slow * (38 / (p.r + 30)) * p.s;
        p.r -= dt * slow * (5 + 900 / (p.r + 60)) * p.s;
        if (p.r < 6) Object.assign(p, this.spawn(maxR, 1));
        const nx = cx + p.r * Math.cos(p.a), ny = cy + p.r * Math.sin(p.a) * .82;
        const t = clamp(1 - p.r / maxR, 0, 1);
        ctx.strokeStyle = rgba(mix(C.mist, this.accent, t), (.12 + .55 * t) * p.b);
        ctx.lineWidth = (.8 + p.z * 1.6) * sc;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      }
      this.glowDot(cx, cy, sc * .9);
    }
    spawn(maxR, edge) {
      const arm = Math.random() < .5 ? 0 : Math.PI; const r = maxR * (edge >= 1 ? (.75 + Math.random() * .25) : (.08 + Math.random() * .92));
      return { r, a: arm + r * .012 + (Math.random() - .5) * .9, s: .6 + Math.random() * .8, z: Math.random(), b: .5 + Math.random() * .5 };
    }
    frame(dt) { this._dt = dt; this.step(dt); this.draw(); }
  }

  /* ================= sound ================= */
  const Sound = {
    ac: null, master: null, sess: null, noiseBuf: null, vol: .8,
    ensure() {
      if (this.ac) return this.ac;
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
        this.ac = new AC(); this.master = this.ac.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ac.destination);
      } catch (e) { this.ac = null; }
      return this.ac;
    },
    unlock() {
      const ac = this.ensure(); if (!ac) return;
      try { ac.resume(); const b = ac.createBuffer(1, 1, 22050); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) {}
    },
    setVolume(v) { this.vol = v; if (this.master) try { this.master.gain.setTargetAtTime(v, this.ac.currentTime, .1); } catch (e) {} },
    noise() {
      if (this.noiseBuf) return this.noiseBuf;
      const ac = this.ac, len = ac.sampleRate * 6, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
        b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
      }
      const fade = Math.floor(ac.sampleRate * .05);
      for (let i = 0; i < fade; i++) { const t = i / fade; d[i] *= t; d[len - 1 - i] *= t; }
      return (this.noiseBuf = buf);
    },
    /* opts: {band:'delta'|'theta'|'alpha'|'off', amb:'rain'|'waves'|'wind'|'pad'|'none'} */
    start(opts) {
      this.stop(.3);
      const ac = this.ensure(); if (!ac) return;
      try { ac.resume(); } catch (e) {}
      const t0 = ac.currentTime; const out = ac.createGain(); out.gain.setValueAtTime(0, t0); out.connect(this.master);
      const srcs = []; const S = { out, srcs };
      const lfo = (freq, depth, param) => { const o = ac.createOscillator(); o.frequency.value = freq; const g = ac.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start(); srcs.push(o); };
      try {
        const beat = { delta: 2.5, theta: 6, alpha: 10 }[opts.band];
        if (beat) {
          const merger = ac.createChannelMerger(2); const bg = ac.createGain(); bg.gain.value = .32; merger.connect(bg); bg.connect(out);
          const carrier = opts.band === "delta" ? 110 : 136.1;
          [[carrier, 0], [carrier + beat, 1]].forEach(([f, ch]) => { const o = ac.createOscillator(); o.frequency.value = f; const g = ac.createGain(); g.gain.value = .5; o.connect(g); g.connect(merger, 0, ch); o.start(); srcs.push(o); });
        }
        if (opts.amb === "pad") {
          const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = 68;
          const o2 = ac.createOscillator(); o2.type = "sine"; o2.frequency.value = 102.3;
          const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
          const g = ac.createGain(); g.gain.value = .3;
          o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out); o.start(); o2.start(); srcs.push(o, o2);
          lfo(.1, .12, g.gain);
        } else if (opts.amb === "rain" || opts.amb === "waves" || opts.amb === "wind") {
          const src = ac.createBufferSource(); src.buffer = this.noise(); src.loop = true;
          const g = ac.createGain();
          if (opts.amb === "rain") {
            const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 500;
            const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6500;
            g.gain.value = .9; src.connect(hp); hp.connect(lp); lp.connect(g); lfo(.05, 1200, lp.frequency);
          } else if (opts.amb === "waves") {
            const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 650; lp.Q.value = .4;
            g.gain.value = .55; src.connect(lp); lp.connect(g); lfo(.075, 420, lp.frequency); lfo(.075, .42, g.gain);
          } else {
            const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = .9;
            g.gain.value = .75; src.connect(bp); bp.connect(g); lfo(.047, 320, bp.frequency); lfo(.031, .3, g.gain);
          }
          g.connect(out); src.start(); srcs.push(src);
        }
      } catch (e) {}
      this.sess = S; this.level(.9, 5);
    },
    level(v, secs) {
      const S = this.sess; if (!S || !this.ac) return;
      try { const g = S.out.gain, t = this.ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + (secs || 3)); } catch (e) {}
    },
    stop(secs) {
      const S = this.sess; if (!S || !this.ac) return; this.sess = null;
      const ac = this.ac, s = secs || .8;
      try { const g = S.out.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + s); } catch (e) {}
      setTimeout(() => { S.srcs.forEach(o => { try { o.stop(); } catch (e) {} }); try { S.out.disconnect(); } catch (e) {} }, s * 1000 + 200);
    },
    tick(vol, pan) {
      const ac = this.ac; if (!ac || ac.state !== "running") return;
      try {
        const t = ac.currentTime; const o = ac.createOscillator(); o.type = "triangle";
        o.frequency.setValueAtTime(1150, t); o.frequency.exponentialRampToValueAtTime(700, t + .06);
        const g = ac.createGain(); g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(.05 * vol, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .09);
        o.connect(g);
        if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); p.connect(this.master); } else g.connect(this.master);
        o.start(t); o.stop(t + .1);
      } catch (e) {}
    },
    chime(vol) {
      const ac = this.ac; if (!ac || ac.state !== "running") return;
      try {
        const t = ac.currentTime;
        [[528, .07], [792, .045], [1056, .025]].forEach(([f, a]) => {
          const o = ac.createOscillator(); o.frequency.value = f; const g = ac.createGain();
          g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(a * (vol || 1), t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + 3.2);
          o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 3.3);
        });
      } catch (e) {}
    },
    suspend() { try { this.ac && this.ac.suspend(); } catch (e) {} },
    resume() { try { this.ac && this.ac.resume(); } catch (e) {} }
  };

  /* ================= voice ================= */
  const Voice = {
    v: null, list: [], token: 0, cur: null, rate: .82, pitch: .92, wanted: null,
    supported: "speechSynthesis" in window,
    init(cb) {
      if (!this.supported) { cb(null, true); return; }
      const pick = final => {
        let vs = []; try { vs = speechSynthesis.getVoices() || []; } catch (e) {}
        const he = vs.filter(v => /^(he|iw)([-_]|$)/i.test(v.lang || ""));
        this.list = he;
        const v = (this.wanted && he.find(x => x.name === this.wanted)) || he.find(x => /premium|enhanced|משופר/i.test(x.name)) || he.find(x => x.localService) || he[0] || null;
        if (v || final) { this.v = v; cb(v, final); }
      };
      pick(false);
      try { speechSynthesis.addEventListener("voiceschanged", () => pick(false)); } catch (e) { try { speechSynthesis.onvoiceschanged = () => pick(false); } catch (e2) {} }
      setTimeout(() => pick(true), 1800);
    },
    choose(name) { this.wanted = name; const v = this.list.find(x => x.name === name); if (v) this.v = v; },
    speak(text, done, opts) {
      opts = opts || {};
      const id = ++this.token; let fin = false;
      const end = () => { if (fin) return; fin = true; if (id === this.token && done) done(); };
      if (!this.v || !text) { end(); return; }
      try {
        if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.voice = this.v; u.lang = this.v.lang; u.rate = opts.rate || this.rate; u.pitch = this.pitch; u.volume = opts.vol != null ? opts.vol : 1;
        u.onend = end; u.onerror = end; this.cur = u;
        speechSynthesis.speak(u);
      } catch (e) { end(); return; }
      setTimeout(end, 3500 + text.length * 170 / (this.rate / .82));
    },
    stop() { this.token++; try { speechSynthesis.cancel(); } catch (e) {} }
  };

  window.MT = { Stage, Sound, Voice, C, hex, rgba, mix, clamp, reduced };
})();
