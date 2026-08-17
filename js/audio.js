import { CHARACTERS } from './config.js';

// Everything is synthesized with WebAudio; voice lines use speechSynthesis.
// Sounds can be positional: Sound.at(name, x, y) pans/attenuates relative to
// the listener set each frame via Sound.listener(x, y, angle).
export const Sound = (() => {
  let ctx = null, sfxBus = null, musicBus = null, noiseBuf = null;
  const state = { sfx: true, voice: true, music: true };
  const vol = { sfx: 0.8, music: 0.45 };
  const listener = { x: 0, y: 0, a: 0 };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = vol.music; musicBus.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function out(pan, gain, t0, peak, attack, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak * gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    let node = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); node = p;
    }
    node.connect(sfxBus);
    return g;
  }

  function noise(peak, decay, filterFreq, opts = {}) {
    if (!state.sfx || !ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter();
    f.type = opts.hp ? 'highpass' : 'lowpass';
    f.frequency.value = filterFreq;
    f.Q.value = opts.q || 0.8;
    src.connect(f).connect(out(opts.pan, opts.gain ?? 1, t, peak, opts.attack ?? 0.004, decay));
    src.start(t); src.stop(t + decay + 0.05);
  }

  function tone(freq, type, peak, decay, opts = {}) {
    if (!state.sfx || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + decay);
    o.connect(out(opts.pan, opts.gain ?? 1, t, peak, opts.attack ?? 0.005, decay));
    o.start(t); o.stop(t + decay + 0.05);
  }

  const later = (ms, fn) => setTimeout(fn, ms);

  // -------------------------------------------------------- SFX recipes
  // Gunshots are layered: sub thump + mid body + high crack + noise tail.
  const recipes = {
    shotPistol(o) {
      noise(0.5, 0.1, 2600, o); noise(0.25, 0.05, 4000, { ...o, hp: true });
      tone(170, 'square', 0.14, 0.08, { ...o, slideTo: 60 });
    },
    shotSmg(o) {
      noise(0.4, 0.07, 3000, o); noise(0.2, 0.04, 5000, { ...o, hp: true });
      tone(200, 'sawtooth', 0.09, 0.05, { ...o, slideTo: 80 });
    },
    shotRifle(o) {
      noise(0.5, 0.1, 3200, o); noise(0.22, 0.05, 4500, { ...o, hp: true });
      tone(130, 'sawtooth', 0.13, 0.08, { ...o, slideTo: 50 });
    },
    shotShotgun(o) {
      noise(0.85, 0.28, 1500, { ...o, q: 0.5 }); noise(0.3, 0.08, 4200, { ...o, hp: true });
      tone(85, 'square', 0.24, 0.2, { ...o, slideTo: 38 });
    },
    shotSniper(o) {
      noise(0.9, 0.4, 1900, { ...o, q: 0.4 }); noise(0.35, 0.1, 5000, { ...o, hp: true });
      tone(70, 'square', 0.3, 0.35, { ...o, slideTo: 30 });
      later(80, () => noise(0.2, 0.35, 900, o));        // echo tail
    },
    dry(o)        { tone(1400, 'square', 0.08, 0.04, o); },
    reloadStart(o){ tone(700, 'square', 0.06, 0.05, o); later(140, () => tone(500, 'square', 0.07, 0.06, o)); },
    reloadDone(o) { tone(900, 'square', 0.08, 0.05, o); later(90, () => tone(1250, 'square', 0.08, 0.06, o)); },
    bolt(o)       { tone(520, 'square', 0.1, 0.06, o); later(160, () => tone(430, 'square', 0.1, 0.07, o)); },
    swap(o)       { noise(0.08, 0.06, 1200, o); tone(640, 'square', 0.05, 0.04, o); },

    hitmark(o)     { tone(2300, 'square', 0.11, 0.03, o); },
    headshotMark(o){ tone(2800, 'square', 0.13, 0.03, o); later(40, () => tone(3400, 'square', 0.1, 0.04, o)); },
    killConfirm(o) { tone(1500, 'square', 0.13, 0.04, o); later(60, () => tone(2300, 'square', 0.11, 0.05, o)); },
    armorHit(o)    { tone(600, 'triangle', 0.2, 0.07, o); noise(0.1, 0.05, 3000, o); },

    enemyShot(o)      { noise(0.24, 0.09, 1800, o); tone(160, 'square', 0.06, 0.06, { ...o, slideTo: 70 }); },
    enemyShotHeavy(o) { noise(0.4, 0.16, 1300, o); tone(100, 'square', 0.12, 0.12, { ...o, slideTo: 45 }); },
    hurt(o)     { tone(220, 'sawtooth', 0.24, 0.16, { ...o, slideTo: 90 }); noise(0.12, 0.1, 900, o); },
    splat(o)    { noise(0.32, 0.15, 700, { ...o, q: 0.4 }); tone(150, 'triangle', 0.14, 0.12, { ...o, slideTo: 55 }); },
    explosion(o){ noise(0.9, 0.65, 900, { ...o, q: 0.3 }); tone(65, 'sine', 0.5, 0.55, { ...o, slideTo: 26 }); },
    pin(o)      { tone(1100, 'square', 0.07, 0.05, o); },
    bounce(o)   { tone(500, 'triangle', 0.1, 0.06, { ...o, slideTo: 300 }); },
    ricochet(o) { tone(2400, 'sine', 0.07, 0.14, { ...o, slideTo: 700 }); },

    pickup(o)  { tone(880, 'square', 0.11, 0.06, o); later(70, () => tone(1320, 'square', 0.11, 0.08, o)); },
    buyOk(o)   { tone(660, 'square', 0.1, 0.07, o); later(90, () => tone(990, 'square', 0.1, 0.09, o)); },
    buyFail(o) { tone(220, 'square', 0.12, 0.14, o); },
    uiHover(o) { tone(500, 'sine', 0.05, 0.03, o); },
    uiClick(o) { tone(760, 'square', 0.07, 0.04, o); },
    medal(o)   { tone(1050, 'triangle', 0.1, 0.12, o); later(80, () => tone(1560, 'triangle', 0.09, 0.14, o)); },

    waveHorn(o) {
      tone(196, 'sawtooth', 0.18, 0.5, o);
      later(350, () => tone(233, 'sawtooth', 0.18, 0.5, o));
      later(700, () => tone(311, 'sawtooth', 0.22, 0.8, o));
    },
    fanfare(o) {
      [523, 659, 784, 1047].forEach((f, i) => later(i * 110, () => tone(f, 'square', 0.14, 0.22, o)));
    },
    strike(o) {
      noise(0.7, 0.5, 2600, { ...o, q: 0.4 });
      tone(1200, 'sawtooth', 0.28, 0.4, { ...o, slideTo: 100 });
      later(180, () => recipes.explosion(o || {}));
    },
    rankUp(o) {
      [392, 523, 659, 784].forEach((f, i) => later(i * 130, () => tone(f, 'triangle', 0.16, 0.3, o)));
    },
    step(o)      { noise(0.045, 0.05, 500, o); },
    stepEnemy(o) { noise(0.05, 0.06, 420, o); },
    slide(o)     { noise(0.18, 0.3, 800, o); },
  };

  function play(name, opts = {}) {
    if (!recipes[name] || !ensure()) return;
    recipes[name](opts);
  }

  function at(name, x, y, extraGain = 1) {
    if (!ensure()) return;
    const dx = x - listener.x, dy = y - listener.y;
    const d = Math.hypot(dx, dy);
    const rel = Math.atan2(dy, dx) - listener.a;
    const pan = Math.sin(rel) * Math.min(1, d / 4);
    const gain = extraGain * Math.min(1, 1.4 / (1 + d * 0.16));
    if (gain < 0.03) return;
    play(name, { pan, gain });
  }

  // ------------------------------------------------------------- music
  // A low tension bed: detuned drone + filtered pulse. Intensity (0..1)
  // opens the filter and adds a slow kick.
  const music = (() => {
    let nodes = null, pulseTimer = null, intensity = 0;
    function start() {
      if (!state.music || !ensure() || nodes) return;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 180; filt.Q.value = 2;
      const g = ctx.createGain(); g.gain.value = 0.0;
      filt.connect(g).connect(musicBus);
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 41.2;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 41.7;
      const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = 82.4;
      const og = ctx.createGain(); og.gain.value = 0.16;
      o1.connect(og); o2.connect(og); o3.connect(og); og.connect(filt);
      o1.start(); o2.start(); o3.start();
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lfoG = ctx.createGain(); lfoG.gain.value = 60;
      lfo.connect(lfoG).connect(filt.frequency); lfo.start();
      g.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
      nodes = { g, filt, oscs: [o1, o2, o3, lfo] };
      let beat = 0;
      pulseTimer = setInterval(() => {
        if (!state.music || !nodes) return;
        beat++;
        if (intensity > 0.25 && beat % 2 === 0) {
          const t = ctx.currentTime;
          const k = ctx.createOscillator(); k.type = 'sine';
          k.frequency.setValueAtTime(120, t);
          k.frequency.exponentialRampToValueAtTime(38, t + 0.16);
          const kg = ctx.createGain();
          kg.gain.setValueAtTime(0.28 * intensity, t);
          kg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          k.connect(kg).connect(musicBus);
          k.start(t); k.stop(t + 0.25);
        }
        if (intensity > 0.6 && beat % 4 === 1) {
          const t = ctx.currentTime;
          const src = ctx.createBufferSource(); src.buffer = noiseBuf;
          const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
          const hg = ctx.createGain();
          hg.gain.setValueAtTime(0.05 * intensity, t);
          hg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          src.connect(f).connect(hg).connect(musicBus);
          src.start(t); src.stop(t + 0.1);
        }
      }, 430);
    }
    function stop() {
      if (!nodes) return;
      clearInterval(pulseTimer);
      const { g, oscs } = nodes;
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      const dead = oscs;
      setTimeout(() => dead.forEach(o => { try { o.stop(); } catch (e) {} }), 1000);
      nodes = null;
    }
    function setIntensity(v) {
      intensity = Math.max(0, Math.min(1, v));
      if (nodes) nodes.filt.frequency.value = 140 + intensity * 320;
    }
    return { start, stop, setIntensity };
  })();

  // ------------------------------------------------------------- voice
  let lastSpeak = 0;
  function say(text, who, force = false) {
    if (!state.voice || !('speechSynthesis' in window)) return;
    const now = performance.now();
    if (!force && now - lastSpeak < 2600) return;
    if (force) speechSynthesis.cancel();
    else if (speechSynthesis.speaking) return;
    lastSpeak = now;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = (CHARACTERS[who] && CHARACTERS[who].voice) || {};
      u.pitch = v.pitch ?? 1;
      u.rate = v.rate ?? 1;
      u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { /* voice is garnish; never let it break the game */ }
  }

  function setVolumes(v) {
    if (v.sfx !== undefined) { vol.sfx = v.sfx; if (sfxBus) sfxBus.gain.value = v.sfx; }
    if (v.music !== undefined) { vol.music = v.music; if (musicBus) musicBus.gain.value = v.music; }
  }
  function setListener(x, y, a) { listener.x = x; listener.y = y; listener.a = a; }

  return { state, unlock: ensure, play, at, say, music, setVolumes, listener: setListener };
})();
