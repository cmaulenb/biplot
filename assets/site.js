(() => {
  'use strict';

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ============ TEXT SPLITTING (seeded, deterministic) ============ */
  function rng(seed) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }

  function splitInto(el, mode, seed) {
    const text = el.previousElementSibling && el.previousElementSibling.classList.contains('hero-sr')
      ? el.previousElementSibling.textContent
      : el.dataset.text || '';
    const words = text.trim().split(/\s+/);
    const r = rng(seed);
    el.innerHTML = '';
    words.forEach((word, wi) => {
      const wSpan = document.createElement('span');
      wSpan.className = 'w';
      const total = words.length;
      wSpan.style.setProperty('--th', (wi / total * 0.55 + r() * 0.05).toFixed(3));
      if (mode === 'chars') {
        [...word].forEach((ch) => {
          const cSpan = document.createElement('span');
          cSpan.className = 'c';
          cSpan.textContent = ch;
          cSpan.style.setProperty('--th', (r() * 0.55).toFixed(3));
          cSpan.style.setProperty('--jx', (r() * 60 - 30).toFixed(1) + 'px');
          cSpan.style.setProperty('--jy', (r() * 40 - 20).toFixed(1) + 'px');
          cSpan.style.setProperty('--jr', (r() * 30 - 15).toFixed(1) + 'deg');
          wSpan.appendChild(cSpan);
        });
      } else {
        wSpan.textContent = word;
        wSpan.style.setProperty('--jx', (r() * 30 - 15).toFixed(1) + 'px');
      }
      el.appendChild(wSpan);
      el.appendChild(document.createTextNode(' '));
    });
  }

  splitInto(document.querySelector('#band-1 .split'), 'chars', 11);
  splitInto(document.querySelector('#band-2 .split'), 'chars', 29);
  splitInto(document.querySelector('#band-3 .split'), 'words', 47);
  splitInto(document.querySelector('#band-settle .split'), 'words', 83);

  /* ============ HERO SCRUB ============ */
  const heroPin = document.getElementById('heroPin');
  const heroStage = document.getElementById('heroStage');
  const video = document.getElementById('heroVideo');
  const poster = document.getElementById('heroPoster');
  const ring = document.getElementById('heroRing');
  const bandsEls = [...document.querySelectorAll('.band')].map(el => ({
    el,
    range: el.dataset.range.split(',').map(Number),
    op: -1,
    k: -1
  }));

  const VIDEO_URL = 'assets/hero-scrub.mp4';
  const POSTER_URL = 'assets/hero-poster.jpg';
  const VIDEO_BYTES_FALLBACK = 4959726;

  function heroProgress() {
    const rect = heroPin.getBoundingClientRect();
    const total = heroPin.offsetHeight - window.innerHeight;
    if (total <= 0) return 1;
    const scrolled = -rect.top;
    return Math.min(1, Math.max(0, scrolled / total));
  }

  const smoothstep = (p, e0, e1) => {
    const t = Math.min(1, Math.max(0, (p - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  function updateCaptions(p) {
    bandsEls.forEach(({ el, range }, i) => {
      const [a, b] = range;
      const f = Math.min(0.02, (b - a) / 3);
      let op;
      if (i === 0) op = 1 - smoothstep(p, b - f, b);
      else if (i === bandsEls.length - 1) op = smoothstep(p, a, a + f);
      else op = smoothstep(p, a, a + f) * (1 - smoothstep(p, b - f, b));
      const ramp = Math.min(0.025, (b - a) * 0.35);
      const k = Math.min(1, Math.max(0, (p - a) / ramp));
      const cached = el.__cache || (el.__cache = { op: -1, k: -1 });
      if (Math.abs(cached.op - op) > 0.003) { el.style.opacity = op; cached.op = op; }
      if (Math.abs(cached.k - k) > 0.008) { el.style.setProperty('--k', k.toFixed(3)); cached.k = k; }
      el.style.pointerEvents = op > 0.05 ? 'auto' : 'none';
    });
  }

  // band-1 one-time load ramp (opens settled per the choreography rule)
  (function loadRampBandOne() {
    const b1 = bandsEls[0].el;
    let start = null;
    function step(ts) {
      if (!start) start = ts;
      const loadK = Math.min(1, (ts - start) / 900);
      const cur = parseFloat(b1.style.getPropertyValue('--k')) || 0;
      if (loadK > cur) b1.style.setProperty('--k', loadK.toFixed(3));
      if (loadK < 1 && heroProgress() < 0.02) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  })();

  let seekBusy = false, pendingTime = null;
  function requestSeek(t) {
    if (!video.duration || isNaN(video.duration)) return;
    if (seekBusy) { pendingTime = t; return; }
    seekBusy = true;
    try { video.currentTime = t; } catch (e) { seekBusy = false; }
  }
  video.addEventListener('seeked', () => {
    seekBusy = false;
    if (pendingTime !== null) { const t = pendingTime; pendingTime = null; requestSeek(t); }
  });
  video.addEventListener('error', () => { seekBusy = false; pendingTime = null; failVideo(); });

  let target = 0, shown = 0, rafId = null, lastTick = 0;
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
    if (Math.abs(target - shown) < 0.0005) { shown = target; rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
    if (video.duration) requestSeek(shown * video.duration);
    updateCaptions(shown);
    heroStage.classList.toggle('at-top', shown < 0.01);
  }

  let heroOnScreen = true;
  const io = new IntersectionObserver(([entry]) => { heroOnScreen = entry.isIntersecting; }, { threshold: 0 });
  io.observe(heroPin);

  function onScroll() {
    target = heroProgress();
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  let started = false;
  function startBlobFetch() {
    if (started) return;
    started = true;
    loadHeroBlob().catch(failVideo);
  }
  let heroInitDone = false;
  function initHeroOnce() {
    if (heroInitDone) return;
    heroInitDone = true;
    poster.style.backgroundImage = `url('${POSTER_URL}')`;
    const posterImg = new Image();
    posterImg.onload = startBlobFetch;
    posterImg.onerror = startBlobFetch;
    posterImg.src = POSTER_URL;
    setTimeout(startBlobFetch, 4000);
  }

  async function loadHeroBlob() {
    const ctrl = new AbortController();
    let watchdog = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(VIDEO_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error('video fetch failed');
    const total = Number(res.headers.get('Content-Length')) || VIDEO_BYTES_FALLBACK;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0, lastRing = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => ctrl.abort(), 20000);
      chunks.push(value);
      got += value.length;
      const frac = Math.min(1, got / total);
      const now = performance.now();
      if (now - lastRing > 100 || frac === 1) {
        lastRing = now;
        ring.style.setProperty('--ld', Math.round(126 * (1 - frac)));
      }
    }
    clearTimeout(watchdog);
    video.src = URL.createObjectURL(new Blob(chunks));
    video.load();
    video.addEventListener('canplay', () => {
      requestSeek(heroProgress() * video.duration);
      heroStage.classList.add('video-ready');
    }, { once: true });
  }

  function failVideo() {
    heroStage.classList.add('video-failed');
  }

  /* ============ FIVE-GATE STATIC HERO ============ */
  const GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  let scrubOn = false;
  function enableScrub() {
    if (scrubOn) return; scrubOn = true;
    initHeroOnce();
    addEventListener('scroll', onScroll, { passive: true });
    bandsEls.forEach(b => { if (b.el.__cache) { b.el.__cache.op = -1; b.el.__cache.k = -1; } });
    updateCaptions(heroProgress());
    onScroll();
  }
  function disableScrub() {
    if (!scrubOn) return; scrubOn = false;
    removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function applyHeroMode() {
    if (GATES.some(q => matchMedia(q).matches)) disableScrub();
    else enableScrub();
  }
  const MQLS = GATES.map(q => matchMedia(q));
  MQLS.forEach(m => m.addEventListener('change', applyHeroMode));
  applyHeroMode();

  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => applyHeroMode());

  /* ============ SCROLL REVEALS ============ */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in'); revealIO.unobserve(entry.target); } });
  }, { threshold: 0.18 });
  document.querySelectorAll('.reveal, .reveal-group').forEach(el => revealIO.observe(el));

  /* method rail fill, tied to step visibility */
  const methodSteps = [...document.querySelectorAll('[data-step]')];
  const methodFill = document.getElementById('methodFill');
  if (methodSteps.length && methodFill) {
    const stepIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('in'); });
      const lastIn = methodSteps.filter(s => s.classList.contains('in')).length;
      methodFill.style.height = (lastIn / methodSteps.length * 100) + '%';
    }, { threshold: 0.5 });
    methodSteps.forEach(s => stepIO.observe(s));
  }

  /* ============ FAQ ACCORDION ============ */
  document.querySelectorAll('[data-faq]').forEach(item => {
    const btn = item.querySelector('.faq-q');
    const answer = item.querySelector('.faq-a');
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('[data-faq].open').forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
          other.querySelector('.faq-a').style.maxHeight = null;
        }
      });
      if (isOpen) {
        item.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        answer.style.maxHeight = null;
      } else {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  /* ============ TRACE-YOUR-POINT INTERACTIVE MOMENT ============ */
  const traceHold = document.getElementById('traceHold');
  const traceSection = document.getElementById('traceSection');
  const tracePathFill = document.getElementById('tracePathFill');
  const traceDot = document.getElementById('traceDot');
  const traceLabel = document.getElementById('traceLabel');
  const traceResult = document.getElementById('traceResult');
  const ringCircle = traceHold.querySelector('.ring circle');
  const RING_LEN = 552;
  const PATH_LEN = 600;
  let holding = false, progress = 0, rafTrace = null, done = false;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setTraceVisual(p) {
    tracePathFill.style.strokeDashoffset = String(PATH_LEN * (1 - p));
    ringCircle.style.strokeDashoffset = String(RING_LEN * (1 - p));
    if (p > 0.02) {
      const pt = tracePathFill.getPointAtLength(PATH_LEN * p);
      traceDot.setAttribute('cx', pt.x);
      traceDot.setAttribute('cy', pt.y);
      traceDot.style.r = '6';
    }
  }
  function traceStep() {
    if (!done) {
      progress += holding ? 0.014 : -0.02;
      progress = Math.min(1, Math.max(0, progress));
      setTraceVisual(progress);
    }
    if (progress >= 1 && !done) {
      done = true;
      traceSection.classList.add('done');
      traceLabel.textContent = 'Listo';
      traceResult.textContent = 'Ese es tu punto. Hablemos de cómo llegar a él.';
    }
    if (!done && (progress > 0 || holding)) rafTrace = requestAnimationFrame(traceStep);
    else rafTrace = null;
  }
  function startHold() {
    if (reduceMotion) return;
    holding = true;
    if (!rafTrace) rafTrace = requestAnimationFrame(traceStep);
  }
  function endHold() {
    holding = false;
    if (!rafTrace) rafTrace = requestAnimationFrame(traceStep);
  }
  traceHold.addEventListener('mousedown', startHold);
  traceHold.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(); }, { passive: false });
  addEventListener('mouseup', endHold);
  addEventListener('touchend', endHold);
  traceHold.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); startHold(); } });
  traceHold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') endHold(); });

  if (reduceMotion) {
    progress = 1; done = true;
    setTraceVisual(1);
    traceSection.classList.add('done');
    traceLabel.textContent = 'Listo';
    traceResult.textContent = 'Ese es tu punto. Hablemos de cómo llegar a él.';
  }

  /* ============ PLOTLINE TEASER CAROUSEL ============ */
  (function initPlotlineCarousel() {
    const track = document.getElementById('plTrack');
    if (!track) return;
    const slides = [...track.querySelectorAll('.pl-slide')];
    const dotsWrap = document.getElementById('plDots');
    const prevBtn = document.getElementById('plPrev');
    const nextBtn = document.getElementById('plNext');
    const viewport = track.parentElement;
    let index = 0;
    const total = slides.length;
    const reduceMotionPl = matchMedia('(prefers-reduced-motion: reduce)').matches;

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.setAttribute('aria-label', 'Ir a la época ' + (i + 1));
      if (i === 0) dot.classList.add('active');
      dot.addEventListener('click', () => goTo(i, true));
      dotsWrap.appendChild(dot);
    });
    const dots = [...dotsWrap.children];

    function goTo(i, userInitiated) {
      index = (i + total) % total;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, di) => d.classList.toggle('active', di === index));
      slides.forEach((s, si) => s.classList.toggle('pl-active', si === index));
      if (userInitiated) restartAutoplay();
    }
    prevBtn.addEventListener('click', () => goTo(index - 1, true));
    nextBtn.addEventListener('click', () => goTo(index + 1, true));

    /* swipe */
    let startX = null;
    viewport.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) goTo(index + (dx < 0 ? 1 : -1), true);
      startX = null;
    }, { passive: true });

    /* keyboard, when the carousel has focus/hover */
    const carouselWrap = document.querySelector('.pl-carousel-wrap');
    carouselWrap.setAttribute('tabindex', '0');
    carouselWrap.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1, true); }
    });

    /* autoplay, paused on hover/focus, off entirely under reduced motion */
    let autoplayId = null;
    function startAutoplay() {
      if (reduceMotionPl) return;
      stopAutoplay();
      autoplayId = setInterval(() => goTo(index + 1, false), 5500);
    }
    function stopAutoplay() { if (autoplayId) { clearInterval(autoplayId); autoplayId = null; } }
    function restartAutoplay() { if (!reduceMotionPl) { stopAutoplay(); startAutoplay(); } }
    carouselWrap.addEventListener('mouseenter', stopAutoplay);
    carouselWrap.addEventListener('mouseleave', startAutoplay);
    carouselWrap.addEventListener('focusin', stopAutoplay);
    carouselWrap.addEventListener('focusout', startAutoplay);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopAutoplay(); else startAutoplay(); });

    const carouselIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) startAutoplay(); else stopAutoplay(); });
    }, { threshold: 0.3 });
    carouselIO.observe(carouselWrap);

    goTo(0, false);
  })();

  /* ============ CONTACT FORM (Formspree) ============ */
  const form = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        form.classList.add('hide');
        formSuccess.classList.add('show');
      } else {
        throw new Error('submit failed');
      }
    } catch (err) {
      submitBtn.disabled = false;
      alert('No pudimos enviar el formulario. Escríbenos directo a hola@biplot.cl mientras lo revisamos.');
    }
  });

  /* ============ AMBIENT SOUND TOGGLE ============ */
  const soundToggle = document.getElementById('soundToggle');
  const iconOff = document.getElementById('soundIconOff');
  const iconOn = document.getElementById('soundIconOn');
  let audioCtx = null, ambientOn = false, ambientNodes = null;

  function startAmbient() {
    if (ambientNodes) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.05;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0001;
    noise.connect(filter).connect(gain).connect(audioCtx.destination);
    noise.start();
    gain.gain.exponentialRampToValueAtTime(0.05, audioCtx.currentTime + 1.2);
    ambientNodes = { noise, gain };
  }
  function stopAmbient() {
    if (!ambientNodes) return;
    const { noise, gain } = ambientNodes;
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);
    setTimeout(() => { try { noise.stop(); } catch (e) {} }, 700);
    ambientNodes = null;
  }
  soundToggle.addEventListener('click', () => {
    ambientOn = !ambientOn;
    soundToggle.setAttribute('aria-pressed', String(ambientOn));
    iconOff.style.display = ambientOn ? 'none' : '';
    iconOn.style.display = ambientOn ? '' : 'none';
    if (ambientOn) startAmbient(); else stopAmbient();
  });

  /* pause offscreen/hidden-tab animation loops */
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('paused', document.hidden);
  });
})();
