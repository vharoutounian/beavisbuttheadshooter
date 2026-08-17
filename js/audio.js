// Everything is synthesized with WebAudio; voice lines use speechSynthesis.
const Sound = (() => {
  let ctx = null;
  let noiseBuf = null;
  const state = { sfx: true, voice: true };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function gainEnv(t0, peak, attack, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    g.connect(ctx.destination);
    return g;
  }

  function noise(peak, decay, filterFreq, filterQ = 0.8) {
    if (!state.sfx || !ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq; f.Q.value = filterQ;
    src.connect(f).connect(gainEnv(t, peak, 0.004, decay));
    src.start(t); src.stop(t + decay + 0.05);
  }

  function tone(freq, type, peak, decay, slideTo = null) {
    if (!state.sfx || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + decay);
    o.connect(gainEnv(t, peak, 0.005, decay));
    o.start(t); o.stop(t + decay + 0.05);
  }

  const api = {
    state,
    unlock() { ensure(); },

    shotPistol()  { noise(0.5, 0.12, 2400); tone(180, 'square', 0.12, 0.08, 60); },
    shotRifle()   { noise(0.45, 0.09, 3200); tone(140, 'sawtooth', 0.1, 0.07, 50); },
    shotShotgun() { noise(0.8, 0.3, 1400, 0.5); tone(90, 'square', 0.2, 0.2, 40); },
    dryFire()     { tone(1400, 'square', 0.08, 0.04); },
    reload()      { tone(700, 'square', 0.06, 0.05); setTimeout(() => tone(500, 'square', 0.07, 0.06), 140); },
    reloadDone()  { tone(900, 'square', 0.08, 0.05); setTimeout(() => tone(1200, 'square', 0.08, 0.06), 90); },

    hitmarker()   { tone(2200, 'square', 0.12, 0.035); },
    killmarker()  { tone(1600, 'square', 0.14, 0.04); setTimeout(() => tone(2400, 'square', 0.12, 0.05), 55); },
    enemyShot()   { noise(0.25, 0.1, 1800); },
    hurt()        { tone(220, 'sawtooth', 0.25, 0.18, 90); noise(0.15, 0.12, 900); },
    splat()       { noise(0.35, 0.16, 700, 0.4); tone(160, 'triangle', 0.15, 0.12, 60); },
    explosion()   { noise(0.9, 0.7, 900, 0.3); tone(70, 'sine', 0.5, 0.55, 28); },
    throwPin()    { tone(1100, 'square', 0.07, 0.05); },
    bounce()      { tone(500, 'triangle', 0.1, 0.06, 300); },

    pickup()      { tone(880, 'square', 0.12, 0.06); setTimeout(() => tone(1320, 'square', 0.12, 0.08), 70); },
    waveHorn() {
      tone(196, 'sawtooth', 0.2, 0.5);
      setTimeout(() => tone(233, 'sawtooth', 0.2, 0.5), 350);
      setTimeout(() => tone(311, 'sawtooth', 0.25, 0.8), 700);
    },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => tone(f, 'square', 0.16, 0.22), i * 110));
    },
    strike() {
      noise(0.7, 0.5, 2600, 0.4);
      tone(1200, 'sawtooth', 0.3, 0.4, 100);
      setTimeout(() => api.explosion(), 180);
    },
    rankUp() {
      [392, 523, 659, 784].forEach((f, i) =>
        setTimeout(() => tone(f, 'triangle', 0.18, 0.3), i * 130));
    },
    step()        { noise(0.05, 0.05, 500); },

    // ------------------------------------------------------------ voice
    lastSpeak: 0,
    say(text, who, force = false) {
      if (!state.voice || !('speechSynthesis' in window)) return;
      const now = performance.now();
      if (!force && now - api.lastSpeak < 2600) return;
      if (force) speechSynthesis.cancel();
      else if (speechSynthesis.speaking) return;
      api.lastSpeak = now;
      try {
        const u = new SpeechSynthesisUtterance(text);
        if (who === 'beavis') { u.pitch = 1.8; u.rate = 1.25; }
        else { u.pitch = 0.35; u.rate = 0.85; }
        u.volume = 0.9;
        speechSynthesis.speak(u);
      } catch (e) { /* voice is a garnish; never let it break the game */ }
    },
  };
  return api;
})();
