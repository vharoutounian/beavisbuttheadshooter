// World-space effects: particles, tracers, wall decals, floating text.
// Screen-space effects: ejected shell casings.
const Fx = (() => {
  let particles = [], tracers = [], decals = [], floaters = [], shells = [];
  const TAU = Math.PI * 2;

  function burst(x, y, opts = {}) {
    const count = opts.count ?? 8;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = (opts.speed ?? 2) * (0.3 + Math.random() * 0.7);
      particles.push({
        x, y,
        z: (opts.z ?? 0.4) + Math.random() * (opts.zSpread ?? 0.4),
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        vz: (opts.vz ?? 0) + (Math.random() - 0.25) * 2,
        life: (opts.life ?? 0.5) * (0.5 + Math.random() * 0.8),
        maxLife: opts.life ?? 0.5,
        size: opts.size ?? 0.03,
        color: opts.color ?? '#ccc',
        gravity: opts.gravity ?? 3,
      });
    }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
  }

  // A bright streak from (x0,y0) to (x1,y1) at mid height, fades fast.
  function tracer(x0, y0, x1, y1) {
    tracers.push({ x0, y0, x1, y1, t: 0.07, max: 0.07 });
    if (tracers.length > 40) tracers.shift();
  }

  function decal(x, y) {
    decals.push({ x, y, t: 24 });
    if (decals.length > 70) decals.shift();
  }

  function floater(x, y, text, color, opts = {}) {
    floaters.push({
      x: x + (Math.random() - 0.5) * 0.3,
      y: y + (Math.random() - 0.5) * 0.3,
      z: opts.z ?? 1.15,
      vz: opts.vz ?? 0.9,
      text, color,
      size: opts.size ?? 1,
      t: opts.life ?? 0.8, max: opts.life ?? 0.8,
    });
    if (floaters.length > 30) floaters.shift();
  }

  // screen-space shell casing popped from the viewmodel
  function shell(sx, sy) {
    shells.push({
      x: sx, y: sy,
      vx: 180 + Math.random() * 160,
      vy: -260 - Math.random() * 140,
      rot: Math.random() * TAU,
      vrot: 6 + Math.random() * 10,
      t: 0.9,
    });
    if (shells.length > 24) shells.shift();
  }

  function update(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vz -= p.gravity * dt;
      p.z = Math.max(0.02, p.z + p.vz * dt);
    }
    particles = particles.filter(p => p.life > 0);

    for (const t of tracers) t.t -= dt;
    tracers = tracers.filter(t => t.t > 0);

    for (const d of decals) d.t -= dt;
    decals = decals.filter(d => d.t > 0);

    for (const f of floaters) { f.t -= dt; f.z += f.vz * dt; f.vz *= 0.94; }
    floaters = floaters.filter(f => f.t > 0);

    for (const s of shells) {
      s.t -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vy += 1900 * dt;
      s.rot += s.vrot * dt;
    }
    shells = shells.filter(s => s.t > 0);
  }

  function reset() {
    particles = []; tracers = []; decals = []; floaters = []; shells = [];
  }

  return {
    burst, tracer, decal, floater, shell, update, reset,
    get particles() { return particles; },
    get tracers() { return tracers; },
    get decals() { return decals; },
    get floaters() { return floaters; },
    get shells() { return shells; },
  };
})();
