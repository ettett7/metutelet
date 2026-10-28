/* המטוטלת · app: screens, sessions, journal, voice recordings */
(function () {
  "use strict";
  const { Stage, Sound, Voice, reduced } = MT;
  const D = MTC;
  const APP_URL = "https://ettett7.github.io/metutelet/";
  const VERSION = "2.0";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = !!(navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches));
  const touch = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);
  const DAY = 864e5;

  document.documentElement.lang = "he";
  document.documentElement.dir = "rtl";

  /* ================= state ================= */
  const KEY = "metutelet.v2";
  const fresh = () => ({ v: 2, onboarded: false, gender: "m", voiceOn: true, voiceName: null, rate: .82, vol: .8, ticks: true, calm: false, myVoice: true, mine: "", prefs: {}, journal: [], tests: {}, journey: {}, hideInstall: false });
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    if (!s) {
      try { const o = JSON.parse(localStorage.getItem("metutelet.v1") || "null"); if (o) s = { gender: o.gender === "f" ? "f" : "m", mine: typeof o.sugs === "string" ? o.sugs : "" }; } catch (e) {}
    }
    const out = Object.assign(fresh(), s || {});
    if (!Array.isArray(out.journal)) out.journal = [];
    return out;
  }
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  const G = (m, f) => S.gender === "f" ? f : m;
  const exampleText = () => D.EXAMPLES[S.gender].join("\n");
  const isExample = t => { t = (t || "").trim(); return !t || t === D.EXAMPLES.m.join("\n") || t === D.EXAMPLES.f.join("\n"); };
  const mineText = () => isExample(S.mine) ? exampleText() : S.mine;
  const myLines = () => mineText().split("\n").map(s => s.trim()).filter(Boolean);

  const progById = id => D.PROGRAMS.find(p => p.id === id) || D.PROGRAMS[0];
  function testState() {
    const ids = D.TESTS.map(t => t.id); const done = ids.filter(id => S.tests[id] != null);
    const sum = done.reduce((a, id) => a + S.tests[id], 0);
    return { done: done.length, all: ids.length, sum, label: done.length === ids.length ? D.scoreLabel(sum, ids.length) : null };
  }
  function cfgFor(p, over) {
    const pr = Object.assign({}, S.prefs[p.id] || {}, over || {});
    const ts = testState(); const low = ts.label && ts.label.level !== "גבוהה" && ts.label.level !== "בינונית";
    const pick = (k, d) => pr[k] != null ? pr[k] : d;
    const tailored = low && pr.induction == null && !p.quick && (p.induction === "eyeroll" || p.induction === "fixation");
    return {
      len: pick("len", p.len), visual: pick("visual", p.visual), motion: pick("motion", p.motion),
      induction: pick("induction", tailored ? "relax" : p.induction), deepener: pick("deepener", p.deepener),
      ending: pick("ending", p.ending), band: pick("band", p.band), amb: pick("amb", p.amb),
      useMine: pick("useMine", !!p.mine), ego: pick("ego", !p.quick), anchor: pick("anchor", !!p.anchor),
      sleepSugs: pick("sleepSugs", !low), tailored
    };
  }
  const voiceReady = () => S.voiceOn && !!Voice.v;
  function stepsFor(p, c) {
    const prog = (c.ending === "sleep" && !c.sleepSugs) ? Object.assign({}, p, { sugs: () => [], imagery: null }) : p;
    return D.build(Object.assign({}, c, { program: prog, gender: S.gender, voice: voiceReady(), sugs: myLines() }));
  }
  const msOf = st => st.reduce((a, s) => a + s.dur, 0);
  const minsOf = st => Math.max(1, Math.round(msOf(st) / 60000));

  /* ================= dates & journal ================= */
  const dayKey = t => { const d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
  const fmtDay = t => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(new Date(t));
  const fmtWhen = t => new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t));
  const fmtClock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const plural = (n, one, many) => n === 1 ? one : `${n} ${many}`;
  function streaks() {
    const days = new Set(S.journal.map(e => dayKey(e.t)));
    let cur = 0; let d = new Date(); d.setHours(12, 0, 0, 0);
    if (!days.has(dayKey(d))) d = new Date(d.getTime() - DAY);
    while (days.has(dayKey(d))) { cur++; d = new Date(d.getTime() - DAY); }
    const sorted = Array.from(days).map(k => { const [y, m, dd] = k.split("-").map(Number); return new Date(y, m - 1, dd, 12).getTime(); }).sort((a, b) => a - b);
    let best = 0, run = 0, prev = null;
    for (const t of sorted) { run = (prev && Math.round((t - prev) / DAY) === 1) ? run + 1 : 1; best = Math.max(best, run); prev = t; }
    return { cur, best };
  }
  function stats() {
    const J = S.journal; const rated = J.filter(e => e.before != null && e.after != null);
    const drop = rated.length ? rated.reduce((a, e) => a + (e.before - e.after), 0) / rated.length : null;
    return { n: J.length, min: J.reduce((a, e) => a + (e.min || 0), 0), drop, rated };
  }

  /* ================= recordings ================= */
  const Rec = {
    db: null, blobs: new Map(), bufs: new Map(), cur: null, tok: 0,
    open() {
      return new Promise(res => {
        if (this.db) return res(this.db);
        try {
          const r = indexedDB.open("metutelet", 1);
          r.onupgradeneeded = () => r.result.createObjectStore("rec");
          r.onsuccess = () => { this.db = r.result; res(this.db); };
          r.onerror = () => res(null);
        } catch (e) { res(null); }
      });
    },
    async init() {
      const db = await this.open(); if (!db) return;
      await new Promise(res => {
        try {
          const req = db.transaction("rec").objectStore("rec").openCursor();
          req.onsuccess = () => { const c = req.result; if (c) { this.blobs.set(c.key, c.value); c.continue(); } else res(); };
          req.onerror = () => res();
        } catch (e) { res(); }
      });
    },
    async put(k, blob) { this.blobs.set(k, blob); this.bufs.delete(k); const db = await this.open(); if (db) try { db.transaction("rec", "readwrite").objectStore("rec").put(blob, k); } catch (e) {} },
    async del(k) { this.blobs.delete(k); this.bufs.delete(k); const db = await this.open(); if (db) try { db.transaction("rec", "readwrite").objectStore("rec").delete(k); } catch (e) {} },
    async clear() { this.blobs.clear(); this.bufs.clear(); const db = await this.open(); if (db) try { db.transaction("rec", "readwrite").objectStore("rec").clear(); } catch (e) {} },
    count() { return myLines().filter(l => this.blobs.has(l)).length; },
    async prepare(lines) {
      const ac = Sound.ensure(); if (!ac) return;
      for (const t of lines) {
        if (!this.blobs.has(t) || this.bufs.has(t)) continue;
        try {
          const ab = await this.blobs.get(t).arrayBuffer();
          const buf = await new Promise((ok, no) => { const pr = ac.decodeAudioData(ab, ok, no); if (pr && pr.then) pr.then(ok, no); });
          this.bufs.set(t, buf);
        } catch (e) {}
      }
    },
    play(k, done) {
      const ac = Sound.ac, buf = this.bufs.get(k); if (!ac || !buf) return false;
      try {
        const tok = ++this.tok; const src = ac.createBufferSource(); src.buffer = buf;
        const g = ac.createGain(); g.gain.value = 1.3; src.connect(g); g.connect(Sound.master);
        src.onended = () => { if (tok === this.tok) { this.cur = null; done(); } };
        src.start(); this.cur = src; return true;
      } catch (e) { return false; }
    },
    stop() { this.tok++; try { this.cur && this.cur.stop(); } catch (e) {} this.cur = null; }
  };
  const Mic = {
    rec: null, stream: null, key: null, chunks: [],
    supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },
    async start(key, onDone) {
      if (!this.supported()) { toast(inFrame ? "בתצוגה הזו אין מיקרופון. ההקלטה עובדת באפליקציה המותקנת." : "הדפדפן הזה לא תומך בהקלטה."); return false; }
      try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (e) { toast(inFrame ? "בתצוגה הזו אין מיקרופון. ההקלטה עובדת באפליקציה המותקנת." : "אין גישה למיקרופון. צריך לאשר אותה בהגדרות."); return false; }
      let type = "";
      try { type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || ""; } catch (e) {}
      try { this.rec = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined); }
      catch (e) { this.release(); toast("ההקלטה לא נתמכת כאן."); return false; }
      this.key = key; this.chunks = [];
      const rec = this.rec;
      rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(this.chunks, { type: rec.mimeType || type || "audio/mp4" });
        this.release(); this.rec = null;
        if (blob.size > 800) await Rec.put(this.key, blob);
        this.key = null; onDone && onDone();
      };
      rec.start(); return true;
    },
    stop() { try { if (this.rec && this.rec.state !== "inactive") this.rec.stop(); } catch (e) {} },
    release() { try { this.stream && this.stream.getTracks().forEach(t => t.stop()); } catch (e) {} this.stream = null; }
  };

  /* ================= previews & loop ================= */
  const previews = new Map();
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { const st = previews.get(e.target); if (st) st.visible = e.isIntersecting; })) : null;
  const ro = "ResizeObserver" in window ? new ResizeObserver(es => es.forEach(e => { const st = previews.get(e.target); if (st) st.resize(); })) : null;
  function lookOn(st, l) {
    st.visual = l.visual; st.motion = l.motion || "pendulum"; st.spiral = l.visual === "dot";
    if (l.hue) st.setAccent(l.hue, !st._init); st._init = true;
    if (l.depth != null) st.depthT = l.depth;
    st.periodT = (reduced || S.calm) ? 4.4 : 3.2;
  }
  function preview(canvas, look) {
    if (!canvas) return null;
    let st = previews.get(canvas);
    if (!st) { st = new Stage(canvas, { mini: true }); st.visible = true; previews.set(canvas, st); io && io.observe(canvas); ro && ro.observe(canvas); }
    if (look) lookOn(st, look);
    return st;
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (P.active) { P.stage._dt = dt; P.stage.step(P.paused || P.waiting ? dt * .25 : dt); update(dt); P.stage.draw(); }
    else if (!document.hidden) {
      for (const [c, st] of previews) {
        if (!c.isConnected) { previews.delete(c); io && io.unobserve(c); ro && ro.unobserve(c); continue; }
        if (st.visible === false) continue;
        st.frame(dt);
      }
    }
    requestAnimationFrame(loop);
  }

  let toastT = 0;
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 3400); }

  /* ================= icons ================= */
  const IC = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 2.5v10.5"/><circle cx="12" cy="16.5" r="3.5"/><path d="M4.5 6.5c2.1 1 4.7 1.6 7.5 1.6s5.4-.6 7.5-1.6" opacity=".45"/></svg>',
    programs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="7" cy="7" r="3.2"/><circle cx="17" cy="7" r="3.2"/><circle cx="7" cy="17" r="3.2"/><circle cx="17" cy="17" r="3.2"/></svg>',
    journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 20.5h17"/><path d="M5 16l4.5-5 4 3 5.5-7"/><circle cx="19" cy="7" r="1.2" fill="currentColor"/></svg>',
    learn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 6.5C9.8 4.8 7 4.3 3.5 4.5v14c3.5-.2 6.3.3 8.5 2 2.2-1.7 5-2.2 8.5-2v-14c-3.5-.2-6.3.3-8.5 2z"/><path d="M12 6.5v14"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12L8 17.2V6.8z"/></svg>'
  };

  /* ================= shell ================= */
  const TABS = [["home", "בית"], ["programs", "תוכניות"], ["journal", "יומן"], ["learn", "ללמוד"]];
  function shell() {
    const root = $("#app"); root.setAttribute("dir", "rtl"); root.setAttribute("lang", "he");
    root.innerHTML = `
      <header class="topbar" id="topbar"><div class="topbar-in"><div class="brand">המטוטלת<b>.</b></div><button class="iconbtn" data-act="settings" aria-label="הגדרות">${IC.gear}</button></div></header>
      <main id="view"></main>
      <nav class="nav" aria-label="ניווט ראשי"><div class="nav-in">${TABS.map(([k, n]) => `<button type="button" data-act="tab" data-t="${k}" aria-current="false">${IC[k]}<span>${n}</span></button>`).join("")}</div></nav>
      <div id="sheet" class="sheet" hidden><div class="sheet-back" data-act="close-sheet"></div><section class="sheet-panel" id="sheetPanel" role="dialog" aria-modal="true"></section></div>
      <div id="player" class="player" tabindex="-1" hidden>
        <canvas id="pstage"></canvas>
        <div class="bignum" id="pbig"></div>
        <p class="pline" id="pline" aria-live="polite"></p>
        <p class="pnote" id="pnote"></p>
        <div class="hud">
          <div class="phase" id="pphase"><i></i><i></i><i></i><i></i><span id="pphaseName"></span></div>
          <div class="ctrl"><button type="button" id="pvis" data-act="p-vis" hidden>ויזואל</button><button type="button" id="ppause" data-act="p-pause">עצירה</button><button type="button" data-act="p-exit">יציאה</button></div>
        </div>
        <div class="pclock" id="pclock" hidden></div>
        <div class="pprog" id="pprog"></div>
        <div class="pover" id="pcard" hidden></div>
      </div>
      <div id="onb" class="onb" hidden></div>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
  }

  let tab = "home";
  function go(t) {
    if (!TABS.some(x => x[0] === t)) t = "home";
    tab = t;
    $$(".nav button").forEach(b => b.setAttribute("aria-current", b.dataset.t === t ? "page" : "false"));
    render(); window.scrollTo(0, 0);
    try { history.replaceState(null, "", "#" + t); } catch (e) {}
  }
  function render() {
    const v = $("#view"); v.innerHTML = VIEWS[tab]();
    $$("canvas[data-prev]", v).forEach(c => preview(c, JSON.parse(c.dataset.look || "{}")));
    $$(".vthumb img", v).forEach(img => { const kill = () => img.remove(); if (img.complete && !img.naturalWidth) kill(); else img.addEventListener("error", kill); });
    if (tab === "journal") wireChart();
  }
  const look = (p, c) => esc(JSON.stringify({ visual: c.visual, motion: c.motion, hue: p.hue, depth: .15 }));

  /* ================= views ================= */
  const VIEWS = {};
  function recommend() {
    const h = new Date().getHours();
    if (h >= 21 || h < 4) return "sleep";
    if (h < 10) return "morning";
    if (h < 17) return S.journal.length > 2 ? "focus" : "calm";
    return "calm";
  }
  function greeting() { const h = new Date().getHours(); return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב"; }
  function statsTiles(withBest) {
    const st = streaks(), s = stats();
    const tiles = [
      [st.cur, st.cur === 1 ? "יום ברצף" : "ימים ברצף"],
      withBest ? [st.best, "הרצף הכי ארוך"] : [s.n, s.n === 1 ? "סשן" : "סשנים"],
      [s.min, s.min === 1 ? "דקת תרגול" : "דקות תרגול"],
      [s.drop == null ? "–" : (s.drop > 0 ? "−" : "") + Math.abs(s.drop).toFixed(1), "שינוי ממוצע במתח"]
    ];
    return `<div class="stats">${tiles.map(([v, l]) => `<div class="stat"><span class="v" dir="ltr" style="text-align:right">${v}</span><span class="l">${l}</span></div>`).join("")}</div>`;
  }
  function installCard() {
    if (S.hideInstall) return "";
    if (inFrame) return `<section class="card install"><b>יש גם גרסה לטלפון</b><p class="small muted">באייפון: פותחים את הקישור בספארי, לוחצים על כפתור השיתוף ובוחרים "הוספה למסך הבית".</p><p class="small"><a href="${APP_URL}" target="_blank" rel="noopener">${APP_URL.replace("https://", "")}</a></p></section>`;
    if (isIOS && !standalone) return `<section class="card install"><b>להתקנה באייפון</b><p class="small muted">כפתור השיתוף בתחתית ספארי ← "הוספה למסך הבית". האפליקציה תיפתח במסך מלא ותעבוד גם בלי אינטרנט.</p><button class="linkish small" data-act="hide-install">הבנתי</button></section>`;
    return "";
  }
  function journeyCard() {
    const next = D.JOURNEY.find(d => !S.journey[d.n]); if (!next) return "";
    const done = D.JOURNEY.filter(d => S.journey[d.n]).length;
    return `<section class="card journey"><div class="sec-head"><div><p class="eyebrow">מסע של 7 ימים · יום ${next.n}</p><h2 style="font-size:1.6rem;margin-top:4px">${next.title}</h2></div></div>
      <p class="muted small">${next.note}</p>
      <div class="jdots">${D.JOURNEY.map(d => `<i class="${S.journey[d.n] ? "done" : d.n === next.n ? "next" : ""}"></i>`).join("")}</div>
      <div class="row"><button class="btn small" data-act="day" data-n="${next.n}">${done ? "להמשיך במסע" : "להתחיל את המסע"}</button><button class="linkish small" data-act="tab" data-t="programs">כל הימים</button></div></section>`;
  }
  function testCard() {
    const ts = testState();
    if (ts.label) return `<section class="card"><p class="eyebrow">רגישות להיפנוזה</p><h2 style="font-size:1.6rem;margin:4px 0 6px">${ts.label.level}</h2><p class="muted small">${ts.label.text}</p></section>`;
    return `<section class="card"><p class="eyebrow">מבחן רגישות</p><h2 style="font-size:1.6rem;margin:4px 0 6px">שלושה תרגילי דמיון קצרים</h2><p class="muted small">שלוש דקות בסך הכול. התוצאה מכוונת איזה סשנים יתאימו לך. אין ציון נכשל.</p><div class="row" style="margin-top:10px"><button class="btn small" data-act="test" data-id="${D.TESTS.find(t => S.tests[t.id] == null).id}">להתחיל</button></div></section>`;
  }
  VIEWS.home = () => {
    const rp = progById(recommend()); const c = cfgFor(rp); const mins = minsOf(stepsFor(rp, c));
    const st = streaks();
    const date = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    const lines = myLines(); const rc = Rec.count();
    return `
      <section class="greet"><h1>${greeting()}</h1><p>${date}${st.cur ? " · " + (st.cur === 1 ? "יום ראשון ברצף" : st.cur + " ימים ברצף") : ""}</p></section>
      ${installCard()}
      <section class="hero"><canvas data-prev="hero" data-look="${look(rp, c)}"></canvas><div class="hero-body">
        <p class="eyebrow">מומלץ עכשיו</p><h2>${rp.title}</h2><p class="meta">${rp.short} · בערך ${mins} דק׳</p>
        <div class="row"><button class="btn" data-act="start" data-p="${rp.id}">מתחילים</button><button class="btn ghost" data-act="open" data-p="${rp.id}">התאמה</button></div>
      </div></section>
      <section class="quick">
        <button class="qtile" data-act="sos"><span class="orb" style="--hue:#ff9f8f"></span><b>נשימת חירום</b><span>אנחה מחזורית, דקה וחצי</span></button>
        <button class="qtile" data-act="start" data-p="reset"><span class="orb" style="--hue:#c9c1e0"></span><b>איפוס של דקה</b><span>גלגול עיניים וחזרה</span></button>
        <button class="qtile" data-act="free"><span class="orb" style="--hue:#8fa2ff"></span><b>בהייה</b><span>רק אור, תנועה וצליל</span></button>
      </section>
      ${journeyCard()}
      <section class="sec"><div class="sec-head"><h2>המספרים שלך</h2><button class="more" data-act="tab" data-t="journal">ליומן</button></div>${statsTiles(false)}</section>
      <section class="card mine-card"><div class="sec-head"><h2 style="font-size:1.55rem">המשפטים שלך</h2><button class="more" data-act="open" data-p="custom">עריכה</button></div>
        <ol>${lines.slice(0, 3).map(l => `<li>${esc(l)}</li>`).join("")}</ol>${lines.length > 3 ? `<p class="small muted">ועוד ${lines.length - 3}</p>` : ""}
        ${isExample(S.mine) ? `<p class="small muted">אלה דוגמאות. כדאי להחליף במשפטים שלך.</p>` : ""}
        <div class="row"><button class="btn small" data-act="start" data-p="custom">סשן עם המשפטים שלי</button><button class="btn small ghost" data-act="recorder">${rc ? `בקול שלך · ${rc}/${lines.length}` : "להקליט בקול שלך"}</button></div></section>
      ${testCard()}`;
  };

  VIEWS.programs = () => `
    <section class="sec"><p class="eyebrow">ספרייה</p><h1 style="font-size:2.6rem">תוכניות</h1><p class="lede">כל תוכנית היא סשן שלם: כניסה, העמקה, משפטים ויציאה. אפשר לשנות כל חלק בה.</p></section>
    <section class="pgrid">${D.PROGRAMS.map(p => { const c = cfgFor(p); return `<button class="pcard" style="--hue:${p.hue}" data-act="open" data-p="${p.id}"><span class="orb" style="--hue:${p.hue}"></span><h3>${p.title}</h3><p>${p.short}</p><span class="tags">~${minsOf(stepsFor(p, c))} דק׳ · ${D.INDUCTIONS[c.induction].name}</span></button>`; }).join("")}</section>
    <section class="sec"><div class="sec-head"><h2>מסע של 7 ימים</h2></div><p class="muted">כל יום טכניקה אחת. בסוף המסע יודעים להיכנס לבד, בכל מקום, תוך דקה.</p>
      <div class="daylist">${(() => { const next = D.JOURNEY.find(d => !S.journey[d.n]); return D.JOURNEY.map(d => { const done = !!S.journey[d.n]; const isNext = next && next.n === d.n; return `<button class="day ${done ? "done" : ""} ${isNext ? "next" : ""}" data-act="day" data-n="${d.n}"><span class="n">${d.n}</span><span class="grow"><b>${d.title}</b><span>${d.note}</span></span><span class="st">${done ? "הושלם" : isNext ? "הבא" : ""}</span></button>`; }).join(""); })()}</div></section>`;

  function chartSVG() {
    const data = S.journal.filter(e => e.before != null && e.after != null).slice(-12);
    if (!data.length) return `<p class="muted small">כשמדרגים מתח לפני סשן ואחריו, הגרף יופיע כאן.</p>`;
    const vw = ($("#view") && $("#view").clientWidth) || 360;
    const W = Math.round(Math.max(300, Math.min(680, vw - 72))), H = 236, pR = 30, pL = 14, pT = 16, pB = 30;
    const n = data.length, iw = W - pR - pL, step = iw / Math.max(n, 1);
    const y = v => pT + (10 - v) / 10 * (H - pT - pB);
    const x = i => W - pR - step * (i + .5);
    let g = "";
    [0, 5, 10].forEach(v => { g += `<line class="grid" x1="${pL}" x2="${W - pR}" y1="${y(v)}" y2="${y(v)}"/><text x="${W - pR + 10}" y="${y(v) + 4}" text-anchor="start">${v}</text>`; });
    data.forEach((e, i) => {
      const cx = x(i), yb = y(e.before), ya = y(e.after);
      g += `<rect class="hit" data-i="${i}" x="${cx - step / 2}" y="${pT}" width="${step}" height="${H - pT - pB}" rx="6"/>`;
      if (yb !== ya) g += `<line class="stem" x1="${cx}" x2="${cx}" y1="${yb}" y2="${ya}"/>`;
      g += `<circle cx="${cx}" cy="${yb}" r="5.5" style="fill:var(--before);stroke:var(--dusk);stroke-width:2"/>`;
      g += `<circle cx="${cx}" cy="${ya}" r="5.5" style="fill:var(--after);stroke:var(--dusk);stroke-width:2"/>`;
    });
    const li = n - 1, e = data[li], lx = x(li);
    if (e.before !== e.after) {
      g += `<text x="${lx - 12}" y="${y(e.before) + 4}" text-anchor="end" style="fill:var(--soft)">${e.before}</text>`;
      g += `<text x="${lx - 12}" y="${y(e.after) + 4}" text-anchor="end" style="fill:var(--soft)">${e.after}</text>`;
    }
    g += `<text x="${x(li)}" y="${H - 8}" text-anchor="middle">${fmtDay(e.t)}</text>`;
    if (n > 2) g += `<text x="${x(0)}" y="${H - 8}" text-anchor="middle">${fmtDay(data[0].t)}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="direction:ltr" role="img" aria-label="רמת מתח לפני ואחרי ${n} הסשנים האחרונים">${g}</svg><div class="tip" id="tip" hidden></div>`;
  }
  function wireChart() {
    const svg = $(".chart"); if (!svg) return;
    const data = S.journal.filter(e => e.before != null && e.after != null).slice(-12);
    const tip = $("#tip"), box = svg.parentElement;
    const show = r => {
      $$(".hit", svg).forEach(h => h.classList.toggle("hl", h === r));
      const e = data[+r.dataset.i]; if (!e) return;
      tip.innerHTML = `<b>${esc(e.title)}</b> · ${fmtDay(e.t)}<br>לפני ${e.before} · אחרי ${e.after}`;
      const rb = r.getBoundingClientRect(), bb = box.getBoundingClientRect();
      tip.hidden = false;
      const left = Math.max(tip.offsetWidth / 2 + 4, Math.min(bb.width - tip.offsetWidth / 2 - 4, rb.left - bb.left + rb.width / 2));
      tip.style.left = left + "px"; tip.style.top = (rb.top - bb.top + 8) + "px";
    };
    $$(".hit", svg).forEach(r => { r.addEventListener("pointerenter", () => show(r)); r.addEventListener("click", () => show(r)); });
    svg.addEventListener("pointerleave", () => { tip.hidden = true; $$(".hit", svg).forEach(h => h.classList.remove("hl")); });
  }
  function calendar() {
    const counts = {}; S.journal.forEach(e => { const k = dayKey(e.t); counts[k] = (counts[k] || 0) + 1; });
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const start = new Date(today.getTime() - 34 * DAY); start.setDate(start.getDate() - start.getDay());
    const end = new Date(today); end.setDate(end.getDate() + (6 - end.getDay()));
    let html = "אבגדהוש".split("").map(h => `<span class="h">${h}׳</span>`).join("");
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + DAY)) {
      d.setHours(12, 0, 0, 0);
      const k = dayKey(d), c = counts[k] || 0, fut = d > today;
      html += `<span class="c ${fut ? "out" : c ? "l" + Math.min(3, c) : ""} ${k === dayKey(today) ? "today" : ""}" title="${fmtDay(d)}${c ? " · " + plural(c, "סשן אחד", "סשנים") : ""}"></span>`;
    }
    return `<div class="cal" role="img" aria-label="ימי תרגול בחמשת השבועות האחרונים">${html}</div>
      <div class="callegend"><span>פחות</span><i style="background:var(--veil)"></i><i style="background:color-mix(in srgb,var(--ember) 38%,var(--veil))"></i><i style="background:color-mix(in srgb,var(--ember) 65%,var(--veil))"></i><i style="background:var(--ember)"></i><span>יותר</span></div>`;
  }
  function insight() {
    const by = {};
    stats().rated.forEach(e => { (by[e.prog] = by[e.prog] || { t: e.title, d: [], } ).d.push(e.before - e.after); });
    const best = Object.values(by).filter(x => x.d.length >= 2).map(x => ({ t: x.t, avg: x.d.reduce((a, b) => a + b, 0) / x.d.length, n: x.d.length })).sort((a, b) => b.avg - a.avg)[0];
    if (!best || best.avg <= 0) return "";
    return `<section class="card"><p class="eyebrow">מה עובד לך</p><p style="margin-top:6px">${esc(best.t)} הוריד את המתח בממוצע ב-${best.avg.toFixed(1)} נקודות, על פני ${best.n} סשנים.</p></section>`;
  }
  VIEWS.journal = () => {
    const head = `<section class="sec"><p class="eyebrow">יומן</p><h1 style="font-size:2.6rem">היומן שלך</h1></section>`;
    if (!S.journal.length) return head + `<section class="card empty"><p>עוד אין כאן סשנים. לפני כל סשן ואחריו אפשר לדרג את רמת המתח, והיומן יראה מה עובד לך ומתי.</p><button class="btn" data-act="start" data-p="${recommend()}">לסשן הראשון</button></section>${backupSec()}`;
    const list = S.journal.slice().reverse().slice(0, 60);
    return head + statsTiles(true) + `
      <section class="card chartbox"><div class="sec-head"><h2 style="font-size:1.45rem">מתח לפני ואחרי</h2></div>
        <div class="legend"><span><i style="background:var(--before)"></i>לפני</span><span><i style="background:var(--after)"></i>אחרי</span><span class="muted">0 רגוע · 10 לחוץ</span></div>
        ${chartSVG()}<p class="small muted">כל עמודה היא סשן אחד. האחרון בצד שמאל.</p></section>
      <section class="card sec"><h2 style="font-size:1.45rem">חמשת השבועות האחרונים</h2>${calendar()}</section>
      ${insight()}
      <section class="sec"><h2>כל הסשנים</h2><div class="card entries">${list.map(e => `<div class="entry"><span class="orb" style="--hue:${esc(e.hue || "#ffb45e")}"></span><div class="grow"><b>${esc(e.title)}</b><div class="when">${fmtWhen(e.t)} · ${e.min} דק׳${e.partial ? " · נעצר באמצע" : ""}</div></div><div class="delta">${e.before != null && e.after != null ? `${e.before} ← ${e.after}${e.before > e.after ? `<br><em dir="ltr">−${e.before - e.after}</em>` : ""}` : e.before != null ? `לפני ${e.before}` : ""}</div></div>`).join("")}</div></section>
      ${backupSec()}`;
  };
  function backupSec() {
    return `<section class="sec"><h2 style="font-size:1.45rem">גיבוי</h2><p class="small muted">הנתונים נשמרים רק במכשיר הזה. אפשר להעתיק גיבוי ולשחזר אותו במכשיר אחר.</p>
      <div class="row"><button class="btn small ghost" data-act="backup">העתקת גיבוי</button><button class="btn small ghost" data-act="restore">שחזור מגיבוי</button></div>
      <div id="restoreWrap" hidden class="sec"><label class="label" for="restoreBox">מדביקים כאן את הגיבוי</label><textarea id="restoreBox" class="mine" style="min-height:6em;font-size:.8rem;line-height:1.4"></textarea><button class="btn small" data-act="restore-go">שחזור</button></div></section>`;
  }

  VIEWS.learn = () => {
    const ts = testState();
    const lesson = l => `<details class="lesson"><summary><b>${l.title}</b></summary><div class="body">
      ${(l.body || []).map(p => `<p>${esc(p)}</p>`).join("")}
      ${l.list ? `<ul>${l.list.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${l.src ? `<p class="src">מקורות: ${l.src.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(" · ")}</p>` : ""}</div></details>`;
    const vcard = v => `<a class="vcard" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener"><span class="vthumb"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg"><span class="len">${v.len}</span></span><span class="vinfo"><b>${esc(v.t)}</b><span>${v.he ? '<span class="badge he">עברית</span>' : '<span class="badge">EN</span>'}${esc(v.ch)}</span><span>${esc(v.n)}</span></span></a>`;
    return `
      <section class="sec"><p class="eyebrow">ללמוד</p><h1 style="font-size:2.6rem">איך זה עובד</h1><p class="lede">מה קורה במוח, מה המחקר אומר, איך כותבים משפטים, וסרטונים ומקורות שנבדקו.</p></section>
      <section class="sec"><h2>מבחן רגישות להיפנוזה</h2><p class="muted">שלושה תרגילי דמיון קצרים. אין ציון נכשל: התוצאה רק מכוונת אילו סשנים יתאימו לך.</p>
        <div class="tests">${D.TESTS.map(t => `<button class="testcard" data-act="test" data-id="${t.id}"><span class="orb" style="--hue:#ffd9a3;width:34px;height:34px"></span><span class="grow"><b>${t.title}</b><span>${t.note}</span></span><span class="score">${S.tests[t.id] != null ? `${S.tests[t.id]}/3` : "לנסות"}</span></button>`).join("")}</div>
        ${ts.label ? `<div class="card"><p class="eyebrow">התוצאה שלך · ${ts.sum} מתוך ${ts.all * 3}</p><h3 style="font-size:1.6rem;margin:4px 0 6px">רגישות ${ts.label.level}</h3><p class="muted small">${ts.label.text}</p></div>` : ""}</section>
      <section class="sec"><h2>שיעורים קצרים</h2>${D.LEARN.map(lesson).join("")}</section>
      <section class="sec"><h2>סרטונים מומלצים</h2><p class="muted small">כל הקישורים נבדקו. הם נפתחים ביוטיוב.</p>${D.VIDEOS.map(g => `<div class="vgroup"><h3>${g.group}</h3><div class="vlist">${g.items.map(vcard).join("")}</div></div>`).join("")}</section>
      <section class="sec"><h2>מקורות חינמיים ומקצועיים</h2>${D.RESOURCES.map(g => `<div class="card"><h3 style="font-size:1.3rem;margin-bottom:4px">${g.group}</h3><div class="res">${g.items.map(r => `<a href="${esc(r.u)}" target="_blank" rel="noopener"><b>${esc(r.t)}</b><span>${esc(r.by)} · ${esc(r.n)}</span></a>`).join("")}</div></div>`).join("")}</section>
      <section class="card help"><b>צריך לדבר עם מישהו עכשיו?</b><p class="muted small" style="margin-top:4px">ער״ן, עזרה ראשונה נפשית, זמינים 24 שעות ביממה בטלפון <b style="color:var(--mist)">1201</b>. במצב חירום: מד״א 101.</p></section>
      <p class="small muted">המטוטלת ${VERSION} · כלי לתרגול עצמי של הרפיה ודמיון מודרך. לא טיפול ולא תחליף לאיש מקצוע.</p>`;
  };

  /* ================= sheets ================= */
  let sheetStack = [];
  let cur = null;
  function sheetTop(eyebrow) {
    return `<div class="sheet-top"><span class="grab"></span>${sheetStack.length > 1 ? `<button class="iconbtn" data-act="sheet-back" aria-label="חזרה">${IC.back}</button>` : `<span class="eyebrow">${eyebrow || ""}</span>`}<button class="iconbtn" data-act="close-sheet" aria-label="סגירה">${IC.close}</button></div>`;
  }
  function openSheet(kind, push) {
    if (push) sheetStack.push(kind); else sheetStack = [kind];
    renderSheet(true);
    const sh = $("#sheet"); sh.hidden = false; document.body.classList.add("locked");
    requestAnimationFrame(() => sh.classList.add("on"));
  }
  function renderSheet(fresh) {
    const kind = sheetStack[sheetStack.length - 1]; const panel = $("#sheetPanel");
    const keep = fresh ? 0 : panel.scrollTop;
    const openDetails = $$("details[open]", panel).map(d => d.dataset.k);
    if (kind === "program") panel.innerHTML = programSheet();
    else if (kind === "settings") panel.innerHTML = settingsSheet();
    else if (kind === "recorder") panel.innerHTML = recorderSheet();
    if (!fresh) { openDetails.forEach(k => { const d = $(`details[data-k="${k}"]`, panel); if (d) d.open = true; }); panel.scrollTop = keep; }
    else panel.scrollTop = 0;
    if (kind === "program") { const c = cfgFor(cur.p, cur.over); preview($("#sheetPrev"), { visual: c.visual, motion: c.motion, hue: cur.p.hue, depth: .2 }); }
  }
  function closeSheet(instant) {
    const sh = $("#sheet"); if (sh.hidden) return;
    Mic.stop(); sh.classList.remove("on"); document.body.classList.remove("locked"); sheetStack = [];
    if (instant) sh.hidden = true; else setTimeout(() => { if (!sh.classList.contains("on")) sh.hidden = true; }, 320);
    if (!P.active) render();
  }

  const radio = (name, val, label, checked, extra) => { const id = `r-${name}-${val}`; return `<input type="radio" name="${name}" id="${id}" value="${val}" ${checked ? "checked" : ""} ${extra || ""}><label for="${id}">${label}</label>`; };
  const sw = (id, title, note, checked, extra) => `<div class="switch"><div class="t"><b><label for="${id}">${title}</label></b>${note ? `<span>${note}</span>` : ""}</div><input type="checkbox" id="${id}" ${checked ? "checked" : ""} ${extra || ""}></div>`;

  function openProgram(id, opts) {
    opts = opts || {};
    cur = { p: progById(id), day: opts.day || null, over: opts.over ? Object.assign({}, opts.over) : null };
    openSheet("program", opts.push);
  }
  function setOpt(k, v) {
    if (cur.day) cur.over = Object.assign({}, cur.over, { [k]: v });
    else { S.prefs[cur.p.id] = Object.assign({}, S.prefs[cur.p.id], { [k]: v }); save(); }
  }
  function lint(lines) {
    const out = [];
    lines.forEach((l, i) => {
      const is = [];
      if (/(^|[\s,])(לא|אין|בלי|אף פעם|מפסיק|מפסיקה|להפסיק)(?=[\s,.!]|$)/.test(l)) is.push(G("ניסוח שלילי. נסה לכתוב מה כן קורה.", "ניסוח שלילי. נסי לכתוב מה כן קורה."));
      if (/(^|[\s,])(אהיה|יהיה|תהיה|אצליח|ארגיש|אוכל|אתחיל|בעתיד|בקרוב)(?=[\s,.!]|$)/.test(l)) is.push("זמן עתיד. עדיף הווה, כאילו זה כבר קורה.");
      if (l.length > 80) is.push("ארוך. משפט קצר נקלט טוב יותר.");
      if (/\?/.test(l)) is.push("שאלה. עדיף משפט שקובע.");
      if (is.length) out.push(`<p>שורה ${i + 1}: ${is.join(" ")}</p>`);
    });
    if (!lines.length) return `<p>צריך לפחות משפט אחד.</p>`;
    if (!out.length) return `<p class="ok">${plural(lines.length, "משפט אחד", "משפטים")}. הניסוח נראה טוב.</p>`;
    return out.join("");
  }
  function mineEditor() {
    const ideas = D.IDEAS(G);
    return `<div class="field"><label class="label" for="mineTa">המשפטים שלך · משפט בכל שורה</label>
      <textarea id="mineTa" class="mine" spellcheck="false">${esc(mineText())}</textarea>
      <div class="lint" id="lint">${lint(myLines())}</div>
      ${isExample(S.mine) ? `<p class="small muted">אלה דוגמאות. אפשר למחוק ולכתוב משלך.</p>` : ""}
      <details class="more-opts" data-k="ideas"><summary>רעיונות למשפטים</summary><div class="inner ideas">
        ${Object.keys(ideas).map(k => `<div class="field"><span class="label">${k}</span><div class="chips">${ideas[k].map(l => `<button type="button" class="ideabtn" data-act="idea" data-line="${esc(l)}">+ ${esc(l)}</button>`).join("")}</div></div>`).join("")}
      </div></details>
      <div class="row"><button class="btn small ghost" data-act="recorder-push">${Rec.count() ? `הקול שלך · ${Rec.count()}/${myLines().length}` : "להקליט בקול שלך"}</button></div></div>`;
  }
  function programSheet() {
    const p = cur.p, c = cfgFor(p, cur.over), mins = minsOf(stepsFor(p, c));
    const day = cur.day ? D.JOURNEY.find(d => d.n === cur.day) : null;
    const vr = voiceReady();
    const lens = ["short", "normal", "deep"].map(k => radio("len", k, `${D.LEN[k].label}<small>~${minsOf(stepsFor(p, Object.assign({}, c, { len: k })))} דק׳</small>`, c.len === k, 'data-opt="len"')).join("");
    const vis = Object.keys(D.VISUALS).map(k => radio("visual", k, D.VISUALS[k].name, c.visual === k, 'data-opt="visual"')).join("");
    const mot = [["pendulum", "מטוטלת"], ["eight", "שמונה"], ["circle", "מעגל"]].map(([k, n]) => radio("motion", k, n, c.motion === k, 'data-opt="motion"')).join("");
    const ind = Object.keys(D.INDUCTIONS).map(k => { const it = D.INDUCTIONS[k]; const need = it.eyes === "closed" && !vr; return radio("induction", k, `<b>${it.name}</b><span>${it.note}${need ? " · דורש קול מקריא" : ""}</span>`, c.induction === k, `data-opt="induction" ${need ? "disabled" : ""}`); }).join("");
    const dee = Object.keys(D.DEEPENERS).map(k => radio("deepener", k, `<b>${D.DEEPENERS[k].name}</b><span>${D.DEEPENERS[k].note}</span>`, c.deepener === k, 'data-opt="deepener"')).join("");
    const ends = (p.quick ? [["wake3", "חזרה מהירה"], ["wake", "ספירה עד חמש"]] : [["wake", "חזרה לערנות"], ["sleep", "להירדם"]]).map(([k, n]) => radio("ending", k, n, c.ending === k, 'data-opt="ending"')).join("");
    const bands = Object.keys(D.BANDS).map(k => radio("band", k, `${D.BANDS[k].name}${D.BANDS[k].note ? `<small>${D.BANDS[k].note}</small>` : ""}`, c.band === k, 'data-opt="band"')).join("");
    const ambs = Object.keys(D.AMBIENCE).map(k => radio("amb", k, D.AMBIENCE[k].name, c.amb === k, 'data-opt="amb"')).join("");
    return sheetTop(day ? `מסע · יום ${day.n}` : "תוכנית") + `<div class="sheet-body">
      <div class="ph"><span class="orb" style="--hue:${p.hue};width:52px;height:52px"></span><div><h2>${day ? day.title : p.title}</h2><p>${day ? `${p.title} · ${day.note}` : p.short}</p></div></div>
      <p class="lede">${p.desc}</p>
      ${c.tailored ? `<p class="small muted">שיטת הכניסה הותאמה לפי מבחן הרגישות שלך.</p>` : ""}
      ${!vr && !S.voiceOn ? "" : !vr ? `<p class="small muted">לא נמצא קול בעברית במכשיר הזה, אז המשפטים יופיעו כטקסט. אפשר להקליט אותם בקול שלך.</p>` : ""}
      <canvas class="prev" id="sheetPrev" aria-label="תצוגה מקדימה של הוויזואל"></canvas>
      <div class="field"><span class="label">אורך</span><div class="seg">${lens}</div></div>
      ${(p.mine || c.useMine) ? mineEditor() : ""}
      <div class="field"><span class="label">ויזואל</span><div class="chips">${vis}</div></div>
      ${c.visual === "dot" ? `<div class="field"><span class="label">תנועת הנקודה</span><div class="chips">${mot}</div></div>` : ""}
      <details class="more-opts" data-k="full" ${p.mine ? "open" : ""}><summary>התאמה מלאה</summary><div class="inner">
        <div class="field"><span class="label">שיטת כניסה</span><div class="opts">${ind}</div></div>
        <div class="field"><span class="label">העמקה</span><div class="opts">${dee}</div></div>
        <div class="field"><span class="label">סיום</span><div class="seg">${ends}</div></div>
        <div class="field"><span class="label">גלים בינאורליים</span><div class="chips">${bands}</div><p class="small muted">צליל שונה בכל אוזן. עובד רק עם אוזניות.</p></div>
        <div class="field"><span class="label">רקע</span><div class="chips">${ambs}</div></div>
        <div>
          ${p.mine ? "" : sw("o-useMine", "להוסיף את המשפטים שלי", "המשפטים שלך יבואו אחרי המשפטים של התוכנית.", c.useMine, 'data-opt="useMine"')}
          ${c.ending === "sleep" ? sw("o-sleepSugs", "משפטים לשינה", "במחקר, משפטי שינה עזרו לרגישים להיפנוזה והפריעו לחלק מהשאר. אם השינה נעשית שטחית יותר, כדאי לכבות.", c.sleepSugs, 'data-opt="sleepSugs"') : ""}
          ${p.quick || c.ending === "sleep" ? "" : sw("o-ego", "חיזוק עצמי", "שלושה משפטים כלליים של רוגע וכוח אחרי ההעמקה.", c.ego, 'data-opt="ego"')}
          ${c.ending === "sleep" ? "" : sw("o-anchor", "עוגן", "לחיצת אגודל ואצבע שמחזירה את התחושה גם אחרי הסשן.", c.anchor, 'data-opt="anchor"')}
        </div>
        <button class="linkish small" data-act="reset-prefs" style="justify-self:start">איפוס להגדרות של התוכנית</button>
      </div></details>
    </div>
    <div class="sheet-foot"><button class="btn" data-act="go">מתחילים · <span id="sheetMins">${mins}</span> דק׳</button></div>`;
  }
  function refreshProgramBits() {
    const p = cur.p, c = cfgFor(p, cur.over);
    const m = $("#sheetMins"); if (m) m.textContent = minsOf(stepsFor(p, c));
    ["short", "normal", "deep"].forEach(k => { const l = $(`label[for="r-len-${k}"] small`); if (l) l.textContent = `~${minsOf(stepsFor(p, Object.assign({}, c, { len: k })))} דק׳`; });
    const st = previews.get($("#sheetPrev")); if (st) lookOn(st, { visual: c.visual, motion: c.motion, hue: p.hue, depth: .2 });
  }

  function settingsSheet() {
    const voices = Voice.list || [];
    return sheetTop("הגדרות") + `<div class="sheet-body">
      <h2 style="font-size:2.2rem">הגדרות</h2>
      <div class="field"><span class="label">פנייה אליך</span><div class="seg">${radio("sgender", "m", "בלשון זכר", S.gender === "m", 'data-set="gender"')}${radio("sgender", "f", "בלשון נקבה", S.gender === "f", 'data-set="gender"')}</div></div>
      <div class="card">
        ${sw("s-voice", "קול מקריא", Voice.v ? `${esc(Voice.v.name)} · ${Voice.v.lang}` : voiceFinal ? "לא נמצא קול בעברית בדפדפן הזה. המשפטים יופיעו כטקסט." : "מחפש קול בעברית…", S.voiceOn && !!Voice.v, `data-set="voiceOn" ${Voice.v ? "" : "disabled"}`)}
        ${voices.length > 1 ? `<div class="field" style="padding-bottom:12px"><label class="label" for="s-vname">קול</label><select id="s-vname" data-set="voiceName">${voices.map(v => `<option value="${esc(v.name)}" ${Voice.v && Voice.v.name === v.name ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></div>` : ""}
        ${Voice.v ? `<div class="field" style="padding-bottom:12px"><label class="label" for="s-rate">קצב דיבור</label><input type="range" id="s-rate" min="0.6" max="1.1" step="0.02" value="${S.rate}" data-set="rate"><button class="linkish small" data-act="voice-test" style="justify-self:start">לשמוע דוגמה</button></div>` : ""}
      </div>
      <div class="card">
        <div class="field" style="padding-bottom:12px"><label class="label" for="s-vol">עוצמת צלילי הרקע</label><input type="range" id="s-vol" min="0" max="1" step="0.05" value="${S.vol}" data-set="vol"></div>
        ${sw("s-ticks", "תקתוק מטוטלת", "צליל קטן בכל קצה של התנועה, בשלבי הכניסה וההעמקה.", S.ticks, 'data-set="ticks"')}
        ${sw("s-calm", "תנועה איטית במיוחד", "לרגישות לתנועה או לאור.", S.calm, 'data-set="calm"')}
      </div>
      <div class="card">
        ${sw("s-myvoice", "הקול שלי", `${plural(Rec.count(), "משפט אחד מוקלט", "משפטים מוקלטים")}. משפטים מוקלטים יושמעו בקול שלך.`, S.myVoice, 'data-set="myVoice"')}
        <div class="row" style="padding-top:6px"><button class="btn small ghost" data-act="recorder-push">ניהול הקלטות</button>${Rec.blobs.size ? `<button class="btn small ghost" data-act="wipe-rec">מחיקת כל ההקלטות</button>` : ""}</div>
      </div>
      <div class="sec"><span class="label">התקנה בטלפון</span><p class="small muted">באייפון: פותחים את <a href="${APP_URL}" target="_blank" rel="noopener">${APP_URL.replace("https://", "")}</a> בספארי, לוחצים על כפתור השיתוף ובוחרים "הוספה למסך הבית". באנדרואיד: תפריט כרום ← "התקנת אפליקציה".</p></div>
      <div class="sec"><span class="label">נתונים</span><p class="small muted">הכול נשמר רק במכשיר הזה. שום דבר לא נשלח לשום מקום.</p><div class="row"><button class="btn small ghost" data-act="wipe">מחיקת כל הנתונים</button></div></div>
      <p class="small muted">המטוטלת ${VERSION} · תרגול עצמי של הרפיה ודמיון מודרך. לא טיפול רפואי.</p>
    </div>`;
  }

  function recorderSheet() {
    const lines = myLines();
    return sheetTop("הקול שלך") + `<div class="sheet-body">
      <div><p class="eyebrow">הקול שלך</p><h2 style="font-size:2.2rem;margin-top:4px">להקליט את המשפטים</h2></div>
      <p class="lede">כשהמשפטים נשמעים בקול שלך, הם מרגישים כמו מחשבה שלך. מקליטים פעם אחת, ומאז כל סשן משמיע אותם בקול שלך במקום הקול הממוחשב.</p>
      <p class="small muted">כדאי לדבר לאט, בקול נמוך ורגוע, בחדר שקט. משפט אחד בכל הקלטה.</p>
      ${inFrame ? `<p class="small muted">בתצוגה הזו אין גישה למיקרופון. באפליקציה המותקנת ההקלטה עובדת.</p>` : ""}
      <div class="reclist">${lines.map((l, i) => { const has = Rec.blobs.has(l), live = Mic.key === l; return `<div class="recrow ${has ? "has" : ""} ${live ? "live" : ""}"><span class="dot"></span><p>${esc(l)}</p>${has && !live ? `<button class="iconbtn" data-act="recplay" data-i="${i}" aria-label="השמעה">${IC.play}</button>` : ""}<button class="btn small ${live ? "" : "ghost"}" data-act="rec" data-i="${i}">${live ? "עצירה" : has ? "שוב" : "הקלטה"}</button></div>`; }).join("")}</div>
      ${sw("r-myvoice", "להשמיע את ההקלטות בסשנים", "משפטים שלא הוקלטו יוקראו בקול הממוחשב.", S.myVoice, 'data-set="myVoice"')}
    </div>`;
  }

  /* ================= player ================= */
  const P = { active: false, paused: false, ended: false, waiting: true, kind: "session", prog: null, cfg: null, steps: [], i: -1, clock: 0, t0: 0, spoken: true, spokeAt: -1e9, total: 1, doneMs: 0, phase: null, before: null, entry: null, day: null, test: null, sleepT: 0, limit: 0, hideTok: 0, stage: null, opts: null };
  const PH_NAMES = { in: "כניסה", deep: "העמקה", sug: "הטמעה", out: "יציאה", sleep: "שינה", test: "מבחן" };
  let wake = null, idleT = 0, lineTok = 0;
  function lockWake() { try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(l => { wake = l; }).catch(() => {}); } catch (e) {} }
  function releaseWake() { try { wake && wake.release(); } catch (e) {} wake = null; }
  function poke() { const el = $("#player"); el.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => { if (P.active && !P.waiting) el.classList.add("idle"); }, 2800); }
  function showLine(t, sug) {
    const id = ++lineTok, el = $("#pline"); el.classList.remove("show");
    setTimeout(() => { if (id !== lineTok) return; el.textContent = t; el.classList.toggle("sug", !!sug); if (t) el.classList.add("show"); }, 600);
  }
  function showBig(n) { const el = $("#pbig"); if (n) { el.textContent = n; el.classList.add("show"); } else el.classList.remove("show"); }
  function showCard(html) { const c = $("#pcard"); c.innerHTML = html; c.hidden = false; c.scrollTop = 0; }
  function hideCard() { const c = $("#pcard"); c.hidden = true; c.innerHTML = ""; }
  function moodPicker(which) {
    return `<div class="mood" role="radiogroup" aria-label="רמת מתח מ-0 עד 10">${Array.from({ length: 11 }, (_, v) => `<input type="radio" name="mood-${which}" id="m-${which}-${v}" value="${v}"><label for="m-${which}-${v}">${v}</label>`).join("")}</div>
      <div class="moodends"><span>0 · ${G("רגוע לגמרי", "רגועה לגמרי")}</span><span>10 · ${G("לחוץ מאוד", "לחוצה מאוד")}</span></div>`;
  }
  function phaseDots() {
    const el = $("#pphase");
    if (P.kind !== "session") { $$("i", el).forEach(i => { i.hidden = true; }); $("#pphaseName").textContent = P.kind === "test" ? "מבחן" : P.kind === "sos" ? "נשימה" : "בהייה"; return; }
    $$("i", el).forEach(i => { i.hidden = false; i.className = ""; }); $("#pphaseName").textContent = "";
  }
  function setPhase(ph) {
    P.phase = ph;
    if (P.kind === "session") {
      const order = ["in", "deep", "sug", P.cfg.ending === "sleep" ? "sleep" : "out"]; const k = order.indexOf(ph);
      $$("#pphase i").forEach((d, j) => { d.className = j < k ? "done" : j === k ? "now" : ""; });
      $("#pphaseName").textContent = PH_NAMES[ph] || "";
      Sound.level({ in: .8, deep: 1, sug: .95, out: .6, sleep: .7 }[ph] || .8, 4);
    }
  }

  function openPlayer(kind, opts) {
    closeSheet(true);
    Object.assign(P, { active: true, paused: false, ended: false, waiting: true, kind, prog: opts.prog || null, cfg: opts.cfg || null, steps: opts.steps || [], i: -1, clock: 0, t0: 0, spoken: true, spokeAt: -1e9, doneMs: 0, phase: null, before: null, entry: null, day: opts.day || null, test: opts.test || null, sleepT: 0, limit: 0, opts });
    P.total = Math.max(1, msOf(P.steps)); P.hideTok++;
    const el = $("#player"); el.hidden = false; document.body.classList.add("locked");
    const st = P.stage; st.resize();
    const lk = opts.look || { visual: "orb", motion: "pendulum", hue: "#ffb45e" };
    Object.assign(st, { visual: lk.visual, motion: lk.motion || "pendulum", spiral: lk.visual === "dot", spiralA: lk.visual === "dot" ? 1 : 0, ph: 0, period: 3.4, periodT: 3.4, amp: .55, ampT: .55, depth: .2, depthT: .2, dim: 1, dimT: .25, lift: 0, liftT: 0, trail: [], parts: null });
    st.setAccent(lk.hue || "#ffb45e", true); st.breathAuto();
    $("#pline").className = "pline"; $("#pline").textContent = ""; $("#pbig").className = "bignum"; $("#pnote").textContent = ""; $("#pprog").style.width = "0";
    $("#ppause").textContent = "עצירה"; el.classList.remove("paused", "idle");
    $("#pvis").hidden = kind !== "free"; $("#pclock").hidden = kind !== "free"; $("#pclock").textContent = "";
    phaseDots();
    requestAnimationFrame(() => el.classList.add("on"));
    showCard(preCard());
    try { el.focus({ preventScroll: true }); } catch (e) {}
  }
  function preCard() {
    const tips = [];
    if (P.kind === "session" && P.cfg && (P.cfg.band !== "off")) tips.push("הגלים הבינאורליים עובדים רק עם אוזניות.");
    if (isIOS) tips.push("באייפון: המתג השקט בצד צריך להיות כבוי כדי לשמוע צלילים.");
    const tipHtml = tips.length ? `<ul class="tips">${tips.map(t => `<li>${t}</li>`).join("")}</ul>` : "";
    if (P.kind === "test") {
      const t = P.test;
      return `<div class="pbox"><p class="eyebrow">מבחן רגישות · ${t.note}</p><h2>${t.title}</h2><p>${voiceReady() ? "הקול ידריך אותך. פשוט לעשות מה שהוא אומר, בלי להתאמץ ובלי לנסות \"להצליח\"." : "ההוראות יופיעו על המסך. פשוט לעשות מה שכתוב, בלי להתאמץ."}</p><p class="small muted">בסוף תופיע שאלה אחת על מה שקרה.</p><div class="btns"><button class="btn" data-act="p-go">מתחילים</button><button class="btn ghost" data-act="p-exit">ביטול</button></div></div>`;
    }
    if (P.kind === "free") {
      return `<div class="pbox"><p class="eyebrow">בהייה</p><h2>רק אור, תנועה וצליל</h2><p>בלי מילים ובלי משימות. ${touch ? "כפתור \"ויזואל\" למעלה מחליף את התמונה." : "כפתור \"ויזואל\" למעלה מחליף את התמונה. רווח עוצר."}</p>
        <div class="seg">${[[5, "5 דק׳"], [10, "10 דק׳"], [20, "20 דק׳"], [0, "בלי הגבלה"]].map(([v, n]) => radio("freemin", v, n, v === 10)).join("")}</div>
        <div class="chips" style="justify-content:center">${Object.keys(D.BANDS).filter(k => k !== "off").map(k => radio("freeband", k, D.BANDS[k].name, k === "theta")).join("")}${radio("freeband", "off", "בלי גלים", false)}</div>
        <div class="btns"><button class="btn" data-act="p-go">מתחילים</button><button class="btn ghost" data-act="p-exit">ביטול</button></div>${tipHtml}</div>`;
    }
    const title = P.kind === "sos" ? "נשימת חירום" : (P.day ? `מסע · יום ${P.day}` : P.prog.title);
    const mins = Math.max(1, Math.round(P.total / 60000));
    return `<div class="pbox"><p class="eyebrow">${esc(title)} · בערך ${mins} דק׳</p><h2>רגע לפני</h2><p>כמה מתח יש בך עכשיו?</p>${moodPicker("before")}
      <div class="btns"><button class="btn ghost small" data-act="p-skip">דילוג</button><button class="btn ghost small" data-act="p-exit">ביטול</button></div>${tipHtml}</div>`;
  }
  function run() {
    let band = "off", amb = "none";
    if (P.kind === "session") { band = P.cfg.band; amb = P.cfg.amb; }
    else if (P.kind === "free") { const b = $('input[name="freeband"]:checked'); band = b ? b.value : "theta"; amb = "pad"; const m = $('input[name="freemin"]:checked'); P.limit = m ? (+m.value) * 60 : 0; }
    else if (P.kind === "test") { amb = "pad"; }
    hideCard();
    P.waiting = false; P.clock = 0; P.i = -1; P.startedAt = Date.now();
    Sound.setVolume(S.vol); Sound.unlock();
    if (band !== "off" || amb !== "none") Sound.start({ band, amb }); else Sound.stop(.3);
    if (voiceReady() && P.kind !== "free") { Voice.rate = S.rate; Voice.speak(" ", null, { vol: .01 }); }
    if (P.kind === "session" && S.myVoice && Rec.blobs.size) Rec.prepare(myLines());
    lockWake();
    P.stage.dimT = 0;
    try { if (!isIOS && !touch && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
    if (P.kind === "free") { Object.assign(P.stage, { periodT: S.calm ? 5 : 4, ampT: .8 }); }
    poke();
  }
  function apply(s) {
    P.t0 = P.clock; const st = P.stage; const slow = (reduced || S.calm) ? 1.3 : 1;
    if (s.period) st.periodT = s.period * slow;
    if (s.amp != null) st.ampT = s.amp;
    if (s.depth != null) st.depthT = s.depth;
    if (s.lift != null) st.liftT = s.lift;
    if (s.dimT != null) st.dimT = s.dimT;
    if (s.bto != null) st.breathTo(s.bto, s.dur / 1000);
    else if (s.breath === "in") st.breathTo(1, s.dur / 1000);
    else if (s.breath === "out") st.breathTo(0, s.dur / 1000);
    else if (s.breath === "hold") st.breathTo(st.breath, s.dur / 1000);
    else st.breathAuto();
    showLine(s.text, !!s.sug); showBig(s.big);
    if (s.phase !== P.phase) setPhase(s.phase);
    if (s.cue === "chime") Sound.chime(.9);
    const done = () => { P.spoken = true; P.spokeAt = P.clock; };
    P.spoken = false;
    if (s.sug && S.myVoice && Rec.play(s.text, done)) return;
    if (voiceReady()) { Voice.rate = S.rate; Voice.speak(s.text, done, { vol: s.vol }); }
    else { P.spoken = true; P.spokeAt = -1e9; }
  }
  function next() {
    P.i++;
    if (P.i >= P.steps.length) { finish(); return; }
    apply(P.steps[P.i]);
  }
  function update(dt) {
    if (!P.active || P.waiting || P.paused) return;
    P.clock += dt;
    if (P.kind === "free") {
      $("#pclock").textContent = fmtClock(P.limit ? Math.max(0, P.limit - P.clock) : P.clock);
      P.stage.depthT = Math.min(.8, P.clock / 600);
      if (P.limit && P.clock >= P.limit && !P.ended) finish();
      return;
    }
    if (P.ended) {
      if (P.sleepT > 0) { P.sleepT -= dt; if (P.sleepT <= 0) { P.sleepT = 0; Sound.stop(3); releaseWake(); } }
      return;
    }
    if (P.i < 0) { if (P.clock > 1.4) next(); return; }
    const s = P.steps[P.i]; const ms = (P.clock - P.t0) * 1000;
    const gap = s.gap != null ? s.gap : 1200;
    const vdone = s.nowait || (P.spoken && (P.clock - P.spokeAt) * 1000 >= gap);
    $("#pprog").style.width = (100 * Math.min(1, (P.doneMs + Math.min(ms, s.dur)) / P.total)).toFixed(2) + "%";
    if (ms >= s.dur && vdone) { P.doneMs += s.dur; next(); }
  }
  function logEntry(partial) {
    const e = {
      t: Date.now(), prog: P.prog ? P.prog.id : P.kind, kind: P.kind,
      title: P.prog ? (P.day ? `${P.prog.title} · מסע יום ${P.day}` : P.prog.title) : P.kind === "sos" ? "נשימת חירום" : "בהייה",
      hue: P.prog ? P.prog.hue : P.kind === "sos" ? "#ff9f8f" : "#8fa2ff",
      min: Math.max(1, Math.round(P.clock / 60)), before: P.before, after: null
    };
    if (partial) e.partial = true;
    S.journal.push(e); if (S.journal.length > 2000) S.journal = S.journal.slice(-2000);
    if (P.day && !partial) S.journey[P.day] = Date.now();
    save(); return e;
  }
  function finish() {
    P.ended = true; Voice.stop(); Rec.stop();
    if (P.kind === "test") { Sound.stop(1.5); releaseWake(); showLine("", false); setTimeout(() => { if (P.active) showCard(testEndCard()); }, 900); return; }
    P.entry = logEntry(false);
    if (P.kind === "session" && P.cfg.ending === "sleep") { P.sleepT = 600; Sound.level(0, 600); P.stage.dimT = 1; return; }
    Sound.stop(4); releaseWake();
    Object.assign(P.stage, { periodT: 4, ampT: .45, depthT: 0, dimT: .25 }); P.stage.breathAuto();
    showLine("", false); showBig(null); $("#pprog").style.width = "100%";
    $("#player").classList.remove("idle"); clearTimeout(idleT);
    setTimeout(() => { if (P.active && P.ended) showCard(endCard()); }, 1400);
  }
  function endCard() {
    const st = streaks(); const n = S.journal.length;
    const title = P.kind === "sos" ? "נשימה הושלמה" : P.kind === "free" ? "סוף הבהייה" : "הסשן הסתיים";
    const day = P.day && S.journey[P.day] ? `<p class="small">יום ${P.day} במסע הושלם.${P.day < 7 ? " מחר: " + D.JOURNEY[P.day].title + "." : " סיימת את כל המסע."}</p>` : "";
    return `<div class="pbox"><p class="eyebrow">סשן מספר ${n} · ${st.cur === 1 ? "יום ראשון ברצף" : st.cur + " ימים ברצף"}</p><h2>${title}</h2>
      ${P.kind === "free" ? `<p>${P.entry.min} דקות של שקט.</p>` : `<p>ועכשיו, כמה מתח יש בך?</p>${moodPicker("after")}`}
      <p id="pdelta"></p>${day}
      <div class="btns"><button class="btn" data-act="p-close">סיום</button>${P.kind === "session" ? `<button class="btn ghost" data-act="p-again">עוד פעם</button>` : ""}</div></div>`;
  }
  function testEndCard() {
    const t = P.test;
    return `<div class="pbox"><p class="eyebrow">מבחן · ${t.title}</p><h2>${t.q}</h2><div class="answers">${t.options.map((o, i) => `<button type="button" data-act="p-ans" data-v="${i}">${o}</button>`).join("")}</div></div>`;
  }
  function testAnswered(v) {
    S.tests[P.test.id] = v; save();
    const ts = testState(); const nextT = D.TESTS.find(t => S.tests[t.id] == null);
    if (ts.label) {
      showCard(`<div class="pbox"><p class="eyebrow">שלושת המבחנים · ${ts.sum} מתוך ${ts.all * 3}</p><p>רגישות להיפנוזה</p><div class="result">${ts.label.level}</div><p>${ts.label.text}</p><p class="small muted">רוב האנשים נמצאים בטווח הבינוני. אפשר לחזור על המבחנים בכל זמן.</p><div class="btns"><button class="btn" data-act="p-close">סיום</button></div></div>`);
    } else {
      showCard(`<div class="pbox"><p class="eyebrow">נשמר</p><h2>${ts.all - ts.done === 1 ? "נשאר עוד מבחן אחד" : `נשארו עוד ${ts.all - ts.done} מבחנים`}</h2><p class="small muted">התוצאה הכוללת תופיע בסוף.</p><div class="btns">${nextT ? `<button class="btn" data-act="test" data-id="${nextT.id}">${nextT.title}</button>` : ""}<button class="btn ghost" data-act="p-close">אחר כך</button></div></div>`);
    }
  }
  function togglePause() {
    if (!P.active || P.waiting || P.ended) return;
    P.paused = !P.paused;
    $("#ppause").textContent = P.paused ? "המשך" : "עצירה";
    $("#player").classList.toggle("paused", P.paused);
    if (P.paused) { Voice.stop(); Rec.stop(); Sound.suspend(); $("#pnote").textContent = touch ? 'מושהה. "המשך" כדי לחזור.' : 'מושהה. רווח או "המשך" כדי לחזור.'; }
    else { Sound.resume(); $("#pnote").textContent = ""; if (P.i >= 0 && P.kind !== "free") apply(P.steps[P.i]); }
  }
  function closePlayer() {
    if (!P.active) return;
    if (!P.ended && !P.waiting && P.kind === "free" && P.clock > 30) logEntry(false);
    else if (!P.ended && !P.waiting && P.kind !== "test" && P.clock > 60) logEntry(true);
    P.active = false; Voice.stop(); Rec.stop(); Sound.stop(.8); releaseWake();
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) {}
    const el = $("#player"); el.classList.remove("on", "idle", "paused"); clearTimeout(idleT);
    const t = ++P.hideTok; setTimeout(() => { if (t === P.hideTok) { el.hidden = true; hideCard(); } }, 1150);
    document.body.classList.remove("locked");
    render();
  }

  function startProgram(id, over, day) {
    const p = progById(id); const c = cfgFor(p, over); const steps = stepsFor(p, c);
    if (p.mine && !myLines().length) { toast("צריך לכתוב לפחות משפט אחד."); openProgram("custom"); return; }
    S.lastProg = id; save();
    openPlayer("session", { prog: p, cfg: c, steps, day, look: { visual: c.visual, motion: c.motion, hue: p.hue } });
  }
  function startTest(id) {
    const t = D.TESTS.find(x => x.id === id) || D.TESTS[0];
    openPlayer("test", { test: t, steps: D.buildTest(t, { gender: S.gender }), look: { visual: "orb", hue: "#ffd9a3" } });
  }

  /* ================= onboarding ================= */
  let onbStep = 0, voiceFinal = false;
  function voiceStatus() { return Voice.v ? `הקול: ${esc(Voice.v.name)}` : voiceFinal ? "לא נמצא קול בעברית במכשיר הזה. המשפטים יופיעו כטקסט, ואפשר להקליט אותם בקול שלך." : "מחפש קול בעברית…"; }
  function renderOnb() {
    const el = $("#onb");
    const steps = [
      () => `<div class="onb-body"><p class="eyebrow">היפנוזה עצמית · הרפיה · דמיון מודרך</p><h1>המטוטלת<b>.</b></h1><p class="lede">עוקבים אחרי האור, נושמים, שוקעים, ושומעים את המשפטים שבחרת בזמן שהגוף רגוע. תוכניות לשינה, לרוגע, לביטחון, לריכוז ולכאב, ומסע של שבעה ימים שמלמד לעשות את זה לבד.</p></div>`,
      () => `<div class="onb-body"><p class="eyebrow">שאלה אחת</p><h2 style="font-size:2.6rem">איך לפנות אליך?</h2><div class="seg">${radio("onbg", "m", "בלשון זכר", S.gender === "m", 'data-set="gender"')}${radio("onbg", "f", "בלשון נקבה", S.gender === "f", 'data-set="gender"')}</div><p class="muted small">הקול והמשפטים יותאמו. אפשר לשנות בהגדרות.</p><div class="card"><p class="small" id="onbVoice">${voiceStatus()}</p>${Voice.v ? `<button class="linkish small" data-act="voice-test">לשמוע את הקול</button>` : ""}</div></div>`,
      () => `<div class="onb-body"><p class="eyebrow">לפני שמתחילים</p><h2 style="font-size:2.6rem">כמה דברים חשובים</h2><ul>
          <li>עם אוזניות זה עובד הכי טוב.</li>
          ${isIOS ? "<li>באייפון: המתג השקט בצד צריך להיות כבוי, אחרת לא יהיה צליל.</li>" : ""}
          <li>לא בזמן נהיגה, ולא כשצריך להיות ערניים.</li>
          <li>אפילפסיה, פסיכוזה, דיסוציאציה או פוסט־טראומה: כדאי להתייעץ עם איש מקצוע לפני שמתחילים.</li>
          <li>זה תרגול עצמי של הרפיה ודמיון מודרך, לא טיפול.</li></ul>
          ${isIOS && !standalone && !inFrame ? `<p class="card small">להתקנה: כפתור השיתוף ← "הוספה למסך הבית".</p>` : ""}</div>`
    ];
    el.innerHTML = `<canvas id="onbCanvas"></canvas>${steps[onbStep]()}<div class="onb-foot"><div class="onb-steps">${[0, 1, 2].map(i => `<i class="${i === onbStep ? "now" : ""}"></i>`).join("")}</div><button class="btn block" data-act="onb-next">${onbStep < 2 ? "המשך" : "בואו נתחיל"}</button></div>`;
    preview($("#onbCanvas"), { visual: ["dot", "galaxy", "orb"][onbStep], motion: "pendulum", hue: "#ffb45e", depth: .25 });
  }

  /* ================= events ================= */
  function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    switch (a) {
      case "tab": closeSheet(true); go(b.dataset.t); break;
      case "start": startProgram(b.dataset.p); break;
      case "open": openProgram(b.dataset.p); break;
      case "go": startProgram(cur.p.id, cur.over, cur.day); break;
      case "day": { const d = D.JOURNEY.find(x => x.n === +b.dataset.n); if (d) openProgram(d.prog, { day: d.n, over: d.cfg }); break; }
      case "sos": openPlayer("sos", { steps: D.buildSOS({ gender: S.gender }), look: { visual: "orb", hue: "#ff9f8f" } }); break;
      case "free": openPlayer("free", { look: { visual: "galaxy", hue: "#8fa2ff" } }); break;
      case "test": if (P.active) { const id = b.dataset.id; P.active = false; P.hideTok++; startTest(id); } else startTest(b.dataset.id); break;
      case "settings": openSheet("settings"); break;
      case "recorder": openSheet("recorder"); break;
      case "recorder-push": openSheet("recorder", true); break;
      case "sheet-back": Mic.stop(); sheetStack.pop(); renderSheet(true); break;
      case "close-sheet": closeSheet(); break;
      case "hide-install": S.hideInstall = true; save(); render(); break;
      case "reset-prefs": if (cur.day) cur.over = Object.assign({}, D.JOURNEY.find(d => d.n === cur.day).cfg); else { delete S.prefs[cur.p.id]; save(); } renderSheet(); break;
      case "idea": {
        const ta = $("#mineTa"); const line = b.dataset.line;
        const base = isExample(S.mine) ? "" : S.mine.replace(/\s+$/, "");
        if (myLines().includes(line) && !isExample(S.mine)) { toast("המשפט הזה כבר ברשימה."); break; }
        S.mine = base ? base + "\n" + line : line; save();
        if (ta) ta.value = S.mine;
        $("#lint").innerHTML = lint(myLines()); refreshProgramBits(); toast("נוסף לרשימה.");
        break;
      }
      case "rec": {
        const line = myLines()[+b.dataset.i]; if (!line) break;
        if (Mic.rec) { const was = Mic.key; Mic.stop(); if (was === line) break; }
        Mic.start(line, () => renderSheet()).then(ok => { if (ok) renderSheet(); });
        break;
      }
      case "recplay": { const blob = Rec.blobs.get(myLines()[+b.dataset.i]); if (blob) { try { const u = URL.createObjectURL(blob); const au = new Audio(u); au.onended = () => URL.revokeObjectURL(u); au.play().catch(() => {}); } catch (err) {} } break; }
      case "wipe-rec": b.dataset.act = "wipe-rec-go"; b.textContent = "ללחוץ שוב כדי למחוק"; break;
      case "wipe-rec-go": Rec.clear().then(() => { toast("ההקלטות נמחקו."); renderSheet(); }); break;
      case "wipe": b.dataset.act = "wipe-go"; b.textContent = "ללחוץ שוב כדי למחוק הכול"; break;
      case "wipe-go": { const g = S.gender; S = fresh(); S.gender = g; S.onboarded = true; save(); Rec.clear(); closeSheet(); toast("כל הנתונים נמחקו."); go("home"); break; }
      case "voice-test": Voice.rate = S.rate; Voice.speak(G("עקוב אחרי הנקודה, ונשום לאט.", "עקבי אחרי הנקודה, ונשמי לאט."), null); break;
      case "backup": {
        const txt = JSON.stringify(S);
        const fallback = () => { const w = $("#restoreWrap"); w.hidden = false; const box = $("#restoreBox"); box.value = txt; box.select(); toast("הגיבוי מסומן. אפשר להעתיק אותו."); };
        try { navigator.clipboard.writeText(txt).then(() => toast("הגיבוי הועתק. כדאי לשמור אותו בהערות או בהודעה לעצמך."), fallback); } catch (err) { fallback(); }
        break;
      }
      case "restore": { const w = $("#restoreWrap"); w.hidden = false; $("#restoreBox").value = ""; $("#restoreBox").focus(); break; }
      case "restore-go": {
        try { const o = JSON.parse($("#restoreBox").value); if (!o || !Array.isArray(o.journal)) throw 0; S = Object.assign(fresh(), o); save(); toast("הגיבוי שוחזר."); render(); }
        catch (err) { toast("זה לא נראה כמו גיבוי של המטוטלת. צריך להדביק את כל הטקסט."); }
        break;
      }
      case "onb-next":
        if (onbStep < 2) { onbStep++; renderOnb(); }
        else { S.onboarded = true; save(); $("#onb").hidden = true; $("#onb").innerHTML = ""; render(); }
        break;
      case "p-skip": P.before = null; run(); break;
      case "p-go": run(); break;
      case "p-pause": togglePause(); poke(); break;
      case "p-exit": case "p-close": closePlayer(); break;
      case "p-again": { const o = P.opts, k = P.kind; P.active = false; P.hideTok++; if (k === "session" && P.prog) startProgram(P.prog.id, P.day ? D.JOURNEY.find(d => d.n === P.day).cfg : null, P.day); else openPlayer(k, o); break; }
      case "p-ans": testAnswered(+b.dataset.v); break;
      case "p-vis": { const ks = Object.keys(D.VISUALS); const i = (ks.indexOf(P.stage.visual) + 1) % ks.length; P.stage.visual = ks[i]; P.stage.spiral = ks[i] === "dot"; P.stage.parts = null; toast(D.VISUALS[ks[i]].name); poke(); break; }
    }
  }
  let mineT = 0;
  function onInput(e) {
    const t = e.target;
    if (t.id === "mineTa") {
      S.mine = t.value; save();
      clearTimeout(mineT); mineT = setTimeout(() => { const l = $("#lint"); if (l) l.innerHTML = lint(myLines()); refreshProgramBits(); }, 250);
    } else if (t.dataset && t.dataset.set === "rate") { S.rate = +t.value; Voice.rate = S.rate; save(); }
    else if (t.dataset && t.dataset.set === "vol") { S.vol = +t.value; Sound.setVolume(S.vol); save(); }
  }
  function onChange(e) {
    const t = e.target;
    if (t.name === "mood-before") { P.before = +t.value; run(); return; }
    if (t.name === "mood-after") {
      const v = +t.value; if (P.entry) { P.entry.after = v; save(); }
      const el = $("#pdelta"); const bf = P.before;
      if (el) el.textContent = bf == null ? "נשמר ביומן." : bf > v ? `ירידה של ${plural(bf - v, "נקודה אחת", "נקודות")}: מ-${bf} ל-${v}.` : bf === v ? "בלי שינוי הפעם. זה קורה, במיוחד בהתחלה." : "עלייה קטנה. אם זה חוזר, כדאי לנסות שיטת כניסה אחרת.";
      return;
    }
    if (t.dataset && t.dataset.opt && cur) {
      const k = t.dataset.opt; const v = t.type === "checkbox" ? t.checked : t.value;
      setOpt(k, v);
      if (["useMine", "visual", "ending"].includes(k)) renderSheet(); else refreshProgramBits();
      return;
    }
    if (t.dataset && t.dataset.set) {
      const k = t.dataset.set;
      if (k === "gender") { const wasEx = isExample(S.mine); S.gender = t.value; if (wasEx) S.mine = ""; save(); if (!$("#onb").hidden) renderOnb(); else if (sheetStack.length) renderSheet(); }
      else if (k === "voiceOn") { S.voiceOn = t.checked; save(); }
      else if (k === "voiceName") { S.voiceName = t.value; Voice.choose(t.value); save(); renderSheet(); }
      else if (k === "ticks" || k === "calm" || k === "myVoice") { S[k] = t.checked; save(); }
      else if (k === "rate") { S.rate = +t.value; save(); }
      else if (k === "vol") { S.vol = +t.value; Sound.setVolume(S.vol); save(); }
      return;
    }
  }
  function onKey(e) {
    if (P.active) {
      if (e.key === "Escape") { e.preventDefault(); closePlayer(); }
      else if ((e.key === " " || e.code === "Space") && !P.waiting) { e.preventDefault(); togglePause(); poke(); }
      return;
    }
    if (e.key === "Escape" && !$("#sheet").hidden) closeSheet();
  }

  /* ================= init ================= */
  function init() {
    shell();
    P.stage = new Stage($("#pstage"), { mini: false });
    P.stage.onTick = pan => { if (P.active && !P.paused && !P.ended && !P.waiting && S.ticks && P.kind === "session" && (P.phase === "in" || P.phase === "deep")) Sound.tick(P.phase === "deep" ? .55 : 1, pan); };
    document.addEventListener("click", onClick);
    document.addEventListener("input", onInput);
    document.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    const pl = $("#player");
    pl.addEventListener("pointermove", poke);
    pl.addEventListener("pointerdown", () => { poke(); if (P.active && P.ended && P.sleepT >= 0 && P.kind === "session" && P.cfg && P.cfg.ending === "sleep" && $("#pcard").hidden) showCard(`<div class="pbox"><h2>לילה טוב</h2><p class="small muted">הסשן נשמר ביומן.</p><div class="btns"><button class="btn" data-act="p-close">יציאה</button></div></div>`); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && P.active && !P.paused && !P.waiting && !P.ended && P.phase !== "sleep") togglePause(); });
    window.addEventListener("resize", () => { if (P.active) P.stage.resize(); });
    window.addEventListener("scroll", () => { $("#topbar").classList.toggle("scrolled", window.scrollY > 8); }, { passive: true });
    window.addEventListener("hashchange", () => { const h = location.hash.replace("#", ""); if (h && h !== tab) go(h); });

    if (S.voiceName) Voice.wanted = S.voiceName;
    Voice.rate = S.rate;
    Voice.init((v, final) => {
      if (final) voiceFinal = true;
      const ov = $("#onbVoice"); if (ov) { if (!$("#onb").hidden) renderOnb(); }
      if (sheetStack[sheetStack.length - 1] === "settings") renderSheet();
    });
    Rec.init().then(() => { if (!P.active && !sheetStack.length) render(); });

    if (/[?&]debug\b/.test(location.search)) window.__mt = { P, S: () => S, skip: n => { for (let i = 0; i < (n || 1) && P.active && !P.ended; i++) { P.doneMs += P.steps[P.i] ? P.steps[P.i].dur : 0; next(); } } };
    go((location.hash || "#home").replace("#", ""));
    if (!S.onboarded) { $("#onb").hidden = false; renderOnb(); }
    requestAnimationFrame(loop);

    if ("serviceWorker" in navigator && !inFrame && location.protocol === "https:") {
      window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
    }
  }
  init();
})();
