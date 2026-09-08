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

  /* boundaries that use a scrubbed Higgsfield 4K clip instead of a CSS figure.
     Each clip starts as the on-screen view and ends on the next era's colour, and
     is scrubbed by transition progress (forward = play, backward = rewind). We
     enter a little way into each clip (start) so we never compare two identical
     still frames of different sizes — the motion masks any size difference.
     Loaded as Blobs up front for smooth scrubbing; if one never loads, that
     boundary falls back to its CSS figure on the veil. */
  const VIDEO_MODES = {
    paper: { el: document.getElementById('plPaperVideo'), file: 'assets/paper-crumple.mp4', start: 0.16 },
    burst: { el: document.getElementById('plGlitchVideo'), file: 'assets/glitch.mp4', start: 0.14 },
    converge: { el: document.getElementById('plWindowsVideo'), file: 'assets/windows.mp4', start: 0.12 },
    sticker: { el: document.getElementById('plFlattenVideo'), file: 'assets/flatten.mp4', start: 0.12 }
  };
  Object.values(VIDEO_MODES).forEach(v => {
    v.ready = false; v.dur = 0; v.seekBusy = false; v.pending = null;
    if (!v.el || reduceMotion) return;
    fetch(v.file).then(r => r.ok ? r.blob() : Promise.reject())
      .then(b => {
        v.el.src = URL.createObjectURL(b);
        v.el.addEventListener('loadedmetadata', () => { v.dur = v.el.duration || 0; }, { once: true });
        v.el.addEventListener('canplay', () => { v.ready = v.dur > 0; }, { once: true });
        v.el.load();
      }).catch(() => { v.ready = false; });
    v.el.addEventListener('seeked', () => {
      v.seekBusy = false;
      if (v.pending !== null) { const t = v.pending; v.pending = null; vidSeek(v, t); }
    });
  });
  function vidSeek(v, t) {
    if (!v.dur) return;
    if (v.seekBusy) { v.pending = t; return; }
    v.seekBusy = true;
    try { v.el.currentTime = t; } catch (e) { v.seekBusy = false; }
  }

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

    // pick the transition: a scrubbed video clip for boundaries that have one,
    // otherwise the CSS figure riding on the veil
    const mode = modeForPair(chapterEls.indexOf(fromEl), chapterEls.indexOf(toEl));
    const vcfg = VIDEO_MODES[mode];
    const useVid = !!(vcfg && vcfg.ready);
    overlay.classList.remove(...ALL_MODES.map(m => 'mode-' + m), 'reverse');
    void overlay.offsetWidth;
    overlay.classList.add('active');
    if (!useVid) { overlay.classList.add('mode-' + mode); if (!forward) overlay.classList.add('reverse'); }

    // hide every transition clip, then arm the active one
    Object.values(VIDEO_MODES).forEach(v => { if (v.el) v.el.style.display = 'none'; });
    let vTime = null;
    if (useVid) {
      // enter a little way in so we never compare two identical still frames of
      // different sizes — the clip's motion masks any size difference
      vTime = f => (vcfg.start + (1 - vcfg.start) * f) * vcfg.dur;
      vcfg.el.style.display = 'block';
      vcfg.el.style.opacity = 0;
      vidSeek(vcfg, vTime(forward ? 0 : 1));
    } else {
      veil.style.background = CANVAS_BG[toEl.id] || '#0b0c0a';
    }

    // the outgoing chapter eases out immediately, EXCEPT on a video path:
    // there the clip crossfades in over the still view, so the sizes never jump
    if (!useVid) {
      fromEl.classList.remove('pl-active');
      fromEl.classList.add('pl-leaving');
    }

    const swapAt = useVid ? 0.52 : 0.44;
    let swapped = false;
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / DURATION);
      if (useVid) {
        // scrub the clip by progress; fade IN over the real view at the start
        // (no size jump) and OUT at the end (so the next view is revealed)
        vidSeek(vcfg, vTime(forward ? p : 1 - p));
        let o = 1;
        if (p < 0.07) o = p / 0.07;
        else if (p > 0.85) o = Math.max(0, 1 - (p - 0.85) / 0.15);
        vcfg.el.style.opacity = o.toFixed(3);
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

      // swap under full cover, then let the incoming chapter assemble as it clears
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
        overlay.classList.remove('active', 'mode-' + mode, 'reverse');
        veil.style.opacity = 0;
        Object.values(VIDEO_MODES).forEach(v => { if (v.el) { v.el.style.opacity = 1; v.el.style.display = 'none'; } });
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
