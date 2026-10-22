/* ------------------------------------------------------------
   Hero sketch of HeadRoom's routing idea.
   Visual load  <- your scrolling + pointer movement (+ scene baseline)
   Audio load   <- the chosen scene (a simulated sound level with bursts)
   A notification goes to whichever channel has more room.
------------------------------------------------------------ */
(function () {
  const eyesCv = document.getElementById('trace-eyes');
  const earsCv = document.getElementById('trace-ears');
  if (!eyesCv || !earsCv) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const valEyes = document.getElementById('val-eyes');
  const valEars = document.getElementById('val-ears');
  const outcome = document.getElementById('outcome');
  const toast = document.getElementById('toast');
  const ripple = document.getElementById('ripple');
  const sendBtn = document.getElementById('send');

  const SCENES = {
    quiet: { eyes: 0.12, ears: 0.10, burst: 0.00, wobble: 0.03 },
    cafe:  { eyes: 0.30, ears: 0.55, burst: 0.10, wobble: 0.10 },
    talk:  { eyes: 0.25, ears: 0.80, burst: 0.25, wobble: 0.08 },
  };
  let scene = SCENES.quiet;
  document.querySelectorAll('input[name="scene"]').forEach((r) =>
    r.addEventListener('change', () => { scene = SCENES[r.value]; if (reduce) tick(); })
  );

  // motion energy from the visitor
  let energy = 0;
  let lastY = window.scrollY;
  let lastX = null, lastPY = null;
  window.addEventListener('scroll', () => {
    const d = Math.abs(window.scrollY - lastY); lastY = window.scrollY;
    energy = Math.min(1, energy + d / 500);
  }, { passive: true });
  window.addEventListener('pointermove', (e) => {
    if (lastX !== null) {
      const d = Math.hypot(e.clientX - lastX, e.clientY - lastPY);
      energy = Math.min(1, energy + d / 1600);
    }
    lastX = e.clientX; lastPY = e.clientY;
  }, { passive: true });

  const N = 120;
  const eyes = new Array(N).fill(0.12);
  const ears = new Array(N).fill(0.10);
  let earsState = 0.1, burstLeft = 0;

  const clamp = (v) => Math.max(0.02, Math.min(0.98, v));

  function step() {
    energy *= 0.94;
    const e = clamp(scene.eyes + energy * 0.85 + (Math.random() - 0.5) * 0.04);
    if (burstLeft <= 0 && Math.random() < scene.burst * 0.08) burstLeft = 10 + Math.random() * 20;
    const target = scene.ears + (burstLeft > 0 ? 0.15 : 0) + (Math.random() - 0.5) * scene.wobble * 2;
    burstLeft--;
    earsState += (target - earsState) * 0.18;
    eyes.push(e); eyes.shift();
    ears.push(clamp(earsState)); ears.shift();
  }

  function avg(a) { let s = 0; for (let i = N - 15; i < N; i++) s += a[i]; return s / 15; }

  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  function draw(cv, data, color) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = (i / (N - 1)) * w, y = h - 4 - v * (h - 8);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.globalAlpha = 0.14; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
  }

  function label(load) {
    const room = Math.round((1 - load) * 100);
    return room + '% room';
  }

  function render() {
    draw(eyesCv, eyes, css('--eyes'));
    draw(earsCv, ears, css('--ears'));
    valEyes.textContent = label(avg(eyes));
    valEars.textContent = label(avg(ears));
  }

  function tick() { step(); render(); }

  if (reduce) {
    // no continuous animation: update on interaction only
    for (let i = 0; i < N; i++) step();
    render();
    ['scroll', 'pointermove'].forEach((ev) => window.addEventListener(ev, () => requestAnimationFrame(tick), { passive: true }));
  } else {
    let last = 0;
    const loop = (t) => {
      if (t - last > 66) { // ~15 Hz, gentle
        last = t;
        const rect = eyesCv.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < innerHeight) tick(); else step();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  window.addEventListener('resize', render);

  // audio cue
  let actx = null;
  function chime() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      [660, 880].forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        const t0 = actx.currentTime + i * 0.16;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 0.4);
      });
    } catch (e) { /* audio unavailable; the caption still explains the routing */ }
  }

  let hideT;
  sendBtn.addEventListener('click', () => {
    const roomEyes = 1 - avg(eyes), roomEars = 1 - avg(ears);
    const toEyes = roomEyes >= roomEars;
    clearTimeout(hideT);
    toast.classList.remove('on'); ripple.classList.remove('on');
    void ripple.offsetWidth;
    if (toEyes) {
      toast.classList.add('on');
      outcome.innerHTML = 'Shown on the <b class="to-eyes">display</b>. Your eyes had more room (' +
        Math.round(roomEyes * 100) + '% vs ' + Math.round(roomEars * 100) + '%).';
    } else {
      ripple.classList.add('on'); chime();
      outcome.innerHTML = 'Played as an <b class="to-ears">audio cue</b>. Your ears had more room (' +
        Math.round(roomEars * 100) + '% vs ' + Math.round(roomEyes * 100) + '%).';
    }
    hideT = setTimeout(() => toast.classList.remove('on'), 3200);
  });
})();

/* News: show all */
(function () {
  const btn = document.getElementById('news-toggle');
  const list = document.getElementById('news-list');
  if (!btn || !list) return;
  btn.addEventListener('click', () => {
    const open = list.classList.toggle('all');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Show recent news' : 'Show all news';
  });
})();

/* Highlight current section in the nav */
(function () {
  const links = [...document.querySelectorAll('.nav a')];
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        links.forEach((a) => a.removeAttribute('aria-current'));
        const a = map.get(en.target.id); if (a) a.setAttribute('aria-current', 'true');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
})();

/* Vision illustration: highlight matching glyphs */
(function () {
  const wrap = document.getElementById('vision');
  if (!wrap) return;
  wrap.classList.add('idle');
  const nodes = wrap.querySelectorAll('.v-node');
  const clear = () => {
    wrap.querySelectorAll('.is-on').forEach((el) => el.classList.remove('is-on'));
    wrap.classList.add('idle');
  };
  nodes.forEach((n) => {
    const on = () => {
      clear(); wrap.classList.remove('idle'); n.classList.add('is-on');
      (n.dataset.glyph || '').split(' ').forEach((id) => {
        const g = document.getElementById(id); if (g) g.classList.add('is-on');
      });
    };
    n.addEventListener('mouseenter', on);
    n.addEventListener('focus', on);
    n.addEventListener('mouseleave', clear);
    n.addEventListener('blur', clear);
  });
})();
