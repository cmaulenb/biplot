(() => {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============ TYPEWRITER (terminal, chapter 1) ============ */
  function typeLines(el, lines, opts = {}) {
    const speed = opts.speed || 22;
    const lineGap = opts.lineGap || 260;
    if (reduceMotion) {
      el.textContent = lines.join('\n');
      return Promise.resolve();
    }
    el.textContent = '';
    return new Promise(async (resolve) => {
      for (const line of lines) {
        for (let i = 0; i < line.length; i++) {
          el.textContent += line[i];
          await new Promise(r => setTimeout(r, speed));
        }
        el.textContent += '\n';
        await new Promise(r => setTimeout(r, lineGap));
      }
      resolve();
    });
  }

  const TERM_LINES = [
    '> LEYENDO PROCESO ACTUAL...',
    '> BUSCANDO CUELLOS DE BOTELLA...',
    '> 14 PASOS MANUALES ENCONTRADOS',
    '> 1 PERSONA INSUSTITUIBLE DETECTADA',
    '> ANTES DE ARREGLAR ALGO, HAY QUE ENTENDERLO.'
  ];
  const ASCII_FRAMES = ['▁▁▂▁▁▁▂▁', '▂▁▃▂▁▂▃▁', '▃▂▄▃▂▃▄▂', '▄▃▅▄▃▅▅▃', '▅▄▆▆▅▆▇▅', '▇▆█▇▇█▇▇'];

  let termStarted = false;
  const termEl = document.getElementById('term-lines');
  const asciiEl = document.getElementById('asciiBars');
  function startTerminalOnce() {
    if (termStarted) return;
    termStarted = true;
    typeLines(termEl, TERM_LINES);
    if (asciiEl) {
      if (reduceMotion) {
        asciiEl.textContent = ASCII_FRAMES[ASCII_FRAMES.length - 1] + '  DIAGNÓSTICO: OK';
      } else {
        let f = 0;
        const step = () => {
          asciiEl.textContent = ASCII_FRAMES[Math.min(f, ASCII_FRAMES.length - 1)] + '  DIAGNÓSTICO: ' + (f >= ASCII_FRAMES.length - 1 ? 'OK' : '...');
          if (f < ASCII_FRAMES.length - 1) { f++; setTimeout(step, 550); }
        };
        setTimeout(step, 1600);
      }
    }
  }

  /* ============ CURVE DRAW, CHAPTER 5 ============ */
  let curveStarted = false;
  const finalCurve = document.getElementById('finalCurve');
  function startCurveOnce() {
    if (curveStarted || !finalCurve) return;
    curveStarted = true;
    finalCurve.classList.add('in');
  }

  /* ============ REVEAL THE CONTENT OF WHICHEVER CHAPTER JUST BECAME ACTIVE ============ */
  function revealChapter(ch) {
    ch.querySelectorAll('.rv').forEach((el, i) => {
      if (reduceMotion) { el.classList.add('in'); return; }
      setTimeout(() => el.classList.add('in'), i * 70);
    });
    if (ch.id === 'ch1') startTerminalOnce();
    if (ch.id === 'ch5') startCurveOnce();
  }

  /* ============ BUTTON-DRIVEN CHAPTER NAVIGATION ============ */
  const chapterEls = [...document.querySelectorAll('.chapter')];
  const dialButtons = [...document.querySelectorAll('.dial button')];
  const overlay = document.getElementById('staticOverlay');
  const prevBtn = document.getElementById('plPrevBtn');
  const nextBtn = document.getElementById('plNextBtn');
  const counterEl = document.getElementById('plCounter');
  const stage = document.getElementById('plStage');
  let currentIndex = chapterEls.findIndex(ch => ch.classList.contains('pl-active'));
  if (currentIndex < 0) currentIndex = 0;

  /* one figure per era boundary, acting out its idea in that era's technology. The
     veil is the only full cover; it eases IN, and then eases OUT while the incoming
     chapter is already sliding + assembling underneath, so the effect flows into
     the next view instead of ending on a static page. Every figure is mirrored
     backward with .reverse. */
  const TRANSITION_MODES = { '0-1': 'paper', '1-2': 'burst', '2-3': 'converge', '3-4': 'sticker', '4-5': 'handoff' };
  const ALL_MODES = ['paper', 'burst', 'converge', 'sticker', 'handoff'];
  const CANVAS_BG = { ch0: '#e8dfc8', ch1: '#020604', ch2: '#150523', ch3: '#eef1f6', ch4: '#0E2A47', ch5: '#081a2e' };
  const DURATION = 1050;                 // whole transition
  const veil = document.getElementById('plVeil');

  /* the 0→1 boundary uses the Higgsfield 4K crumple of the real card, scrubbed by
     transition progress (forward = crush, backward = un-crush). Load it as a Blob
     up front so the scrub is smooth; fall back to the veil if it never loads. */
  const paperVideo = document.getElementById('plPaperVideo');
  let paperReady = false, paperDur = 0, paperSeekBusy = false, paperPending = null;
  if (paperVideo && !reduceMotion) {
    fetch('assets/paper-crumple.mp4').then(r => r.ok ? r.blob() : Promise.reject())
      .then(b => {
        paperVideo.src = URL.createObjectURL(b);
        paperVideo.addEventListener('loadedmetadata', () => { paperDur = paperVideo.duration || 0; }, { once: true });
        paperVideo.addEventListener('canplay', () => { paperReady = paperDur > 0; }, { once: true });
        paperVideo.load();
      }).catch(() => { paperReady = false; });
  }
  function paperSeek(t) {
    if (!paperDur) return;
    if (paperSeekBusy) { paperPending = t; return; }
    paperSeekBusy = true;
    try { paperVideo.currentTime = t; } catch (e) { paperSeekBusy = false; }
  }
  if (paperVideo) paperVideo.addEventListener('seeked', () => {
    paperSeekBusy = false;
    if (paperPending !== null) { const t = paperPending; paperPending = null; paperSeek(t); }
  });

  function modeForPair(i, j) {
    const a = Math.min(i, j), b = Math.max(i, j);
    return TRANSITION_MODES[a + '-' + b] || 'burst';
  }

  function setActiveDial(index) {
    dialButtons.forEach((b, i) => b.classList.toggle('active', i === index));
  }

  function updateControls() {
    counterEl.textContent = (currentIndex + 1) + ' / ' + chapterEls.length;
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === chapterEls.length - 1;
    setActiveDial(currentIndex);
  }

  const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  let transitioning = false;
  function goTo(targetIndex) {
    targetIndex = Math.max(0, Math.min(chapterEls.length - 1, targetIndex));
    if (targetIndex === currentIndex || transitioning) return;
    const forward = targetIndex > currentIndex;
    const fromEl = chapterEls[currentIndex];
    const toEl = chapterEls[targetIndex];

    function finalizeActive() {
      toEl.classList.remove('pl-entering');
      toEl.classList.add('pl-active');
    }

    if (reduceMotion || !overlay) {
      fromEl.classList.remove('pl-active');
      toEl.classList.add('pl-active');
      currentIndex = targetIndex;
      updateControls();
      revealChapter(toEl);
      setAmbientForChapter(toEl.id);
      return;
    }

    transitioning = true;
    const dir = forward ? 1 : -1;
    fromEl.style.setProperty('--dir', dir);
    toEl.style.setProperty('--dir', dir);

    // the era figure rides on the veil
    const mode = modeForPair(chapterEls.indexOf(fromEl), chapterEls.indexOf(toEl));
    const usePaperVid = (mode === 'paper' && paperReady);
    overlay.classList.remove(...ALL_MODES.map(m => 'mode-' + m), 'mode-papervid', 'reverse');
    void overlay.offsetWidth;
    overlay.classList.add('active', usePaperVid ? 'mode-papervid' : 'mode-' + mode);
    if (!forward && !usePaperVid) overlay.classList.add('reverse');
    // skip the pristine flat-card portion of the clip: the video enters already
    // wrinkling, so we never compare two flat cards of different sizes — the fold
    // motion masks any size difference between the CSS card and the video card
    const PVSTART = 0.16;
    const pvTime = f => (PVSTART + (1 - PVSTART) * f) * paperDur;
    if (usePaperVid) { paperVideo.style.opacity = 0; paperSeek(pvTime(forward ? 0 : 1)); }
    else veil.style.background = CANVAS_BG[toEl.id] || '#0b0c0a';

    // the outgoing chapter eases out immediately, EXCEPT for the paper-video path:
    // there the video crossfades in over the still card, so the sizes never jump
    if (!usePaperVid) {
      fromEl.classList.remove('pl-active');
      fromEl.classList.add('pl-leaving');
    }

    const swapAt = usePaperVid ? 0.52 : 0.44;
    let swapped = false;
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / DURATION);
      if (usePaperVid) {
        // scrub the crumple by progress; fade the clip IN over the real card at the
        // start (so no size jump) and OUT at the end (so the next view is revealed)
        paperSeek(pvTime(forward ? p : 1 - p));
        let o = 1;
        if (p < 0.07) o = p / 0.07;                                   // quick fade-in over the card
        else if (p > 0.85) o = Math.max(0, 1 - (p - 0.85) / 0.15);    // fade out to reveal next view
        paperVideo.style.opacity = o.toFixed(3);
        veil.style.opacity = 0;
      } else {
        // veil: ease in to full cover by 0.34, hold to 0.52, ease out by 0.86
        let v;
        if (p < 0.34) v = easeInOut(p / 0.34);
        else if (p < 0.52) v = 1;
        else if (p < 0.86) v = 1 - easeInOut((p - 0.52) / 0.34);
        else v = 0;
        veil.style.opacity = v.toFixed(3);
      }

      // swap under full cover, then let the incoming chapter assemble as the veil clears
      if (!swapped && p >= swapAt) {
        swapped = true;
        fromEl.classList.remove('pl-leaving', 'pl-active');
        toEl.classList.add('pl-entering');
        currentIndex = targetIndex;
        updateControls();
        revealChapter(toEl);           // staggered .rv reveal + terminal/curve signatures
        setAmbientForChapter(toEl.id);
      }
      if (p < 1) requestAnimationFrame(frame);
      else {
        finalizeActive();
        overlay.classList.remove('active', 'mode-' + mode, 'mode-papervid', 'reverse');
        veil.style.opacity = 0;
        if (paperVideo) paperVideo.style.opacity = 1;
        transitioning = false;
      }
    }
    requestAnimationFrame(frame);
  }

  prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
  nextBtn.addEventListener('click', () => goTo(currentIndex + 1));
  dialButtons.forEach((btn, i) => btn.addEventListener('click', () => goTo(i)));

  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(currentIndex + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(currentIndex - 1); }
  });

  let touchStartX = null;
  stage.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) goTo(currentIndex + (dx < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });

  updateControls();
  revealChapter(chapterEls[currentIndex]);

  /* ============ AMBIENT SOUND PER ERA ============ */
  const soundToggle = document.getElementById('soundToggle');
  const sIconOff = document.getElementById('sIconOff');
  const sIconOn = document.getElementById('sIconOn');
  let audioCtx = null, soundOn = false, nodes = null;

  function buildAmbient() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.06;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.7;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0001;
    noise.connect(filter).connect(gain).connect(audioCtx.destination);
    noise.start();
    gain.gain.exponentialRampToValueAtTime(0.04, audioCtx.currentTime + 1);
    nodes = { noise, filter, gain };
  }

  const CHAPTER_TONE = {
    ch0: { type: 'lowpass', freq: 900, q: 0.6, level: 0.02 },
    ch1: { type: 'bandpass', freq: 1400, q: 4, level: 0.035 },
    ch2: { type: 'bandpass', freq: 300, q: 2.5, level: 0.05 },
    ch3: { type: 'lowpass', freq: 200, q: 0.3, level: 0.0 },
    ch4: { type: 'lowpass', freq: 1200, q: 0.5, level: 0.03 },
    ch5: { type: 'lowpass', freq: 1000, q: 0.5, level: 0.025 }
  };

  function setAmbientForChapter(id) {
    if (!soundOn || !nodes) return;
    const tone = CHAPTER_TONE[id];
    if (!tone) return;
    const t = audioCtx.currentTime;
    nodes.filter.type = tone.type;
    nodes.filter.frequency.exponentialRampToValueAtTime(Math.max(40, tone.freq), t + 0.6);
    nodes.filter.Q.setTargetAtTime(tone.q, t, 0.3);
    nodes.gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, tone.level), t + 0.6);
  }

  soundToggle.addEventListener('click', () => {
    soundOn = !soundOn;
    soundToggle.setAttribute('aria-pressed', String(soundOn));
    sIconOff.style.display = soundOn ? 'none' : '';
    sIconOn.style.display = soundOn ? '' : 'none';
    if (soundOn) {
      buildAmbient();
      setAmbientForChapter(chapterEls[currentIndex].id);
    } else if (nodes) {
      const { noise, gain } = nodes;
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
      setTimeout(() => { try { noise.stop(); } catch (e) {} }, 600);
      nodes = null;
    }
  });

  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('paused', document.hidden);
  });
})();
