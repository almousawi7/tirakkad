/* تركّد — منطق اللعبة (شاشة وحدة على التلفزيون، مقدّم واحد)
   التسلسل: الرئيسية ← اللوحة ← السؤال ← الإجابة ← أي فريق جاوب؟ ← اللوحة */
(function () {
  'use strict';
  const BANK = window.TIRAKKAD_BANK;
  const ART = window.TIRAKKAD_ART || {};
  const CATMETA = window.TIRAKKAD_CATMETA || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SAVE_KEY = 'tirakkad-game-v2';
  const MAX_CATS = 6;

  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- data ----------
  const catById = Object.fromEntries(BANK.categories.map((c) => [c.id, c]));
  const qById = {};
  BANK.categories.forEach((c) => c.questions.forEach((q) => (qById[q.id] = { ...q, cat: c })));
  // صور وفيديوهات الأسئلة محفوظة مع الموقع (media.js)، وإذا ما لقيناها نستخدم الرابط الأصلي
  const MEDIA = window.TIRAKKAD_MEDIA || {};
  const media = (u) => (u && MEDIA[u]) || u || '';
  // أسئلة جديدة تنضاف يومياً من قاعدة البيانات — نحفظ نسخة بالجهاز عشان تشتغل حتى قبل لا توصل
  const EXTRA_KEY = 'tirakkad-extra-v1';
  function addExtra(cid, list) {
    const cat = catById[cid]; if (!cat || !Array.isArray(list)) return 0;
    let n = 0;
    list.forEach((q) => {
      if (!q || typeof q.id !== 'string' || qById[q.id] || ![200, 400, 600].includes(q.points)) return;
      if (!(q.question || q.prompt) || (cat.type !== 'list' && cat.type !== 'survey' && cat.type !== 'charades' && cat.type !== 'draw' && !q.answer)) return;
      if (q.options && !q.options.includes(q.correct_option)) delete q.options;
      if (q.image && !/^https:\/\//.test(q.image)) delete q.image;
      cat.questions.push(q); qById[q.id] = { ...q, cat }; n++;
    });
    return n;
  }
  try { const ex = JSON.parse(localStorage.getItem(EXTRA_KEY) || '{}'); Object.keys(ex).forEach((cid) => addExtra(cid, ex[cid])); } catch (e) {}
  const PALETTE = ['#2747D6', '#E2463B', '#0E9467', '#7446D1', '#E57A12', '#0C86A8', '#C92E6B', '#4C6A1E', '#8A4B22', '#33507A', '#B8860B', '#5B3FA6'];
  const CAT_ORDER = Object.fromEntries(BANK.categories.map((c, i) => [c.id, i]));
  const catColor = (id) => PALETTE[(CAT_ORDER[id] ?? 0) % PALETTE.length];
  const catDesc = (id) => (CATMETA[id] && CATMETA[id].desc) || '';
  // أيقونات ثلاثية الأبعاد (Microsoft Fluent Emoji — MIT) لكل فئة، وإذا ما حمّلت نرجع للإيموجي
  const catImg = (c) => `<img class="cat-3d" src="img/cats/${c.id}.png" alt="" loading="lazy" data-e="${esc(c.icon || '❓')}" onerror="this.outerHTML='<span class=emo-fallback>'+this.dataset.e+'</span>'">`;
  // صورة غلاف لكل فئة (img/covers/<id>.jpg) — إذا موجودة تصير خلفية البطاقة
  const COVERS = new Set(window.TIRAKKAD_COVERS || []);
  const artOf = (c) => `<span class="art img-art">${catImg(c)}</span>`;
  // سؤال العيّنة لكل مستوى (يطلع بنافذة العين) — ما يدخل اللعبة عشان ما ينفضح
  // الأسئلة اللي انلعبت — لكل حساب سجلّه الخاص (حساب Claude)، وبدون حساب تنحفظ بالجهاز
  let SEEN_KEY = 'tirakkad-seen-v1';
  let seen = new Set();
  const readSeen = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  seen = new Set(readSeen(SEEN_KEY));
  const saveSeen = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-5000))); } catch (e) {} };
  // سؤال العيّنة بنافذة العين: نفضّل سؤال انلعب قبل، عشان ما ينفضح سؤال جديد
  const sampleOf = (c, pts) => c.questions.find((x) => x.points === pts && seen.has(x.id)) || c.questions.find((x) => x.points === pts);

  const TEAMS = [
    { name: 'الفريق الأزرق', shape: 'tri' },
    { name: 'الفريق الأحمر', shape: 'cir' },
    { name: 'الفريق الأخضر', shape: 'sq' },
    { name: 'الفريق البنفسجي', shape: 'dia' },
  ];
  const ico = (id) => `<svg class="i"><use href="#i-${id}"/></svg>`;
  const HELPS = {
    strike: { icon: 'target', name: 'الحفرة', tip: 'فعّلوها من اللوحة قبل لا تختارون السؤال. إذا جاوبتوا صح تاخذون نقاط السؤال، وتنقص نفس النقاط من الخصم' },
    call: { icon: 'phone', name: 'اتصل بخويك', tip: 'دقوا على واحد يعرف، وعندكم ٣٠ ثانية' },
    double: { icon: 'two', name: 'جوابين', tip: 'قولوا جوابين، وإذا واحد منهم صح ينحسب' },
    tarakkad: { icon: 'hand', name: 'تركّد', tip: 'اختاروا أذكى واحد بالفريق الثاني، ويركد بهالسؤال' },
    options: { icon: 'list', name: 'الخيارات', tip: 'تطلع ٤ خيارات للسؤال. لكل فريق مرة وحدة باللعبة' },
  };
  const HELP_KEYS = Object.keys(HELPS);
  const PICK_KEYS = HELP_KEYS.filter((k) => k !== 'options'); // الخيارات لكل فريق دايماً، مو من الـ٣

  // ---------- storage ----------
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} };
  const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };
  function load() {
    let g = null;
    try { g = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
    if (!g || !Array.isArray(g.board) || !Array.isArray(g.teams)) return null;
    const ok = g.board.every((c) => catById[c.cid] && c.tiles.every((t) => qById[t.qid]));
    if (!ok) { clearSave(); return null; } // بنك الأسئلة تغيّر — اللعبة المحفوظة ما تنفع
    return g;
  }

  function paintAcct(name, ok) {
    const el = document.getElementById('acctChip'); if (!el) return;
    el.hidden = false;
    el.classList.toggle('on', ok);
    el.textContent = ok
      ? `✔ ${name ? name + '، ' : ''}أسئلتك محفوظة بحسابك — ما تتكرر عليك`
      : 'سجّل دخولك بحساب Claude عشان الأسئلة ما تتكرر عليك من أي جهاز';
  }
  const WEEKLY_GAMES = 10;
  function paintQuota(q) {
    const txt = q.state === 'ok' ? `🎟️ باقي لك ${q.left} من ${WEEKLY_GAMES} ألعاب هالأسبوع`
      : q.state === 'owner' ? '🎟️ ألعاب بدون حد (صاحب اللعبة)'
      : q.state === 'signin' ? `🎟️ سجّل دخول بحساب Claude وخذ ${WEEKLY_GAMES} ألعاب كل أسبوع` : '';
    document.querySelectorAll('[data-quota]').forEach((el) => { el.hidden = !txt; el.textContent = txt; el.classList.toggle('empty', q.state === 'ok' && q.left <= 0); });
  }
  // ---------- قاعدة البيانات (claude.ai): عدد مرات لعب كل فئة + أسئلة جديدة + الأسئلة اللي انلعبت
  const cloud = (() => {
    let db = null, uid = null;
    const ready = (async () => {
      try {
        if (!window.claude || typeof window.claude.use !== 'function') return null;
        db = await window.claude.use('db');
      } catch (e) { db = null; }
      return db;
    })();
    // مين اللي فاتح الصفحة؟ (حساب Claude) — كل واحد له سجل أسئلة خاص فيه
    const who = (async () => {
      try {
        if (!window.claude || typeof window.claude.use !== 'function') return null;
        const u = await window.claude.use('user'); if (!u) return null;
        const me = await u.me();
        uid = (me && me.id) || null;
        if (uid) {
          SEEN_KEY = 'tirakkad-seen-u-' + uid;
          seen = new Set(readSeen(SEEN_KEY));
        }
        paintAcct(me && me.name, !!uid);
        return uid;
      } catch (e) { paintAcct('', false); return null; }
    })();
    const seenPath = () => 'data/users/' + uid + '/seen';
    async function loadExtra() {
      const d = await ready; if (!d) return;
      try {
        const snap = await d.collection('extra').get();
        const docs = snap && (snap.docs || snap);
        const cache = {};
        let added = 0;
        (Array.isArray(docs) ? docs : []).forEach((doc) => {
          const data = typeof doc.data === 'function' ? doc.data() : (doc.data || doc);
          const cid = doc.id || (data && data.category);
          const list = data && Array.isArray(data.questions) ? data.questions : [];
          if (!cid || !catById[cid]) return;
          cache[cid] = list; added += addExtra(cid, list);
        });
        try { localStorage.setItem(EXTRA_KEY, JSON.stringify(cache)); } catch (e) {}
        if (added) { renderCatPick(); renderLanding(); }
      } catch (e) {}
      try {
        if (!(await who)) return;
        const sd = await d.doc(seenPath()).get();
        const v = sd && (typeof sd.data === 'function' ? sd.data() : sd.data);
        if (v && Array.isArray(v.ids)) { v.ids.forEach((id) => seen.add(id)); saveSeen(); }
      } catch (e) {}
    }
    let busy = Promise.resolve();
    function played(cats) {
      busy = busy.then(async () => {
        const d = await ready; if (!d) return;
        try {
          const ref = d.doc('stats/plays');
          const cur = await ref.get();
          const v = (cur && (typeof cur.data === 'function' ? cur.data() : cur.data)) || {};
          const counts = Object.assign({}, v.counts || {});
          cats.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
          await ref.set({ counts, games: (v.games || 0) + 1, last: new Date().toISOString() });
        } catch (e) {}
        try { if (await who) await d.doc(seenPath()).set({ ids: [...seen].slice(-3000), at: new Date().toISOString() }); } catch (e) {}
      });
    }
    // ---- عدد الألعاب: كل حساب Claude له WEEKLY_GAMES لعبة بالأسبوع (تتجدد كل اثنين). صاحب الصفحة بدون حد.
    const quota = { state: 'loading', left: 0, used: 0, week: '' };
    const weekKey = () => { const d = new Date(), t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
      t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return y + '-W' + w; };
    const quotaPath = () => 'data/users/' + uid + '/quota';
    const quotaReady = (async () => {
      if (!window.claude || typeof window.claude.use !== 'function') { quota.state = 'free'; return paintQuota(quota); } // نسخة البيت (السيرفر المحلي)
      const d = await ready, id = await who;
      try { const u = await window.claude.use('user'); if (u && (await u.isOwner())) { quota.state = 'owner'; return paintQuota(quota); } } catch (e) {}
      if (!d || !id) { quota.state = 'signin'; return paintQuota(quota); }
      quota.week = weekKey();
      try {
        const snap = await d.doc(quotaPath()).get();
        const v = snap && (typeof snap.data === 'function' ? snap.data() : snap.data);
        quota.used = v && v.week === quota.week ? (v.used || 0) : 0;
      } catch (e) { quota.used = 0; }
      quota.left = Math.max(0, WEEKLY_GAMES - quota.used); quota.state = 'ok'; paintQuota(quota);
    })();
    function useGame() {
      if (quota.state !== 'ok') return;
      quota.used += 1; quota.left = Math.max(0, WEEKLY_GAMES - quota.used); paintQuota(quota);
      busy = busy.then(async () => { const d = await ready; if (!d || !uid) return;
        try { await d.doc(quotaPath()).set({ week: quota.week, used: quota.used, at: new Date().toISOString() }); } catch (e) {} });
    }
    return { loadExtra, played, quota, quotaReady, useGame };
  })();

  // ---------- اتصال الحَكَم (يشتغل بس إذا اللعبة مفتوحة من السيرفر) ----------
  const NET = { on: false, base: '', ref: false };
  // ---------- الحَكَم أونلاين (نسخة GitHub): التلفزيون والجوال يتكلمون عن طريق MQTT عام ----------
  // كل تلفزيون له كود غرفة، والحَكَم يصوّر الباركود ويفتح ref.html#<الكود>
  const RELAY = { url: 'wss://broker.emqx.io:8084/mqtt', prefix: 'tirakkad-v1/' };
  function initRelay() {
    if (!window.mqtt || !(/github\.io$/.test(location.hostname) || /[?&]relay\b/.test(location.search))) return false;
    let room = '';
    try { room = sessionStorage.getItem('tirakkad-room') || ''; } catch (e) {}
    if (!room) { room = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''); try { sessionStorage.setItem('tirakkad-room', room); } catch (e) {} }
    const T = RELAY.prefix + room + '/';
    const cl = window.mqtt.connect(RELAY.url, { clientId: 'tv-' + room + '-' + Math.random().toString(36).slice(2, 7), clean: true, reconnectPeriod: 2000, connectTimeout: 8000 });
    NET.on = true; NET.relay = cl; NET.room = room; NET.topic = T;
    NET.base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    NET.refUrl = NET.base + 'ref.html#' + room;
    cl.on('connect', () => { cl.subscribe([T + 'ref', T + 'hello', T + 'draw']); pushList(); });
    cl.on('message', (topic, buf) => {
      let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
      if (topic === T + 'draw') { onDraw(m); return; }
      if (topic === T + 'hello') { if (!NET.ref) { NET.ref = true; if (Q && Q.type === 'list') renderView(); } pushList(); return; }
      if (m.adj !== undefined) { refAdjust(+m.adj, +m.d); return; }
      if (m.a) { refAct(m.a); return; }
      onRef(+m.i, +m.team);
    });
    return true;
  }
  // ---- «رسم» مباشر: الرسّام يرسم بجواله (draw.html) والرسمة تطلع على التلفزيون
  // الرسالة: {q: رقم السؤال, t:'s', id, c: اللون, w: السماكة, p: [[x,y],…] (0..1)} أو {t:'clear'} أو {t:'undo'}
  function onDraw(m) {
    if (!Q || Q.variant !== 'draw' || Q.done || !m || m.q !== Q.q.id) return;
    Q.strokes = Q.strokes || [];
    if (m.t === 'clear') Q.strokes = [];
    else if (m.t === 'undo') Q.strokes.pop();
    else if (m.t === 's' && Array.isArray(m.p)) {
      let st = Q.strokes.find((x) => x.id === m.id);
      if (!st) { st = { id: m.id, c: String(m.c || '#13213C').slice(0, 9), w: Math.max(1, Math.min(40, +m.w || 6)), p: [] }; Q.strokes.push(st); }
      m.p.slice(0, 400).forEach((pt) => { if (Array.isArray(pt)) st.p.push([+pt[0] || 0, +pt[1] || 0]); });
      if (!Q.charadeStarted && Q.view === 'question') act('startCharade'); // أول خط يبدأ الوقت
    }
    document.querySelector('.dl-wait')?.remove(); paintDraw();
  }
  function paintDraw() {
    const cv = document.getElementById('drawCv'); if (!cv || !Q) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    (Q.strokes || []).forEach((st) => {
      ctx.strokeStyle = st.c; ctx.fillStyle = st.c; ctx.lineWidth = st.w * W / 400;
      if (st.p.length === 1) { ctx.beginPath(); ctx.arc(st.p[0][0] * W, st.p[0][1] * H, ctx.lineWidth / 2, 0, 7); ctx.fill(); return; }
      ctx.beginPath(); st.p.forEach(([x, y], k) => (k ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H))); ctx.stroke();
    });
  }
  function refAdjust(i, d) { // +/- من جوال الحَكَم على مجموع نقاط الفريق
    if (!G || !G.teams[i] || ![100, -100].includes(d)) return;
    G.teams[i].score += d; save(); sfx[d > 0 ? 'ok' : 'no']();
    if (!$('#scr-board').hidden) renderTeambar(); else if (Q) renderView();
    pushList();
  }
  // «غيّر السؤال» (اضمنها / قول اللي ببالهم): قبل لا يبدأ السؤال، نبدّله بسؤال ثاني من نفس الفئة ونفس النقاط
  function swapPool() {
    if (!Q || !G) return [];
    const onBoard = new Set(G.board.flatMap((c) => c.tiles.map((t) => t.qid)));
    const all = Q.q.cat.questions.filter((x) => x.points === Q.pts && !onBoard.has(x.id) && x.id !== Q.q.id);
    const fresh = all.filter((x) => !seen.has(x.id));
    return fresh.length ? fresh : all;
  }
  const canSwap = () => Q && Q.type === 'list' && Q.view === 'question' && !Q.listStarted && swapPool().length > 0;
  function swapQuestion() {
    if (!canSwap()) return;
    const pool = swapPool(), nq = pool[Math.floor(Math.random() * pool.length)];
    const tile = G.board[Q.ci].tiles[Q.ti]; tile.qid = nq.id; seen.add(nq.id); saveSeen(); save();
    sfx.reveal(); openQuestion(Q.ci, Q.ti);
  }
  function refAct(a) { // أزرار الحَكَم: ابدأ / غلط / تلميح / اكشف الباقي / احسبها
    if (!Q || Q.type !== 'list' || Q.done) return;
    if (a === 'start' && Q.view === 'question' && !Q.listStarted) act('listStart');
    else if (a === 'swap') swapQuestion();
    else if (a === 'pass' && Q.view === 'question' && Q.listStarted) act('listPass');
    else if (a === 'hint' && Q.view === 'question' && (Q.hintsUsed || 0) < 2) act('listLetter');
    else if (a === 'reveal' && Q.view === 'question') act('answer');
    else if (a === 'done' && Q.view !== 'question') act('listDone');
  }
  // ---- نفس الشي داخل كلود (artifact): MQTT ممنوع هناك، فنستخدم «room» حق كلود.
  // التلفزيون يحط حالة اللعبة بـ presence، والجوال (#r- للحَكَم، #d- للرسّام) يحط أوامره بطابور مرقّم بـ presence حقه.
  const ART_URL = 'https://claude.ai/artifact/XqgUKfTvv4EWgvdAwYsKfF';
  async function initRoomTV() {
    if (!window.claude || typeof window.claude.use !== 'function') return false;
    let room = null; try { room = await window.claude.use('room'); } catch (e) {} if (!room) return false;
    let code = ''; try { code = sessionStorage.getItem('tirakkad-room') || ''; } catch (e) {}
    if (!code) { code = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''); try { sessionStorage.setItem('tirakkad-room', code); } catch (e) {} }
    let nr = null; try { nr = await room.join('tk-' + code.toLowerCase()); } catch (e) { return false; }
    NET.on = true; NET.roomTV = nr; NET.room = code; NET.refUrl = ART_URL + '#r-' + code;
    const last = {}; let lastSnap = null;
    const onPeersTV = ({ peers }) => {
      if (peers === lastSnap) return; lastSnap = peers;
      let any = false;
      peers.forEach((p) => {
        if (p.sameTab) return; const tk = p.presence && p.presence.tk; if (!tk || !Array.isArray(tk.q)) { if (tk) any = true; return; }
        any = true; const seen0 = last[p.peer] || 0; let mx = seen0;
        tk.q.forEach((e) => { if (Array.isArray(e) && e[0] > seen0) { handleRemote(e[1], e[2]); mx = Math.max(mx, e[0]); } });
        last[p.peer] = mx;
      });
      NET.peerInfo = `${peers.length - 1} متصل` + (peers.some((p) => !p.sameTab && p.presence && p.presence.tk && p.presence.tk.role === 'draw') ? ' · الرسّام ✓' : '');
      const st = document.getElementById('dlStatus'); if (st) st.textContent = NET.peerInfo;
      if (any !== NET.ref) { NET.ref = any; if (Q && Q.type === 'list') renderView(); pushList(); }
    };
    nr.onPeers(onPeersTV);
    setInterval(() => { try { onPeersTV({ peers: nr.peers() }); } catch (e) {} }, 150); // احتياط لو الصفحة بالخلفية
    pushList(); if (Q) renderView();
    return true;
  }
  function handleRemote(kind, m) {
    if (!m || typeof m !== 'object') return;
    if (kind === 'draw') { onDraw(m); return; }
    if (m.adj !== undefined) { refAdjust(+m.adj, +m.d); return; }
    if (m.a) { refAct(m.a); return; }
    onRef(+m.i, +m.team);
  }
  const drawUrl = (q) => NET.roomTV ? `${ART_URL}#d-${NET.room}-${q.id}` : `${NET.base}draw.html#${NET.room}/${/^(ch|drw)-\d+-[a-z0-9]+$/.test(q.id) ? q.id : 'w.' + b64u(q.prompt)}`;
  async function initNet() {
    if (initRelay()) return;
    if (await initRoomTV()) return;
    if (location.protocol === 'file:' || !/^(localhost|127\.|192\.168\.|10\.|172\.)/.test(location.hostname)) return;
    try {
      const j = await (await fetch('/api/ping', { cache: 'no-store' })).json();
      if (!j.ok) return;
      NET.on = true; NET.base = j.phone_url.replace(/phone\.html.*$/, '');
      const es = new EventSource('/api/stream?role=tv');
      es.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === 'ref') onRef(m.i, m.team);
        if (m.t === 'players') { const was = NET.ref; NET.ref = (m.watchers || 0) > 0; if (was !== NET.ref && Q && Q.type === 'list') renderView(); }
      };
    } catch (e) {}
  }
  function pushList() {
    if (!NET.on) return;
    const L = (Q && Q.type === 'list') ? { question: Q.variant === 'survey' ? Q.q.prompt : Q.q.question, survey: Q.variant === 'survey', items: Q.items.map((it) => ({ t: it.text, v: it.value, trap: it.trap, h: it.hint || '' })), revealed: Q.revealed, teams: G.teams.map((t) => t.name), turn: Q.listTurn,
      started: !!Q.listStarted, view: Q.view, canSwap: canSwap(), hintsLeft: 2 - (Q.hintsUsed || 0), shown: Q.letters, pts: teamPts() } : null;
    if (NET.roomTV) {
      const st = { t: 'state', list: L, game: G ? { teams: G.teams.map((t) => t.name), scores: G.teams.map((t) => t.score), turn: G.turn } : null, draw: Q && Q.variant === 'draw' ? { q: Q.q.id, w: Q.q.prompt } : null };
      const size = (o) => new TextEncoder().encode(JSON.stringify(o)).length;
      if (st.list && size(st) > 3800) st.list = { ...st.list, items: st.list.items.map((it) => ({ ...it, h: '' })) };
      if (size(st) <= 3900) NET.roomTV.presence({ tv: 1, st }).catch(() => {});
      return;
    }
    if (NET.relay) { try { NET.relay.publish(NET.topic + 'state', JSON.stringify({ t: 'state', list: L, game: G ? { teams: G.teams.map((t) => t.name), scores: G.teams.map((t) => t.score), turn: G.turn } : null, at: Date.now() }), { retain: true, qos: 0 }); } catch (e) {} return; }
    fetch('/api/tv/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshot: { phase: L ? 'list' : 'idle', list: L, teams: [] } }) }).catch(() => {});
  }

  // ---------- sound ----------
  let soundOn = true, actx = null;
  try { soundOn = localStorage.getItem('tirakkad-sound') !== 'off'; } catch (e) {}
  function tone(freqs, dur = 0.12, type = 'sine', gap = 0.02, vol = 0.16) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      let t = actx.currentTime;
      freqs.forEach((f) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur); t += dur + gap;
      });
    } catch (e) {}
  }
  const sfx = {
    ok: () => tone([523, 659, 784, 1047], 0.11, 'triangle'),
    no: () => tone([220, 165], 0.22, 'sawtooth', 0.03, 0.1),
    tick: () => tone([880], 0.05, 'square', 0, 0.04),
    end: () => tone([392, 330, 262], 0.25, 'square', 0.02, 0.09),
    reveal: () => tone([660, 990], 0.09, 'triangle'),
    power: () => tone([180, 140, 110], 0.15, 'sawtooth', 0.01, 0.12),
  };
  const paintSound = () => $$('[data-sound]').forEach((b) => (b.innerHTML = ico(soundOn ? 'sound' : 'mute')));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-sound]')) return;
    soundOn = !soundOn;
    try { localStorage.setItem('tirakkad-sound', soundOn ? 'on' : 'off'); } catch (er) {}
    paintSound();
  });

  // ---------- toasts ----------
  function toast(id, text) {
    document.querySelectorAll('.toast.show').forEach((x) => { if (x.id !== id) x.classList.remove('show'); }); // رسالة وحدة بالمرة
    const t = $('#' + id);
    const tx = $('#' + id + 'Txt'); if (text && tx) tx.textContent = text;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 900);
  }
  function turnBanner() {
    if (!G || $('#scr-board').hidden) return;
    const b = $('#turnBanner'), t = G.teams[G.turn];
    b.style.setProperty('--t', `var(--team-${G.turn + 1})`);
    b.innerHTML = `<span class="tb-sw"></span><span>الدور على <b>${esc(t.name)}</b></span>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._h); b._h = setTimeout(() => b.classList.remove('show'), 2600);
  }

  // ---------- screens ----------
  // أي رسالة طايرة (صح لسانك / الدور على…) تختفي فوراً أول ما نطلع من اللوحة، عشان ما تغطي السؤال
  let bannerT = null;
  function clearOverlays() {
    clearTimeout(bannerT); bannerT = null;
    $$('.toast.show, #turnBanner.show').forEach((x) => { clearTimeout(x._h); x.classList.remove('show'); });
  }
  // المسرح: نحسب كم نكبّر/نصغّر لوحة 1280×720 عشان تعبّي الشاشة بدون تمرير
  // ---------- وضع التلفزيون (screen mirroring): شاشة كاملة + هامش للحواف عشان التلفزيون ما يقص شي ----------
  const TV = { on: false, pad: 5 };
  try { Object.assign(TV, JSON.parse(localStorage.getItem('tirakkad-tv') || '{}')); } catch (e) {}
  TV.pad = Math.max(0, Math.min(12, +TV.pad || 0));
  let wakeLock = null;
  function saveTV() { try { localStorage.setItem('tirakkad-tv', JSON.stringify(TV)); } catch (e) {} }
  function applyTV() {
    document.documentElement.classList.toggle('tv-mode', TV.on);
    document.documentElement.style.setProperty('--tv-pad', TV.on ? TV.pad : 0);
    document.querySelectorAll('[data-tv]').forEach((b) => { b.classList.toggle('on', TV.on); b.setAttribute('aria-pressed', String(TV.on)); });
    fitStage();
  }
  async function keepAwake() { try { if (TV.on && navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
  function enterFull() { const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; try { const p = f && f.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  function exitFull() { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (document.webkitFullscreenElement) document.webkitExitFullscreen(); } catch (e) {} }
  function tvCalib() {
    let box = document.getElementById('tvCalib');
    if (!box) { box = document.createElement('div'); box.id = 'tvCalib'; box.dir = 'rtl'; document.body.appendChild(box); }
    const paint = () => {
      box.innerHTML = `<div class="tvc-frame"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
        <div class="tvc-panel">
          <h2>📺 ضبط حواف التلفزيون</h2>
          <p>لازم تشوف <b>الزوايا الأربع الصفرا كاملة</b> على التلفزيون. إذا وحدة منها مقصوصة اضغط <b>+</b> لين تبين كلها.</p>
          <div class="tvc-row"><button class="btn" data-tvc="-" aria-label="هامش أقل">−</button><span class="tvc-val num">${TV.pad}%</span><button class="btn" data-tvc="+" aria-label="هامش أكثر">+</button></div>
          <p class="tvc-tip">💡 من الآيفون: اقلب الجوال بالعرض وشغّل «انعكاس الشاشة» (Screen Mirroring) من مركز التحكم. وعشان يختفي شريط سفاري: زر المشاركة ← «إضافة إلى الشاشة الرئيسية» وافتح اللعبة من الأيقونة.</p>
          <div class="tvc-row"><button class="btn ans-btn" data-tvc="ok">تمام</button><button class="btn ghost" data-tvc="off">اطفي وضع التلفزيون</button></div>
        </div></div>`;
    };
    paint(); box.hidden = false;
    box.onclick = (e) => {
      const b = e.target.closest('[data-tvc]'); if (!b) return;
      const k = b.dataset.tvc;
      if (k === '+' || k === '-') { TV.pad = Math.max(0, Math.min(12, TV.pad + (k === '+' ? 1 : -1))); saveTV(); applyTV(); paint(); }
      else if (k === 'ok') box.hidden = true;
      else if (k === 'off') { TV.on = false; saveTV(); applyTV(); exitFull(); box.hidden = true; }
    };
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tv]'); if (!b) return;
    if (!TV.on) { TV.on = true; saveTV(); applyTV(); enterFull(); keepAwake(); }
    tvCalib();
  });
  // الماوس يختفي بعد ثانيتين بوضع التلفزيون
  let idleT = null;
  document.addEventListener('mousemove', () => { document.documentElement.classList.remove('tv-idle'); clearTimeout(idleT); if (TV.on) idleT = setTimeout(() => document.documentElement.classList.add('tv-idle'), 2000); });

  function fitStage() {
    const vv = window.visualViewport;
    const p = TV.on ? TV.pad / 100 : 0;
    const w = (vv ? vv.width : innerWidth) * (1 - 2 * p), h = (vv ? vv.height : innerHeight) * (1 - 2 * p);
    document.documentElement.style.setProperty('--stage-s', Math.min(w / 1280, h / 720).toFixed(4));
  }
  applyTV();
  window.addEventListener('resize', fitStage);
  document.addEventListener('fullscreenchange', fitStage);
  if (window.visualViewport) visualViewport.addEventListener('resize', fitStage);
  function show(id) { if (id !== 'scr-board') clearOverlays(); $$('.screen').forEach((s) => (s.hidden = s.id !== id)); window.scrollTo(0, 0); }

  /* =================== HOME / SETUP =================== */
  const randomCats = () => { const ids = BANK.categories.map((c) => c.id); const pick = shuffle(ids).slice(0, MAX_CATS); return ids.filter((x) => pick.includes(x)); };
  const setup = {
    teams: 2,
    names: TEAMS.map((t) => t.name),
    helps: TEAMS.map(() => ['strike', 'call', 'tarakkad']),
    cats: [],
  };

  function renderTeamSetup() {
    $('#teamSetup').style.setProperty('--n', setup.teams);
    $('#teamSetup').innerHTML = TEAMS.slice(0, setup.teams).map((t, i) => `
      <div class="team-box" style="--t:var(--team-${i + 1})">
        <div class="tb-head"><span class="shape ${t.shape}" style="background:var(--t)"></span>
          <label class="sr" for="tn${i}">اسم الفريق ${i + 1}</label>
          <input id="tn${i}" data-i="${i}" maxlength="22" value="${esc(setup.names[i])}"></div>
        <div class="tb-helps" role="group" aria-label="وسائل المساعدة">
          ${PICK_KEYS.map((k) => `<button class="hp-pick" data-team="${i}" data-help="${k}" aria-pressed="${setup.helps[i].includes(k)}" title="${esc(HELPS[k].tip)}">${ico(HELPS[k].icon)}<span>${HELPS[k].name}</span></button>`).join('')}
        </div>
      </div>`).join('');
  }
  $('#teamSetup').addEventListener('input', (e) => { if (e.target.dataset.i) setup.names[+e.target.dataset.i] = e.target.value; });
  $('#teamSetup').addEventListener('click', (e) => {
    const b = e.target.closest('.hp-pick'); if (!b) return;
    const i = +b.dataset.team, k = b.dataset.help, list = setup.helps[i];
    if (list.includes(k)) setup.helps[i] = list.filter((x) => x !== k);
    else { if (list.length >= 3) list.shift(); list.push(k); }
    renderTeamSetup();
  });
  $('#segTeams').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#segTeams button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    setup.teams = +b.dataset.v; renderTeamSetup();
  });

  // مجموعات الفئات (مثل الألعاب الاحترافية: كل مجموعة بلوحة، وتقدر تسكّرها)
  const CAT_GROUPS = [
    ['الكويت', ['kuwait', 'kuwait-malls', 'kuwait-logos', 'kuwait-products', 'proverbs', 'kuwaiti-series', 'food', 'restaurants']],
    ['عام', ['general-knowledge', 'yes-no', 'science', 'tech', 'history', 'cars', 'brands', 'logos', 'products']],
    ['دول', ['geography', 'capitals', 'flags', 'landmarks']],
    ['تحدّي وتفكير', ['draw', 'jni', 'zoom', 'guess-image', 'charades', 'survey', 'letters', 'memory', 'riddles', 'lists']],
    ['إسلامي وأهل البيت', ['islamic', 'prophets', 'sira-ahlulbayt', 'imams', 'karbala', 'maraqid', 'ashab-ulama', 'fiqh-sistani', 'duas-ziyarat', 'latmiyat']],
    ['كورة ورسوم', ['football', 'cartoons']],
    ['بنات', ['girls-world', 'beauty']],
  ];
  const closedGroups = new Set();
  function catGroups() {
    const used = new Set(), out = [];
    CAT_GROUPS.forEach(([name, ids]) => {
      const list = ids.filter((id) => catById[id] && !used.has(id));
      list.forEach((id) => used.add(id));
      if (list.length) out.push([name, list]);
    });
    const rest = BANK.categories.map((c) => c.id).filter((id) => !used.has(id));
    if (rest.length) out.push(['فئات ثانية', rest]);
    return out;
  }
  const pcArt = (c) => COVERS.has(c.id)
    ? `<img src="img/covers/${c.id}.jpg" alt="" loading="lazy" decoding="async">`
    : artOf(c);
  function renderCatPick() {
    $('#catPick').innerHTML = catGroups().map(([name, ids], gi) => `
      <section class="cg${closedGroups.has(name) ? ' closed' : ''}" data-g="${esc(name)}">
        <h3 class="cg-h">${esc(name)}</h3>
        <button class="cg-x" data-toggle="${esc(name)}" aria-expanded="${!closedGroups.has(name)}" aria-label="${closedGroups.has(name) ? 'افتح' : 'سكّر'} مجموعة ${esc(name)}">${closedGroups.has(name) ? '+' : '−'}</button>
        <div class="cg-grid">${ids.map((id) => {
          const c = catById[id], n = setup.cats.indexOf(id);
          return `<div class="pc${n >= 0 ? ' on' : ''}" data-id="${id}" role="button" tabindex="0" aria-pressed="${n >= 0}" style="--cc:${catColor(id)}">
            <span class="pc-art">${pcArt(c)}</span>
            <b class="pc-name">${esc(c.name)}</b>
            <span class="pc-i" data-eye="${id}" role="button" tabindex="0" title="شنو داخل الفئة؟" aria-label="شوف نماذج من فئة ${esc(c.name)}">i</span>
            ${n >= 0 ? `<span class="pc-n num">${n + 1}</span>` : ''}
          </div>`;
        }).join('')}</div>
      </section>`).join('');
    filterCats();
    const need = Math.min(MAX_CATS, BANK.categories.length);
    $('#pbSlots').innerHTML = Array.from({ length: need }, (_, i) => {
      const id = setup.cats[i];
      return id
        ? `<button class="pb-s on" data-rm="${id}" style="--cc:${catColor(id)}" title="شيل ${esc(catById[id].name)}">${pcArt(catById[id])}<span>${esc(catById[id].name)}</span></button>`
        : `<span class="pb-s"><span class="num">${i + 1}</span></span>`;
    }).join('');
    $('#catCount').textContent = `${setup.cats.length} من ${need}`;
    $('#catHint').textContent = setup.cats.length < need ? `باقي ${need - setup.cats.length}` : 'جاهزين!';
    $('#pickBar').classList.toggle('full', setup.cats.length === need);
  }
  $('#pbSlots').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) toggleCat(b.dataset.rm); });
  $('#btnToTeams').addEventListener('click', () => $('#teamsSec').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => $('#btnToTeams').hidden = en.isIntersecting, { threshold: .15 }).observe($('#teamsSec'));
  function hint(t) { if (!$('#scr-win').hidden) { $('#btnAgain').textContent = t; return; } const el = $('#catHint'); el.textContent = t; el.classList.remove('warn'); void el.offsetWidth; el.classList.add('warn'); }
  function toggleCat(id) {
    if (setup.cats.includes(id)) setup.cats = setup.cats.filter((x) => x !== id);
    else if (setup.cats.length < MAX_CATS) setup.cats = [...setup.cats, id];
    else { hint('شيلوا فئة أول، الحد ست فئات'); return false; }
    renderCatPick(); return true;
  }
  $('#catPick').addEventListener('click', (e) => {
    const tg = e.target.closest('[data-toggle]');
    if (tg) { const n = tg.dataset.toggle; closedGroups.has(n) ? closedGroups.delete(n) : closedGroups.add(n); renderCatPick(); return; }
    const eye = e.target.closest('[data-eye]');
    if (eye) { openCatPreview(eye.dataset.eye); return; }
    const b = e.target.closest('.pc'); if (b) toggleCat(b.dataset.id);
  });
  $('#catPick').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const eye = e.target.closest('[data-eye]'); const b = e.target.closest('.pc');
    if (eye || b) e.preventDefault();
    if (eye) openCatPreview(eye.dataset.eye); else if (b) toggleCat(b.dataset.id);
  });
  $('#btnRandCats').addEventListener('click', () => { setup.cats = randomCats(); renderCatPick(); sfx.reveal(); });

  const KIND = { trivia: 'سؤال وجواب', charades: 'ولا كلمة (تمثيل)', survey: 'قول اللي ببالهم', letters: 'سؤال وتلميح أول حرف', draw: 'رسم: واحد يشوف الكلمة بالباركود ويرسمها', jni: 'كلمة (جماد، نبات، إنسان…) وبعض حروفها مكشوفة', zoom: 'صورة مقرّبة تبعد شوي شوي. صاحب الدور عنده 15/25/30 ثانية، وبعدها الفريق الثاني 5 ثواني', guess: 'صورة ترمز لمثل أو كلمة، وانتوا تعرفونه', memory: 'مشهد يطلع ١٠ ثواني ويختفي، وبعده سؤال عن تفاصيله', list: 'قائمة أجوبة، والحَكَم معاه الكود' };
  function openCatPreview(id) {
    const c = catById[id]; if (!c) return;
    const kind = ['draw', 'jni', 'zoom', 'guess'].includes(c.type) ? KIND[c.type] : c.questions.some((x) => x.image) ? 'سؤال بصورة' : c.questions.some((x) => x.emoji) ? 'خمّن من الإيموجي' : KIND[c.type || 'trivia'];
    const samples = c.type === 'memory'
      ? '<li><span>تطلع لكم قائمة أو مشهد ١٠ ثواني، وبعدها يختفي وتنسألون عن تفصيلة فيه.</span></li>'
      : [200, 400, 600].map((pts) => {
        const q = sampleOf(c, pts); if (!q) return '';
        const txt = (q.emoji ? q.emoji + '  ' : '') + (q.question || q.prompt || '');
        return `<li><span class="s-pts num" style="--cc:${catColor(id)}">${pts}</span><span>${esc(txt)}</span></li>`;
      }).join('');
    $('#catDlgBody').innerHTML = `
      <div class="cat-dlg-head" style="--cc:${catColor(id)}">
        <span class="medal big">${artOf(c)}</span>
        <div><h2>${esc(c.name)}</h2><p class="muted">${esc(catDesc(id))}</p><span class="pill">${esc(kind)}</span></div>
      </div>
      <p class="lbl">نماذج (ما تطلع باللعبة):</p>
      <ul class="sample-q">${samples}</ul>`;
    const pick = $('#catDlgPick'), on = setup.cats.includes(id);
    pick.dataset.id = id; pick.textContent = on ? 'مختارة — شيلها' : 'أضفها للعبة'; pick.classList.toggle('ghost', on);
    $('#dlgCat').showModal();
  }
  $('#catDlgPick').addEventListener('click', (e) => { if (toggleCat(e.currentTarget.dataset.id) !== false) $('#dlgCat').close(); });
  $('#catDlgClose').addEventListener('click', () => $('#dlgCat').close());
  $('#btnHelp').addEventListener('click', () => $('#dlgHelp').showModal());

  /* =================== LANDING + SETUP STEPS =================== */
  const HELP_COLORS = { strike: 'var(--coral)', call: 'var(--green)', double: 'var(--cobalt)', tarakkad: '#7446D1', options: '#E57A12' };
  const HELP_WHEN = { strike: 'من اللوحة، قبل لا تختارون السؤال', call: 'وقت السؤال', double: 'وقت السؤال', tarakkad: 'وقت السؤال، على الفريق الثاني', options: 'وقت السؤال، لكل فريق مرة' };
  function renderLanding() {
    const cc = window.TIRAKKAD_COVER_CREDITS || {}, ul = $('#coverCredits');
    if (ul) {
      ul.innerHTML = '';
      Object.keys(cc).forEach((id) => {
        if (!catById[id]) return;
        const li = document.createElement('li'), x = cc[id];
        li.append(`${catById[id].name}: `);
        const lk = document.createElement('a'); lk.textContent = `${x.a || 'Wikimedia Commons'} — ${x.l}`;
        if (/^https:\/\//.test(x.p)) { lk.href = x.p; lk.target = '_blank'; lk.rel = 'noopener'; }
        li.append(lk); ul.append(li);
      });
    }
    $('#statCats').textContent = BANK.categories.length;
    $('#statQs').textContent = BANK.categories.reduce((n, c) => n + c.questions.length, 0);
    $('#helpGrid').innerHTML = HELP_KEYS.map((k) => `
      <article class="help-card" style="--hc:${HELP_COLORS[k]}">
        <div class="hc-ic">${ico(HELPS[k].icon)}</div>
        <h3>${HELPS[k].name}</h3><p>${esc(HELPS[k].tip)}</p><small>تنستخدم: ${HELP_WHEN[k]}</small>
      </article>`).join('');
    const SPECIAL = [
      ['lists', 'حَكَم معاه القائمة على جواله، والفريقين يتناوبون ٣٠ ثانية. كل جواب صح يطلع على الشاشة بلون الفريق.'],
      ['charades', 'واحد يصوّر الباركود ويشوف الكلمة، ويمثّلها بدون ولا كلمة، وفريقه يحزر في ٦٠ ثانية.'],
      ['memory', 'مقطع فيديو أقل من دقيقة. ركّزوا زين، لأن بعده يطلع سؤال عن تفصيلة فيه.'],
      ['letters', 'سؤال، ولوحة حروف ينوّر فيها أول حرف من الجواب.'],
      ['logos', 'تطلع صورة الشعار بدون اسم، وانتوا تعرفون الماركة.'],
      ['survey', 'اذكروا أكثر أجوبة يقولها الناس، وكل جواب له نسبة.'],
    ].filter(([id]) => catById[id]);
    $('#specialRow').innerHTML = SPECIAL.map(([id, txt]) => {
      const c = catById[id];
      return `<article class="sp-card" style="--cc:${catColor(id)}"><div class="sp-top">${catImg(c)}</div>
        <div class="sp-body"><h3>${esc(c.name)}</h3><p>${esc(txt)}</p><button class="btn ghost sm" data-eye="${id}">${ico('eye')}شوف نماذج</button></div></article>`;
    }).join('');
    const pick = shuffle(BANK.categories).slice(0, 6);
    $('#heroBoard').innerHTML = pick.map((c, i) => {
      const col = (side) => [200, 400, 600].map((p, k) => `<span class="mb-t ${(i + k + side) % 5 === 0 ? 'hot' : ''}" style="--d:${(i + k) % 4}">${p}</span>`).join('');
      return `<div class="mb" style="--i:${i};--cc:${catColor(c.id)}"><div class="mb-col">${col(0)}</div><div class="mb-c">${catImg(c)}</div><div class="mb-col">${col(1)}</div></div>`;
    }).join('');
  }
  $('#specialRow').addEventListener('click', (e) => { const b = e.target.closest('[data-eye]'); if (b) openCatPreview(b.dataset.eye); });
  function setupStep() { renderTeamSetup(); renderCatPick(); window.scrollTo(0, 0); }
  function filterCats() {
    const q = ($('#catSearch') ? $('#catSearch').value : '').trim();
    $$('#catPick .pc').forEach((c) => { const cat = catById[c.dataset.id]; c.classList.toggle('filtered', !!q && !(`${cat.name} ${catDesc(cat.id)}`).includes(q)); });
    $$('#catPick .cg').forEach((g) => g.classList.toggle('empty', !g.querySelector('.pc:not(.filtered)')));
    $('#catPick').classList.toggle('searching', !!q);
  }
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]'); if (!g) return;
    if (g.dataset.go === 'setup') { show('scr-setup'); setupStep(); }
    else goHome();
  });
  $('#catSearch').addEventListener('input', filterCats);

  /* =================== GAME STATE =================== */
  let G = null; // اللعبة
  let Q = null; // السؤال المفتوح
  const pending = new Set(); // مؤقتات مربوطة بالسؤال الحالي — تنلغى لما يتسكر
  const later = (fn, ms) => { const id = setTimeout(() => { pending.delete(id); fn(); }, ms); pending.add(id); return id; };
  const cancelPending = () => { pending.forEach(clearTimeout); pending.clear(); };

  function newGame() {
    const teams = TEAMS.slice(0, setup.teams).map((t, i) => ({
      name: (setup.names[i] || '').trim() || t.name, shape: t.shape, score: 0,
      helps: Object.fromEntries([...setup.helps[i], 'options'].map((k) => [k, true])), // true = متاحة، false = انستخدمت
    }));
    const board = setup.cats.map((cid) => {
      const cat = catById[cid], tiles = [];
      [200, 400, 600].forEach((pts) => {
        const all = cat.questions.filter((q) => q.points === pts);
        // الجديدة أول، وإذا ما كفّت نكمّل من اللي انلعبت (عشوائي). إذا كلها انلعبت نبدأ دورة جديدة
        let fresh = all.filter((q) => !seen.has(q.id));
        if (!fresh.length) { all.forEach((q) => seen.delete(q.id)); fresh = all; }
        const smp = sampleOf(cat, pts);
        if (fresh.length > 2 && cat.type !== 'memory') fresh = fresh.filter((q) => q !== smp); // سؤال العيّنة ما يطلع إذا فيه بديل
        const old = all.filter((q) => !fresh.includes(q));
        [...shuffle(fresh), ...shuffle(old)].slice(0, 2).forEach((q) => tiles.push({ qid: q.id, pts, by: null }));
      });
      return { cid, tiles };
    });
    G = { teams, board, turn: 0, strike: null, ver: BANK.version };
    board.forEach((col) => col.tiles.forEach((t) => seen.add(t.qid))); saveSeen(); // اللي طلع باللوحة ما يرجع باللعبة الجاية
    cloud.played(setup.cats); cloud.useGame();
    save(); renderBoard(); show('scr-board'); turnBanner();
  }
  $('#btnStart').addEventListener('click', () => {
    if (setup.cats.length !== Math.min(MAX_CATS, BANK.categories.length)) {
      $('#pickBar').scrollIntoView({ behavior: 'smooth', block: 'end' });
      hint(`اختاروا ${MAX_CATS} فئات أول`); return;
    }
    if (!canPlay()) return;
    sfx.reveal(); newGame();
  });
  function canPlay() {
    const q = cloud.quota;
    if (q.state === 'loading') { hint('لحظة… قاعد نشيّك على عدد ألعابك'); cloud.quotaReady.then(() => {}); return false; }
    if (q.state === 'signin') { hint(`لازم تسجّل دخول بحساب Claude عشان تلعب (${WEEKLY_GAMES} ألعاب ببلاش كل أسبوع)`); return false; }
    if (q.state === 'ok' && q.left <= 0) { hint('خلصت ألعابك هالأسبوع، ترجع تتجدد يوم الاثنين'); return false; }
    return true;
  }
  $('#btnResume').addEventListener('click', () => { const g = load(); if (!g) { $('#btnResume').hidden = true; return; } G = g; renderBoard(); show('scr-board'); turnBanner(); });
  function goHome() { stopClock(); cancelPending(); Q = null; $('#turnBanner').classList.remove('show'); $('#btnResume').hidden = !load(); show('scr-home'); }
  $('#btnHome').addEventListener('click', goHome);
  // تأكيد بضغطتين (نوافذ confirm ما تشتغل بصفحات claude.ai)
  let endArmed = null;
  $('#btnEnd').addEventListener('click', () => {
    const btn = $('#btnEnd');
    if (endArmed) { clearTimeout(endArmed); endArmed = null; btn.classList.remove('armed'); btn.innerHTML = btn.dataset.html; showWinner(); return; }
    btn.dataset.html = btn.innerHTML;
    btn.classList.add('armed'); btn.textContent = 'متأكدين؟ اضغطوا مرة ثانية';
    endArmed = setTimeout(() => { endArmed = null; btn.classList.remove('armed'); btn.innerHTML = btn.dataset.html; }, 3500);
  });
  $('#btnWinHome').addEventListener('click', () => { clearSave(); G = null; goHome(); });
  $('#btnAgain').addEventListener('click', () => { if (!canPlay()) return; clearSave(); newGame(); });

  /* =================== BOARD =================== */
  const shapeEl = (t, i) => `<span class="shape ${t.shape}" style="background:var(--team-${i + 1})"></span>`;
  function tileBtn(t, ci, ti, cat) {
    if (t.by !== null) return `<button class="tile6 used" disabled aria-label="${esc(cat.name)} ${t.pts} — انلعب"><span class="num">${t.pts}</span></button>`;
    const lbl = cat.type === 'survey' ? itemTotal(qById[t.qid], cat.type) : t.pts;
    return `<button class="tile6 num" data-c="${ci}" data-t="${ti}" aria-label="${esc(cat.name)} ${lbl}">${lbl}</button>`;
  }
  function renderBoard() {
    $('#board').innerHTML = G.board.map((col, ci) => {
      const cat = catById[col.cid];
      // البلاطات بالترتيب 200,200,400,400,600,600 — نوزعها على الجنبين
      const right = [0, 2, 4].map((ti) => tileBtn(col.tiles[ti], ci, ti, cat)).join('');
      const left = [1, 3, 5].map((ti) => tileBtn(col.tiles[ti], ci, ti, cat)).join('');
      return `<div class="cblock" style="--cc:${catColor(cat.id)}">
        <div class="tcol">${right}</div>
        <div class="ccard${COVERS.has(cat.id) ? ' has-cover' : ''}"${COVERS.has(cat.id) ? ` style="--cover:url('img/covers/${cat.id}.jpg')"` : ''}><span class="medal">${artOf(cat)}</span><b>${esc(cat.name)}</b></div>
        <div class="tcol">${left}</div>
      </div>`;
    }).join('');
    const left = G.board.reduce((n, c) => n + c.tiles.filter((t) => t.by === null).length, 0);
    $('#leftCount').textContent = left;
    paintTurn('#turnPill');
    renderTeambar();
    if (left === 0) later(showWinner, 600);
  }
  function paintTurn(sel) {
    const t = G.teams[G.turn];
    $(sel).style.setProperty('--t', `var(--team-${G.turn + 1})`);
    $(sel).innerHTML = `${shapeEl(t, G.turn)}دور <b>${esc(t.name)}</b>`;
  }
  function helpIcon(team, i, k, where) {
    const st = team.helps[k];
    if (st === undefined) return '';
    const armed = k === 'strike' && G.strike === i;
    const usable = st && ((where === 'board' && k === 'strike' && i === G.turn) || (where === 'q' && k !== 'strike' && Q && Q.view === 'question' && !Q.sceneOpen && (k !== 'options' || (Q.type === 'trivia' && Q.q.options && !Q.showOpts))));
    return `<button class="hicon ${st ? '' : 'used'} ${armed ? 'armed' : ''} ${usable ? 'usable' : ''}" ${usable ? '' : 'aria-disabled="true"'} data-team="${i}" data-help="${k}" title="${esc(HELPS[k].name)}: ${esc(HELPS[k].tip)}">${ico(HELPS[k].icon)}<span>${HELPS[k].name}</span></button>`;
  }
  function renderTeambar() {
    $('#teambar').style.setProperty('--n', G.teams.length);
    $('#teambar').innerHTML = G.teams.map((t, i) => `
      <div class="tcard ${i === G.turn ? 'active' : ''}" style="--t:var(--team-${i + 1})">
        <div class="tc-name">${shapeEl(t, i)}<span>${esc(t.name)}</span>${i === G.turn ? '<small>دورهم</small>' : ''}</div>
        <div class="tc-score">
          <button class="pm" data-pm="${i}" data-d="-100" aria-label="ناقص ١٠٠">−</button>
          <span class="num">${t.score}</span>
          <button class="pm" data-pm="${i}" data-d="100" aria-label="زايد ١٠٠">+</button>
        </div>
        <div class="tc-helps">${HELP_KEYS.map((k) => helpIcon(t, i, k, 'board')).join('')}</div>
        ${G.strike === i ? '<div class="armed-note">الحفرة شغّالة على السؤال الجاي</div>' : ''}
      </div>`).join('');
  }
  $('#teambar').addEventListener('click', (e) => {
    const pm = e.target.closest('[data-pm]');
    if (pm) { const i = +pm.dataset.pm; G.teams[i].score += +pm.dataset.d; save(); renderTeambar(); pushList(); return; }
    const h = e.target.closest('.hicon');
    if (h && h.dataset.help === 'strike') {
      const i = +h.dataset.team;
      if (i !== G.turn || G.teams[i].helps.strike !== true) return;
      G.strike = G.strike === i ? null : i;
      if (G.strike !== null) { sfx.power(); toast('toastOk', `${G.teams[i].name}: الحفرة شغّالة`); }
      save(); renderTeambar();
    }
  });
  $('#board').addEventListener('click', (e) => {
    const b = e.target.closest('.tile6[data-c]'); if (b) openQuestion(+b.dataset.c, +b.dataset.t);
  });

  /* =================== CLOCK =================== */
  const C = { mode: 'up', sec: 0, total: 0, iv: null, running: false, onEnd: null };
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  function paintClock() {
    $('#clkNum').textContent = fmt(C.sec);
    $('#clock').classList.toggle('down', C.mode === 'down');
    $('#clock').classList.toggle('danger', C.mode === 'down' && C.sec <= 5 && C.sec > 0);
    $('#clock').classList.toggle('done', C.mode === 'down' && C.sec === 0);
    $('#clkToggle').innerHTML = ico(C.running ? 'pause' : 'play');
  }
  function setClock(mode, sec = 0, onEnd = null) { stopClock(); C.mode = mode; C.sec = C.total = sec; C.onEnd = onEnd; paintClock(); }
  function startClock() {
    stopClock(); C.running = true; paintClock();
    C.iv = setInterval(() => {
      if (C.mode === 'up') C.sec++;
      else if (C.sec > 0) {
        C.sec--;
        if (C.sec > 0 && C.sec <= 5) sfx.tick();
        if (C.sec === 0) { sfx.end(); stopClock(); const f = C.onEnd; C.onEnd = null; if (f) f(); }
      }
      paintClock();
    }, 1000);
  }
  function stopClock() { clearInterval(C.iv); C.iv = null; C.running = false; paintClock(); }
  $('#clkToggle').addEventListener('click', () => { if (C.running) stopClock(); else if (C.mode === 'up' || C.sec > 0) startClock(); });
  $('#clkReset').addEventListener('click', () => { C.sec = C.total; paintClock(); if (C.mode === 'up' || C.running) startClock(); });

  /* =================== QUESTION =================== */
  function openQuestion(ci, ti) {
    cancelPending();
    const tile = G.board[ci].tiles[ti];
    if (!tile || tile.by !== null) return;
    const q = qById[tile.qid];
    const variant = q.cat.type || 'trivia';
    const type = ['letters', 'memory', 'jni', 'zoom', 'guess'].includes(variant) ? 'trivia' : variant === 'survey' ? 'list' : variant === 'draw' ? 'charades' : variant;
    Q = { ci, ti, q, type, variant, pts: tile.pts, view: 'question', done: false, flags: [], opened: new Set(), strikes: 0, counts: G.teams.map(() => 0), listTurn: G.turn, sceneOpen: variant === 'memory' && !!(q.scene || q.video), charadeStarted: false,
      items: type === 'list' ? buildItems(q, variant) : [], revealed: [], listStarted: false, letters: {}, letterUsed: false, pickSlot: null };
    Q.revealed = Q.items.map(() => null);
    $('#qStage').style.setProperty('--cc', catColor(q.cat.id));
    $('#qVal').textContent = `${tile.pts} نقطة`;
    $('#qCat').textContent = q.cat.name;
    paintTurn('#qTurn');
    show('scr-q');
    if (type === 'charades') setClock('down', 60, () => { if (Q) toast('toastNo'); });
    else if (type === 'list') setClock('down', 30, listTimeout);
    else if (variant === 'zoom') { setClock('down', ZOOM_SEC[tile.pts] || 25, zoomTimeout); startClock(); }
    else if (Q.sceneOpen && q.video) setClock('down', Math.min(60, Math.ceil(q.video_duration || 60)) + 1, () => hideScene());
    else if (Q.sceneOpen) { setClock('down', 10, () => hideScene()); startClock(); }
    else { setClock('up', 0); startClock(); }
    renderView();
  }

  function renderSide() {
    $('#qSide').innerHTML = G.teams.map((t, i) => `
      <div class="side-team ${i === G.turn ? 'active' : ''}" style="--t:var(--team-${i + 1})">
        <div class="st-name">${esc(t.name)}</div>
        <div class="st-score num">${t.score}</div>
        <div class="st-helps">${HELP_KEYS.map((k) => helpIcon(t, i, k, 'q')).join('')}</div>
      </div>`).join('') + (Q.flags.length ? `<div class="side-flags">${Q.flags.map((f) => `<div class="flag-note">${f.replace('{CALL}', Math.max(0, Q.callLeft || 0))}</div>`).join('')}</div>` : '');
  }
  $('#qSide').addEventListener('click', (e) => {
    const h = e.target.closest('.hicon'); if (!h || !Q || Q.view !== 'question' || Q.sceneOpen) return;
    const i = +h.dataset.team, k = h.dataset.help, t = G.teams[i];
    if (k === 'strike' || t.helps[k] !== true) return;
    t.helps[k] = false; save(); sfx.power();
    if (k === 'call') { Q.flags.push(`${ico('phone')}<span>${esc(t.name)}: اتصلوا بخويكم، باقي <b class="num" id="callLeft">{CALL}</b> ثانية</span>`); Q.callLeft = 30; startCallTimer(); }
    if (k === 'double') { Q.flags.push(`${ico('two')}<span>${esc(t.name)}: معاهم جوابين</span>`); toast('toastOk', `${t.name}: جوابين`); }
    if (k === 'options') { Q.showOpts = true; Q.flags.push(`${ico('list')}<span>${esc(t.name)} استخدموا «الخيارات»</span>`); sfx.reveal(); renderView(); return; }
    if (k === 'tarakkad') { Q.flags.push(`${ico('hand')}<span>${esc(t.name)} استخدموا «تركّد»: أذكى واحد بالفريق الثاني يركد بهالسؤال</span>`); toast('toastNo'); }
    renderSide();
  });
  function startCallTimer() {
    const tick = () => {
      if (!Q) return;
      Q.callLeft--;
      const el = $('#callLeft'); if (el) el.textContent = Math.max(0, Q.callLeft);
      if (Q.callLeft > 0) later(tick, 1000); else sfx.end();
    };
    later(tick, 1000);
  }

  function renderView() {
    if (Q.type === 'charades') renderCharades();
    else if (Q.type === 'survey') renderSurvey();
    else if (Q.type === 'list') renderList();
    else renderTrivia();
    renderSide();
    $('#btnBack').hidden = Q.view !== 'question';
    $('#qStage').dataset.view = Q.view;
  }

  // --- trivia (يشمل: صورة، إيموجي، أول حرف، ركّز معاي)
  function letterBoard(letter, answer) {
    const pool = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('').filter((x) => x !== letter);
    const tiles = shuffle([letter, ...shuffle(pool).slice(0, 9)]);
    const hasAl = /^ال/.test(String(answer || '').trim());
    return `<div class="letter-board">${tiles.map((x) => `<span class="lt ${x === letter ? 'on' : ''}">${esc(x)}</span>`).join('')}</div>
      <p class="letter-hint">${hasAl ? 'الجواب بعد «ال» يبدأ بحرف' : 'الجواب يبدأ بحرف'} <b>${esc(letter)}</b></p>`;
  }
  // جماد نبات إنسان: نوع الكلمة + تلميح + خانات الحروف (بعضها مكشوف)
  function jniBoard(q) {
    const cells = [...String(q.pattern)].map((ch) => ch === ' ' ? '<span class="jc gap"></span>' : `<span class="jc ${ch === '_' ? '' : 'on'}">${ch === '_' ? '' : esc(ch)}</span>`).join('');
    return `<div class="jni"><span class="jni-kind">${esc(q.kind || '')}</span><div class="jni-cells">${cells}</div></div>`;
  }
  // زووم — القانون: الفريق اللي اختار السؤال عنده 15/25/30 ثانية (200/400/600)،
  // وإذا خلص الوقت السؤال يروح للفريق الثاني وعندهم 5 ثواني بس
  const ZOOM_SEC = { 200: 15, 400: 25, 600: 30 };
  function zoomTimeout() {
    if (!Q || Q.variant !== 'zoom' || Q.view !== 'question') return;
    const n = G.teams.length;
    if (Q.zoomSteal == null && n > 1) {
      Q.zoomSteal = (G.turn + 1) % n; const t = G.teams[Q.zoomSteal];
      Q.flags.push(`${ico('hand')}<span>خلص الوقت! الدور على <b>${esc(t.name)}</b>، عندهم 5 ثواني</span>`);
      toast('toastNo', `${t.name}: 5 ثواني!`);
      setClock('down', 5, zoomTimeout); startClock(); renderView();
    } else {
      Q.flags.push(`${ico('x')}<span>خلص الوقت ومحد جاوب</span>`); renderView();
    }
  }
  // زووم: الصورة تبدأ مقرّبة وتبعد شوي شوي
  function zoomFig(q) {
    if (!Q.zoomT0) Q.zoomT0 = Date.now();
    const z = q.zoom || {}, lvl = { 200: [3, 15], 400: [5, 25], 600: [8, 30] }[Q.pts] || [5, 25];
    return `<figure class="q-img zoomer${Q.zoomAll ? ' all' : ''}" style="--zx:${z.x ?? 50}%;--zy:${z.y ?? 50}%;--z0:${z.scale || lvl[0]};--zd:${lvl[1]}s"><img src="${esc(media(q.image))}" alt="صورة مقرّبة" referrerpolicy="no-referrer"></figure>`;
  }
  // نحرّك الزووم بالسكربت (مو CSS) عشان يشتغل حتى لو الجهاز مفعّل «تقليل الحركة»
  function runZoom() {
    const img = document.querySelector('.zoomer:not(.all) img'); if (!img || !Q) return;
    const fig = img.parentElement, z0 = parseFloat(fig.style.getPropertyValue('--z0')) || 5, dur = parseFloat(fig.style.getPropertyValue('--zd')) * 1000 || 22000;
    const q0 = Q, step = () => {
      if (Q !== q0 || !img.isConnected) return;
      const t = Math.min(1, (Date.now() - Q.zoomT0) / dur), sc = z0 + (1.15 - z0) * t;
      img.style.transform = `scale(${sc.toFixed(3)})`;
      if (t < 1) requestAnimationFrame(step);
    };
    step();
  }
  function renderTrivia() {
    const q = Q.q;
    if (Q.view === 'question') {
      if (Q.sceneOpen && q.video) {
        $('#qBody').innerHTML = `<div class="vid-wrap"><p class="scene-lbl">ركّزوا زين في المقطع… بعده بيطلع السؤال</p>
          <video id="qVideo" src="${esc(media(q.video))}" playsinline preload="auto" controls></video>
          <p class="vid-credit">${esc(q.video_credit || '')}</p></div>`;
        $('#qActions').innerHTML = `<button class="btn ghost" data-act="playVideo">${ico('play')}شغّل المقطع</button><button class="btn ghost" data-act="hideScene">${ico('eye')}خلص المقطع، طلّعوا السؤال</button>`;
        const v = $('#qVideo');
        v.addEventListener('ended', () => hideScene());
        v.addEventListener('play', () => { if (!C.running) startClock(); });
        v.play().catch(() => {}); // إذا المتصفح منع التشغيل التلقائي، المقدّم يضغط «شغّل المقطع»
        return;
      }
      if (Q.sceneOpen) {
        $('#qBody').innerHTML = `<div class="scene"><p class="scene-lbl">ركّز زين… المشهد بيختفي</p><div class="scene-txt">${esc(q.scene).replace(/\n/g, '<br>')}</div></div>`;
        $('#qActions').innerHTML = `<button class="btn ghost" data-act="hideScene">${ico('eye')}اخفوا المشهد</button>`;
        return;
      }
      $('#qBody').innerHTML = `
        ${Q.variant === 'memory' ? `<p class="scene-gone">${q.video ? 'خلص المقطع' : 'المشهد اختفى'}. جاوبوا من الذاكرة</p>` : ''}
        ${q.emoji ? `<div class="q-emoji">${esc(q.emoji)}</div>` : ''}
        <p class="q-text">${esc(q.question)}</p>
        ${Q.variant === 'jni' && q.pattern ? jniBoard(q) : ''}
        ${q.image && Q.variant === 'zoom' ? zoomFig(q) : q.image ? `<figure class="q-img${Q.variant === 'guess' ? ' big' : ''}"><img src="${esc(media(q.image))}" alt="صورة السؤال" referrerpolicy="no-referrer" onerror="this.closest('figure').classList.add('broken')"></figure>` : ''}
        ${Q.variant === 'letters' && q.letter ? letterBoard(q.letter, q.answer) : ''}
        ${Q.showOpts && q.options ? `<div class="opts4">${q.options.map((o, k) => `<div class="opt4"><span class="num">${k + 1}</span>${esc(o)}</div>`).join('')}</div>` : ''}`;
      if (Q.variant === 'zoom') requestAnimationFrame(runZoom);
      $('#qActions').innerHTML = (Q.variant === 'zoom' && !Q.zoomAll ? `<button class="btn ghost" data-act="zoomAll">${ico('eye')}طلّع الصورة كاملة</button>` : '') + `<button class="btn ans-btn" data-act="answer">${ico('eye')}الإجابة</button>`;
    } else if (Q.view === 'answer') {
      $('#qBody').innerHTML = `
        <div class="ans">
          <p class="ans-lbl">الجواب</p>
          <p class="ans-text">${esc(q.answer)}</p>
          ${q.image ? `<figure class="q-img small"><img src="${esc(media(q.image))}" alt="" referrerpolicy="no-referrer"><figcaption>${esc(q.image_credit || '')}</figcaption></figure>` : ''}
          ${q.note ? `<p class="q-note">${esc(q.note)}</p>` : ''}
          ${Q.showOpts && q.options ? `<div class="opts4 small">${q.options.map((o, k) => `<div class="opt4 ${o === q.correct_option ? 'ok' : 'no'}"><span class="num">${k + 1}</span>${esc(o)}</div>`).join('')}</div>` : ''}
        </div>`;
      $('#qActions').innerHTML = `<button class="btn ghost" data-act="toQuestion">${ico('back')}ارجع للسؤال</button><button class="btn who-btn" data-act="who">أي فريق جاوب؟</button>`;
    } else renderWho(() => Q.pts);
  }
  function hideScene() {
    if (!Q || !Q.sceneOpen) return;
    Q.sceneOpen = false; sfx.reveal();
    setClock('up', 0); startClock(); renderView();
  }

  // --- أي فريق جاوب؟
  function renderWho(ptsFn, label = 'أي فريق جاوب صح؟') {
    const pts = ptsFn();
    $('#qBody').innerHTML = `
      <div class="who-view">
        <h2 class="who-title">${label}</h2>
        <div class="who-teams" style="--n:${G.teams.length}">
          ${G.teams.map((t, i) => `<button class="who-team" data-award="${i}" style="--t:var(--team-${i + 1})">${esc(t.name)}<small class="num">+${pts}</small></button>`).join('')}
        </div>
        <button class="who-none" data-award="-1">ولا أحد</button>
      </div>`;
    $('#qActions').innerHTML = `<button class="btn ghost" data-act="toAnswer">${ico('back')}العودة للإجابة</button>`;
  }

  // --- ولا كلمة (باركود للممثل)
  // الباركود يحمل رابط قصير للعبة نفسها (#s-<رقم السؤال>)، والجوال يفتحه ويعرض السر.
  // النص العربي الطويل داخل الباركود ما تقراه أغلب كاميرات الجوال.
  // الباركود يفتح صفحة صغيرة برّا كلود (GitHub Pages) عشان تفتح بسفاري على طول
  const SECRET_BASE = 'https://almousawi7.github.io/tirakkad/s.html';
  const secretUrl = (id) => `${SECRET_BASE}#${id}`;
  // كلمة «ولا كلمة»/«رسم» داخل الرابط نفسه (base64url)، فتشتغل حتى للأسئلة الجديدة
  const b64u = (t) => btoa(String.fromCharCode(...new TextEncoder().encode(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const wordUrl = (q, draw) => `${SECRET_BASE}#w.${b64u([draw ? 'd' : 'c', q.prompt, q.hint_category || '', q.tip || ''].join('|').replace(/\|+$/, ''))}`;
  function secretQR(text) {
    try { const qr = window.qrcode(0, 'L'); qr.addData(unescape(encodeURIComponent(text))); qr.make(); return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
    catch (e) { return ''; }
  }
  function renderCharades() {
    const q = Q.q;
    if (Q.view === 'question') {
      const draw = Q.variant === 'draw';
      const short = /^(ch|drw)-\d+-[a-z0-9]+$/.test(q.id);
      if (draw && (NET.relay || NET.roomTV)) { // رسم مباشر من جوال الرسّام
        const url = drawUrl(q);
        $('#qBody').innerHTML = `
          <div class="draw-live">
            <div class="qr-secret dl-qr"><div class="qr-code">${secretQR(url)}</div><p>الرسّام يصوّر الكود ويرسم بجواله</p>${NET.roomTV ? `<p class="dl-code">الكود: <b>${NET.room}</b><br><small>من تطبيق كلود: «انضم بكود» ← رسّام</small></p><p class="hint" id="dlStatus">${esc(NET.peerInfo || '')}</p>` : ''}<p class="hint">النوع: <b>${esc(q.hint_category || '—')}</b></p>
              <button class="btn ghost sm" data-act="peek">بدون جوال؟</button></div>
            <div class="dl-board"><canvas id="drawCv" width="800" height="600" aria-label="رسمة الرسّام"></canvas>${(Q.strokes || []).length ? '' : '<p class="dl-wait">الرسمة بتطلع هني أول ما يبدأ الرسّام…</p>'}</div>
            <div class="charade dl-peek" id="charade"><div class="word">${esc(q.prompt)}</div></div>
          </div>`;
        $('#qActions').innerHTML = (Q.charadeStarted ? '' : `<button class="btn ghost" data-act="startCharade">${ico('play')}ابدأ الوقت (٦٠ ثانية)</button>`) +
          `<button class="btn ans-btn" data-act="answer">${ico('eye')}الإجابة</button>`;
        paintDraw(); pushList(); return;
      }
      const qr = secretQR(short ? secretUrl(q.id) : wordUrl(q, draw));
      $('#qBody').innerHTML = `
        <p class="q-text">${draw ? 'ارسموها بدون كتابة ولا كلام!' : 'مثّلوا الكلمة بدون ولا كلمة!'}</p>
        <p class="hint">النوع: <b>${esc(q.hint_category || '—')}</b></p>
        <div class="charade-row">
          ${qr ? `<div class="qr-secret"><div class="qr-code">${qr}</div><p>${draw ? 'الرسّام' : 'الممثل'} بس يصوّر الكود بكاميرا جواله ويشوف الكلمة</p></div>` : ''}
          <div class="charade" id="charade"><div class="word">${esc(q.prompt)}</div>
            <button class="cover" data-act="peek">بدون جوال؟ ${draw ? 'الرسّام' : 'الممثل'} يضغط هني ويشوف<br><small>الباقين يغمضون</small></button></div>
        </div>`;
      $('#qActions').innerHTML = (Q.charadeStarted ? '' : `<button class="btn ghost" data-act="startCharade">${ico('play')}ابدأ الوقت (٦٠ ثانية)</button>`) +
        `<button class="btn ans-btn" data-act="answer">${ico('eye')}الإجابة</button>`;
    } else if (Q.view === 'answer') {
      $('#qBody').innerHTML = `<div class="ans"><p class="ans-lbl">الكلمة</p><p class="ans-text">${esc(q.prompt)}</p></div>`;
      $('#qActions').innerHTML = `<button class="btn ghost" data-act="toQuestion">${ico('back')}ارجع للسؤال</button><button class="btn who-btn" data-act="who">أي فريق حزرها؟</button>`;
    } else renderWho(() => Q.pts, 'أي فريق حزرها؟');
  }

  // --- قول اللي ببالهم
  const surveyPot = () => [...Q.opened].reduce((s, i) => s + Q.q.answers[i].points, 0);
  const surveyPts = () => Math.round((Q.pts * surveyPot()) / 100 / 10) * 10;
  function renderSurvey() {
    const q = Q.q;
    if (Q.view === 'who') { renderWho(surveyPts, 'النقاط لأي فريق؟'); return; }
    const all = Q.view === 'answer';
    $('#qBody').innerHTML = `
      <p class="q-text">${esc(q.prompt)}</p>
      <div class="survey">${q.answers.map((a, i) => {
        const open = Q.opened.has(i);
        return `<button class="slot ${open ? 'open' : ''} ${all && !open ? 'missed' : ''}" data-slot="${i}" ${all ? 'disabled' : ''}><span class="n num">${i + 1}</span><span class="t">${open || all ? esc(a.text) : ''}</span><span class="p num">${open || all ? a.points : ''}</span></button>`;
      }).join('')}</div>
      <div class="pot"><span>المكشوف: <b class="num">${surveyPot()}</b>% = <b class="num">${surveyPts()}</b> نقطة</span>
        <span class="strikes">${[0, 1, 2].map((k) => `<i class="${k < Q.strikes ? 'on' : ''}">✕</i>`).join('')}</span></div>`;
    $('#qActions').innerHTML = all
      ? `<button class="btn ghost" data-act="toQuestion">${ico('back')}ارجع للسؤال</button><button class="btn who-btn" data-act="who">النقاط لأي فريق؟</button>`
      : `<span class="lbl">اضغطوا الجواب لما ينقال</span><button class="btn ghost" data-act="strike">${ico('x')}غلط</button><button class="btn ans-btn" data-act="answer">${ico('eye')}اكشف الباقي</button>`;
  }

  // --- جولة الحَكَم: «اضمنها» (قائمة مرتّبة + فخوخ) و«قول اللي ببالهم» (أجوبة الناس بنسبها)
  // كل عنصر {text, value, trap}. الحَكَم يضغط اسم الفريق: الجواب الصح ينحسب له، والفخ ينقص منه.
  function buildItems(q, variant) {
    if (variant === 'survey') return (q.answers || []).map((a) => ({ text: a.text, value: (a.points || 0) * 10, trap: false }));
    // الأول بالترتيب (الأسهل) عليه 100، والعاشر (الأصعب) عليه 1000
    const items = (q.answers || []).map((a, k) => ({ text: a, value: (q.values && q.values[k]) || 100 * (k + 1), trap: false, hint: (q.hints && q.hints[k]) || '' }));
    (q.traps || []).forEach((t) => items.push({ text: t.text, value: -Math.abs(t.penalty || 100), trap: true }));
    return items;
  }
  const itemTotal = (q, variant) => buildItems(q, variant).filter((it) => !it.trap).reduce((n, it) => n + it.value, 0);
  const teamPts = () => G.teams.map((_, k) => Q.items.reduce((n, it, i) => n + (Q.revealed[i] === k ? it.value : 0), 0));
  function listWinners() { const p = teamPts(), max = Math.max(...p); return max > 0 ? p.map((x, i) => (x === max ? i : -1)).filter((i) => i >= 0) : []; }
  function listTimeout() { // خلص وقت الفريق → الدور للي بعده
    if (!Q || Q.type !== 'list' || Q.view !== 'question') return;
    toast('toastNo'); switchListTurn();
  }
  function switchListTurn(to) {
    Q.listTurn = to === undefined ? (Q.listTurn + 1) % G.teams.length : to;
    setClock('down', 30, listTimeout); startClock(); renderView();
  }
  function onRef(i, team) { // ضغطة من جوال الحَكَم (أو المقدّم)
    if (!Q || Q.type !== 'list' || Q.done || Q.view !== 'question' || i < 0 || i >= Q.items.length) return;
    if (team >= 0 && team < G.teams.length) {
      if (Q.revealed[i] !== null) return;
      Q.revealed[i] = team;
      const it = Q.items[i];
      if (it.trap) { sfx.no(); toast('toastTrap', `فخ! «${it.text}» — ناقص ${Math.abs(it.value)} على ${G.teams[team].name}`); }
      else sfx.ok();
      if (Q.listStarted) { switchListTurn((team + 1) % G.teams.length); return; }
    } else Q.revealed[i] = null;
    renderView();
  }
  function slotHtml(it, i, interactive) {
    const by = Q.revealed[i], shown = by !== null || Q.view !== 'question';
    const cls = ['ls-slot', it.trap ? 'ls-trap' : '', by !== null ? 'got' : (Q.view !== 'question' ? 'missed' : '')].join(' ');
    const style = by !== null ? `style="--t:var(--team-${by + 1})"` : '';
    const label = it.trap ? (shown ? esc(it.text) : 'فخ') : (shown ? esc(it.text) : (Q.letters[i] ? (Q.letters[i].length > 1 ? `💡 ${esc(Q.letters[i])}` : `يبدأ بـ «${esc(Q.letters[i])}»`) : ''));
    const val = (shown || !it.trap) ? `<span class="v num">${it.value > 0 ? '+' : ''}${it.value}</span>` : '';
    const who = by !== null ? `<span class="who">${esc(G.teams[by].name)}</span>` : '';
    const n = it.trap ? '!' : (realIndex(i) + 1);
    const tag = interactive ? 'button' : 'div';
    return `<${tag} class="${cls}" ${interactive ? `data-slot="${i}"` : ''} ${style}><span class="n num">${n}</span><span class="t">${label}</span>${val}${who}</${tag}>`;
  }
  const realIndex = (i) => Q.items.slice(0, i).filter((it) => !it.trap).length;
  function renderList() {
    const q = Q.q, n = G.teams.length, pts = teamPts(), isSurvey = Q.variant === 'survey';
    const reals = Q.items.map((it, i) => [it, i]).filter(([it]) => !it.trap);
    const traps = Q.items.map((it, i) => [it, i]).filter(([it]) => it.trap);
    const title = isSurvey ? q.prompt : q.question;
    const teamsRow = `<div class="ls-teams">${G.teams.map((t, i) => `
      <div class="ls-team ${Q.listStarted && i === Q.listTurn && Q.view === 'question' ? 'turn' : ''}" style="--t:var(--team-${i + 1})">
        <b>${esc(t.name)}</b><span class="num">${pts[i]}</span><small>نقطة</small></div>`).join('')}</div>`;
    if (Q.view === 'question' && !Q.listStarted) {
      const url = NET.on ? (NET.refUrl || NET.base + 'ref.html') : '';
      const plain = `${title}\n${reals.map(([it], k) => `${k + 1}. ${it.text} (${it.value})`).join('\n')}${traps.length ? '\nفخوخ: ' + traps.map(([it]) => `${it.text} (${it.value})`).join('، ') : ''}`;
      const qr = secretQR(url || secretUrl(q.id));
      $('#qBody').innerHTML = `
        <div class="ls-setup">
          <div class="qr-secret big"><div class="qr-code">${qr}</div><p class="${NET.ref ? 'ok' : ''}">${NET.on ? (NET.ref ? 'الحَكَم متصل ✓' : 'باركود الحَكَم') : 'باركود الحَكَم (القائمة)'}</p>${NET.room ? `<p class="room-code">الكود: <b>${NET.room}</b></p>${NET.roomTV ? '<p class="room-code sm">من تطبيق كلود: افتح اللعبة واضغط «انضم بكود»</p>' : ''}` : ''}</div>
          <div class="ls-right"><ol class="ls-steps">
            <li>اختاروا شخص محايد يكون <b>الحَكَم</b>، ويصوّر الباركود بجواله.</li>
            <li>الفرق تجاوب بالدور، وكل فريق عنده <b class="num">30</b> ثانية.</li>
            <li>إذا الجواب موجود، الحَكَم يضغط اسم الفريق، <b>فيطلع الجواب على الشاشة</b>.</li>
            ${isSurvey
              ? '<li>كل جواب نقاطه على قد عدد الناس اللي قالوه.</li>'
              : `<li>القائمة فيها <b class="num">10</b> أجوبة مرتّبة: الأول عليه <b class="num">100</b> والعاشر (الأصعب) عليه <b class="num">1000</b>. وانتبهوا من <b>الفخوخ</b> إذا موجودة: تنقص من نقاطكم. وعندكم تلميحين بكل سؤال.</li>`}
          </ol>
          ${NET.on ? '' : '<p class="hint">بدون اتصال: الحَكَم يقول رقم الجواب، والمقدّم يضغط عليه بالشاشة ويختار الفريق.</p>'}</div>
        </div>`;
      $('#qActions').innerHTML = (canSwap() ? `<button class="btn ghost" data-act="listSwap">${ico('redo')}غيّر السؤال</button>` : '') + `<button class="btn ans-btn" data-act="listStart">${ico('play')}ابدأ</button>`;
      pushList(); return;
    }
    const live = Q.view === 'question';
    const cols = reals.length > 10 ? 3 : 2;
    $('#qBody').innerHTML = `
      <p class="q-text sm">${esc(title)}</p>
      ${teamsRow}
      <div class="ls-grid" style="--cols:${cols}">${reals.map(([it, i]) => slotHtml(it, i, live)).join('')}</div>
      ${traps.length ? `<div class="ls-traps"><span class="ls-traps-lbl">الفخوخ</span>${traps.map(([it, i]) => slotHtml(it, i, live)).join('')}</div>` : ''}
      ${live && Q.pickSlot !== null ? `<div class="ls-pick"><span>${Q.items[Q.pickSlot].trap ? 'الفخ' : `جواب رقم <b class="num">${realIndex(Q.pickSlot) + 1}</b>`}: مين قاله؟</span>${G.teams.map((t, k) => `<button class="btn team sm" style="--t:var(--team-${k + 1})" data-pick="${k}">${esc(t.name)}</button>`).join('')}<button class="btn ghost sm" data-pick="x">إلغاء</button></div>` : ''}
      ${!live ? (() => { const w = listWinners(); return `<p class="who-title sm">${!w.length ? 'محد جمع نقاط' : w.length === 1 ? `الأعلى: ${esc(G.teams[w[0]].name)}` : 'تعادل'}</p>`; })() : ''}`;
    if (live) {
      $('#qActions').innerHTML = `
        <button class="btn ghost" data-act="listPass">${ico('x')}غلط، الدور على ${esc(G.teams[(Q.listTurn + 1) % n].name)}</button>
        ${(Q.hintsUsed || 0) >= 2 ? '' : `<button class="btn ghost" data-act="listLetter" title="تلميحين بكل سؤال">💡 تلميح (${2 - (Q.hintsUsed || 0)})</button>`}
        <button class="btn ans-btn" data-act="answer">${ico('eye')}خلصنا، اكشف الباقي</button>`;
    } else {
      $('#qActions').innerHTML = `<button class="btn ghost" data-act="toQuestion">${ico('back')}ارجع للقائمة</button><button class="btn who-btn" data-act="listDone">احسبها</button>`;
    }
    pushList();
  }

  // --- أزرار السؤال
  $('#qBody').addEventListener('click', (e) => {
    if (!Q || Q.done) return;
    const aw = e.target.closest('[data-award]');
    if (aw && Q.view === 'who') { award(+aw.dataset.award); return; }
    const slot = e.target.closest('.slot[data-slot]');
    if (slot && Q.type === 'survey' && Q.view === 'question') { const i = +slot.dataset.slot; if (Q.opened.has(i)) Q.opened.delete(i); else { Q.opened.add(i); sfx.ok(); } renderView(); return; }
    const ls = e.target.closest('.ls-slot[data-slot]');
    if (ls && Q.type === 'list' && Q.view === 'question') { const i = +ls.dataset.slot; if (Q.revealed[i] !== null) onRef(i, -1); else { Q.pickSlot = Q.pickSlot === i ? null : i; renderView(); } return; }
    const pk = e.target.closest('[data-pick]');
    if (pk && Q.type === 'list' && Q.pickSlot !== null) { const i = Q.pickSlot; Q.pickSlot = null; if (pk.dataset.pick === 'x') renderView(); else onRef(i, +pk.dataset.pick); return; }
    const a = e.target.closest('[data-act]'); if (a) act(a.dataset.act);
  });
  $('#qActions').addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (a) act(a.dataset.act); });

  function act(name) {
    if (!Q || Q.done) return;
    switch (name) {
      case 'answer': if (Q.sceneOpen) return; stopClock(); Q.view = 'answer'; sfx.reveal(); renderView(); break;
      case 'toQuestion': Q.view = 'question'; renderView(); break;
      case 'who': Q.view = 'who'; renderView(); break;
      case 'toAnswer': Q.view = 'answer'; renderView(); break;
      case 'hideScene': hideScene(); break;
      case 'zoomAll': Q.zoomAll = true; renderView(); break;
      case 'startCharade': if (!Q.charadeStarted) { Q.charadeStarted = true; startClock(); renderView(); } break;
      case 'peek': { const c = $('#charade'); if (c) { c.classList.add('open'); const q0 = Q; later(() => { const el = $('#charade'); if (Q === q0 && el) el.classList.remove('open'); }, 4000); } break; }
      case 'strike': Q.strikes = Math.min(3, Q.strikes + 1); sfx.no(); if (Q.strikes >= 3) toast('toastNo'); renderView(); break;
      case 'listPass': sfx.no(); switchListTurn(); break;
      case 'listSwap': swapQuestion(); break;
      case 'listStart': Q.listStarted = true; Q.listTurn = G.turn; sfx.reveal(); switchListTurn(G.turn); break;
      case 'listLetter': {
        const hidden = Q.revealed.map((x, i) => (x === null && !Q.items[i].trap && !Q.letters[i] ? i : -1)).filter((i) => i >= 0);
        if (!hidden.length) break;
        const i = hidden[Math.floor(Math.random() * hidden.length)];
        Q.letters[i] = Q.items[i].hint || String(Q.items[i].text).replace(/^ال/, '').trim().charAt(0); Q.hintsUsed = (Q.hintsUsed || 0) + 1; sfx.power(); renderView(); break;
      }
      case 'playVideo': { const v = $('#qVideo'); if (v) v.play().catch(() => {}); break; }
      case 'listDone': awardList(); break;
    }
  }

  // --- احتساب النقاط
  function applyStrike(winner, pts, parts) {
    if (G.strike === null) return;
    const armed = G.strike;
    if (winner === armed && pts > 0) {
      const others = G.teams.map((t, k) => ({ t, k })).filter((x) => x.k !== armed).sort((a, b) => b.t.score - a.t.score);
      if (others[0]) { others[0].t.score -= pts; parts.push(`حفرة! ناقص ${pts} على ${others[0].t.name}`); }
    }
    if (G.teams[armed].helps.strike !== undefined) G.teams[armed].helps.strike = false; // تنصرف بعد السؤال مهما كانت النتيجة
    G.strike = null;
  }
  function finish(tileBy, parts, good) {
    Q.done = true;
    stopClock(); cancelPending();
    G.board[Q.ci].tiles[Q.ti].by = tileBy;
    G.turn = (G.turn + 1) % G.teams.length;
    save();
    if (good) sfx.ok(); else { sfx.no(); toast('toastNo'); } // لما فريق يجاوب صح: صوت بس، بدون رسالة على الشاشة
    Q = null; pushList();
    renderBoard(); show('scr-board');
    clearTimeout(bannerT); bannerT = setTimeout(turnBanner, 700);
  }
  function award(i) {
    if (!Q || Q.done) return;
    const pts = Q.type === 'survey' ? surveyPts() : Q.pts;
    const parts = [], won = i >= 0 && pts > 0;
    if (won) { G.teams[i].score += pts; parts.push(`${G.teams[i].name} +${pts}`); }
    applyStrike(i, pts, parts);
    finish(won ? i : -1, parts, won);
  }
  function awardList() {
    if (!Q || Q.done) return;
    const pts = teamPts(), w = listWinners(), parts = [];
    pts.forEach((p, i) => { if (p) { G.teams[i].score += p; parts.push(`${G.teams[i].name} ${p > 0 ? '+' : ''}${p}`); } });
    applyStrike(w.length === 1 ? w[0] : -1, w.length === 1 ? pts[w[0]] : 0, parts);
    finish(w.length ? w[0] : -1, parts, pts.some((p) => p > 0));
  }



  $('#btnBack').addEventListener('click', () => {
    if (!Q || Q.view !== 'question') return; // بعد كشف الإجابة ما فيه رجوع
    stopClock(); cancelPending(); Q = null; pushList(); renderBoard(); show('scr-board');
  });

  // المسافة = الخطوة الجاية
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || $('#scr-q').hidden || e.target.matches('input,textarea') || !Q) return;
    e.preventDefault();
    const b = $('#qActions .ans-btn') || $('#qActions .who-btn') || $('#qActions [data-act="hideScene"]');
    if (b) b.click();
  });

  /* =================== WINNER =================== */
  function showWinner() {
    if (!G || !$('#scr-win').hidden) return;
    stopClock(); cancelPending(); Q = null;
    const ranked = G.teams.map((t, i) => ({ ...t, i })).sort((a, b) => b.score - a.score);
    const top = ranked[0], tops = ranked.filter((t) => t.score === top.score), tie = tops.length > 1;
    $('#scr-win').style.setProperty('--win', tie ? 'var(--ink)' : `var(--team-${top.i + 1})`);
    $('#winTitle').textContent = tie ? `تعادل بين ${tops.map((t) => t.name).join(' و')}!` : `صحّ لسانك يا ${top.name}!`;
    const max = Math.max(1, top.score);
    $('#podium').innerHTML = ranked.map((t) => `
      <div class="score t${t.i + 1} ${t.score === top.score ? 'active' : ''}" style="--p:${Math.max(4, Math.min(100, (t.score / max) * 100))}%">
        <span class="fill"></span>${shapeEl(t, t.i)}<div><div class="name">${esc(t.name)}</div></div><span class="pts num">${t.score}</span></div>`).join('');
    const cols = [`var(--team-${top.i + 1})`, 'var(--yellow)', 'var(--coral)', 'var(--cobalt)', 'var(--green)'];
    $('#confetti').innerHTML = Array.from({ length: 48 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--c:${cols[i % cols.length]};--d:${4 + (i % 5)}s;--dl:-${((i * 0.37) % 5).toFixed(2)}s"></i>`).join('');
    sfx.ok(); setTimeout(sfx.ok, 450);
    clearSave();
    show('scr-win');
  }

  /* =================== شاشة السر على الجوال (#s-<id>) =================== */
  function secretView(tries = 0) {
    const m = /^#s-([A-Za-z0-9-]+)$/.exec(location.hash || '');
    const old = document.getElementById('secretView');
    if (/^#w-/.test(location.hash || '')) return;
    if (!m) { if (old) old.remove(); return; }
    const q = qById[m[1]];
    if (!q && tries < 12) { setTimeout(() => secretView(tries + 1), 500); }
    const box = old || document.createElement('div');
    box.id = 'secretView'; box.dir = 'rtl';
    let inner;
    if (!q) inner = tries < 12 ? '<p class="sv-sub">جاري التحميل…</p>' : '<p class="sv-sub">ما لقيت هالسؤال. يمكن يكون سؤال جديد ما وصل لهالجهاز. استخدم زر «بدون جوال؟» على الشاشة.</p>';
    else if (q.cat.type === 'charades' || q.cat.type === 'draw') {
      const draw = q.cat.type === 'draw';
      inner = `<p class="sv-sub">${draw ? 'ارسم هالكلمة بدون كتابة ولا كلام' : 'مثّل هالكلمة بدون ولا كلمة'}</p>
        <p class="sv-word">${esc(q.prompt)}</p>${q.hint_category ? `<p class="sv-sub">النوع: ${esc(q.hint_category)}</p>` : ''}${q.tip ? `<p class="sv-tip">${esc(q.tip)}</p>` : ''}`;
    } else {
      const survey = q.cat.type === 'survey', items = buildItems(q, survey ? 'survey' : 'list');
      const reals = items.filter((it) => !it.trap), traps = items.filter((it) => it.trap);
      inner = `<p class="sv-sub">ورقة الحَكَم · لا تفرّجها أحد</p><p class="sv-q">${esc(survey ? q.prompt : q.question)}</p>
        <ol class="sv-list">${reals.map((it) => `<li><span>${esc(it.text)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</span><b>${it.value}</b></li>`).join('')}</ol>
        ${traps.length ? `<p class="sv-sub">فخوخ (تنقص من النقاط)</p><ol class="sv-list trap">${traps.map((it) => `<li><span>${esc(it.text)}</span><b>${it.value}</b></li>`).join('')}</ol>` : ''}`;
    }
    box.innerHTML = `<p class="sv-brand">تركّد</p>${inner}<br><button class="sv-x" type="button">سكّر وافتح اللعبة</button>`;
    box.querySelector('.sv-x').onclick = () => { history.replaceState(null, '', location.pathname + location.search); box.remove(); };
    if (!old) document.body.appendChild(box);
  }
  window.addEventListener('hashchange', () => secretView());

  /* =================== وضع الجوال داخل كلود (#r-CODE حَكَم، #d-CODE-qid رسّام) =================== */
  // يفتح من الرابط (#r-/#d-) أو من زر «انضم بكود» (تطبيق كلود بالجوال ما يوصّل الرابط كامل)
  function startPhone(opts) {
    let role, code, qid = '';
    if (opts) ({ role, code } = opts);
    else {
      const h = location.hash || '', mR = /^#r-([A-Z0-9]{5})$/.exec(h), mD = /^#d-([A-Z0-9]{5})-([a-z0-9-]+)$/.exec(h);
      if (!mR && !mD) return false;
      role = mR ? 'ref' : 'draw'; code = (mR || mD)[1]; qid = mD ? mD[2] : '';
    }
    const page = role === 'ref' ? 'ref.html' : 'draw.html';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((x) => x.remove());
    document.body.removeAttribute('class');
    document.body.innerHTML = '<p style="font:600 17px system-ui;text-align:center;margin-top:35vh;color:#13213C">جاري الاتصال بالتلفزيون…</p>';
    const fail = (t) => { document.body.innerHTML = `<p style="font:600 17px system-ui;text-align:center;margin:30vh 20px 0;color:#13213C;line-height:1.8">${t}</p>`; };
    (async () => {
      const room = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('room').catch(() => null) : null;
      if (!room) { fail('عشان تتحكم من جوالك لازم تكون مسجّل دخول بحساب Claude.<br>أو العبوا من رابط GitHub: almousawi7.github.io/tirakkad'); return; }
      let nr; try { nr = await room.join('tk-' + code.toLowerCase()); } catch (e) { fail('ما قدرت أدخل غرفة اللعبة. صوّر الباركود مرة ثانية.'); return; }
      const q = []; let seq = 0, state = null; const fns = [], cfns = [];
      const link = {
        ref: qid, word: qid && qById[qid] ? qById[qid].prompt : '',
        send(kind, obj) { q.push([++seq, kind, obj]); while (q.length > 1 && JSON.stringify(q).length > 2800) q.shift(); nr.presence({ tk: { role, q: q.slice() } }).catch(() => {}); },
        onState(fn) { fns.push(fn); if (state) fn(state); },
        onConn(fn) { cfns.push(fn); fn(nr.connected()); },
      };
      nr.onConnection((c) => cfns.forEach((f) => f(c)));
      const onP = ({ peers }) => { const tv = peers.find((p) => !p.sameTab && p.presence && p.presence.tv); const st = tv && tv.presence.st; if (st && st !== state) { state = st; fns.forEach((f) => f(st)); } };
      nr.onPeers(onP); setInterval(() => { try { onP({ peers: nr.peers() }); } catch (e) {} }, 200);
      nr.presence({ tk: { role, q: [] } }).catch(() => {});
      window.TK_LINK = link;
      const doc = new DOMParser().parseFromString(await (await fetch(page)).text(), 'text/html');
      doc.querySelectorAll('style').forEach((x) => document.head.appendChild(x.cloneNode(true)));
      document.body.innerHTML = doc.body.innerHTML;
      document.body.querySelectorAll('script').forEach((x) => x.remove());
      doc.querySelectorAll('script:not([src])').forEach((x) => { const sc = document.createElement('script'); sc.textContent = x.textContent; document.body.appendChild(sc); });
    })();
    return true;
  }
  if (startPhone()) return;
  // «انضم بكود» — يطلع بس داخل كلود
  (function joinUI() {
    const btn = $('#btnJoin'), box = $('#joinBox'); if (!btn || !box) return;
    if (!window.claude || typeof window.claude.use !== 'function') return;
    btn.hidden = false;
    btn.addEventListener('click', () => { box.hidden = !box.hidden; if (!box.hidden) $('#joinCode').focus(); });
    $('#joinCode').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-join]'); if (!b) return;
      const code = $('#joinCode').value;
      if (code.length !== 5) { $('#joinMsg').textContent = 'اكتب الكود اللي تحت الباركود بالتلفزيون (٥ حروف وأرقام)'; return; }
      window.scrollTo(0, 0); startPhone({ role: b.dataset.join, code });
    });
  })();

  /* =================== INIT =================== */
  // أسئلة إضافية (يومية) منشورة مع الموقع: extra.js
  Object.entries(window.TIRAKKAD_EXTRA || {}).forEach(([cid, list]) => addExtra(cid, list));
  renderTeamSetup(); renderCatPick(); renderLanding(); paintSound(); initNet(); cloud.loadExtra(); secretView();
  $('#btnResume').hidden = !load();
  window.__tirakkad = { get G() { return G; }, get Q() { return Q; } };
})();
