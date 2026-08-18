import {
  CONFIG, WEAPONS, SLOT_ORDER, ENEMY_TYPES, WAVE_MIX, ELITE_FROM_WAVE,
  ELITE_CHANCE, RANKS, MEDALS, PERKS, SHOP, CHARACTERS, LINES, DEFAULT_SETTINGS,
} from './config.js';
import { GameMap } from './map.js';
import { Textures } from './textures.js';
import { Sound } from './audio.js';
import { Fx } from './fx.js';
import { Renderer } from './render3d.js';   // runtime-only (circular is fine)
import { UI } from './ui.js';               // runtime-only live binding

// Core simulation: player, weapons, AI, waves, economy. No drawing in here —
// the Renderer reads Game.S every frame.
export const Game = (() => {
  const canvas = document.getElementById('game');
  const TAU = Math.PI * 2;
  const { W, H } = CONFIG;
  const DEBUG = /[?&]debug/.test(location.search);

  // ---------------------------------------------------------- settings
  const settings = (() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('bbs-settings') || '{}') };
    } catch (e) { return { ...DEFAULT_SETTINGS }; }
  })();
  function saveSettings() {
    try { localStorage.setItem('bbs-settings', JSON.stringify(settings)); } catch (e) {}
    applySettings();
  }
  function applySettings() {
    Sound.setVolumes({ sfx: settings.volSfx, music: settings.volMusic });
    Sound.state.voice = settings.voice;
    Sound.state.music = settings.music;
    if (!settings.music) Sound.music.stop();
  }

  const store = (() => {
    try { return JSON.parse(localStorage.getItem('bbshooter') || '{}'); }
    catch (e) { return {}; }
  })();
  function saveStore() {
    try { localStorage.setItem('bbshooter', JSON.stringify(store)); } catch (e) {}
  }

  // ------------------------------------------------------------- state
  const S = {
    mode: 'menu',            // menu | playing | paused | dead
    time: 0,
    debug: DEBUG,
    player: null,
    enemies: [], grenades: [], pickups: [],
    feed: [], medals: [], hurtArcs: [],
    wave: 0, toSpawn: 0, spawnTimer: 0, intermission: 0,
    score: 0, cash: 0, xp: 0, kills: 0,
    streak: 0, streakFired: 0,
    multiplier: 1, multTimer: 0,
    hitmarker: 0, hitmarkerKind: 'hit',
    shake: 0, flash: 0, screenFlash: null,
    announce: null,
    shopOpen: false,
    boss: null,
    attract: { a: 0, x: 0, y: 0 },   // menu camera
    killTimes: [],
    cursor: { sx: 0, sy: 0, seen: false },   // raw screen px
    aim: { x: 0, y: 0 },                     // cursor on the ground plane
  };

  function freshPlayer(character) {
    const ch = CHARACTERS[character];
    return {
      character,
      x: GameMap.playerStart.x, y: GameMap.playerStart.y,
      a: -Math.PI / 2, pitch: 0, recoilPitch: 0,
      eye: 0.5, roll: 0,
      maxHp: CONFIG.MAX_HP + (ch.hpBonus || 0),
      hp: CONFIG.MAX_HP + (ch.hpBonus || 0),
      armor: 0, lastHurt: -99,
      weapon: 'rifle', owned: { pistol: true, rifle: true },
      ammo: {}, reserve: {}, reloading: 0, swapT: 0,
      grenades: 3,
      fireCooldown: 0, adsT: 0, sprinting: false,
      crouching: false, slideT: 0, slideCd: 0, slideDx: 0, slideDy: 0, slidKill: false,
      bobPhase: 0, bobMag: 0, recoil: 0,
      speedBoost: 0, dmgBoost: 0,
      perks: {},
      vel: { x: 0, y: 0 },
    };
  }

  // ------------------------------------------------------------- input
  const keys = {};
  let mouseDown = false, mouseRight = false, wantFire = false;

  // ARPG cursor aim: no pointer lock. The mouse stays visible; every frame
  // the cursor is projected onto the ground plane and the hero faces it.
  function lockPointer() { /* retired — cursor-aimed now */ }

  document.addEventListener('keydown', e => {
    if (S.mode === 'menu') return;
    keys[e.code] = true;
    if (S.mode === 'playing') {
      if (S.shopOpen) {
        if (e.code === 'Tab' || e.code === 'Escape' || e.code === 'KeyB') toggleShop();
        if (e.code.startsWith('Digit')) buy(parseInt(e.code.slice(5), 10) - 1);
        e.preventDefault();
        return;
      }
      if (e.code === 'KeyR') startReload();
      if (e.code === 'KeyG') throwGrenade();
      if (e.code === 'KeyC' || e.code === 'ControlLeft') crouchPressed();
      if (e.code === 'Tab' || e.code === 'KeyB') { toggleShop(); e.preventDefault(); }
      for (let i = 0; i < SLOT_ORDER.length; i++)
        if (e.code === 'Digit' + (i + 1)) trySwitch(SLOT_ORDER[i]);
      if (e.code === 'KeyM') { Sound.state.sfx = !Sound.state.sfx; pushFeed(Sound.state.sfx ? 'SFX ON' : 'SFX OFF'); }
      if (e.code === 'KeyV') { settings.voice = !settings.voice; saveSettings(); pushFeed(settings.voice ? 'VOICE ON' : 'VOICE OFF'); }
      if (e.code === 'KeyN') { settings.music = !settings.music; saveSettings(); if (settings.music) Sound.music.start(); pushFeed(settings.music ? 'MUSIC ON' : 'MUSIC OFF'); }
      if (e.code === 'KeyP') pause();
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
  });
  document.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (S.player && (e.code === 'KeyC' || e.code === 'ControlLeft')) crouchReleased();
  });

  canvas.addEventListener('mousedown', e => {
    if (S.shopOpen || S.mode !== 'playing') return;
    if (e.button === 0) { mouseDown = true; wantFire = true; }
    if (e.button === 2) { mouseRight = true; throwGrenade(); }
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 0) mouseDown = false;
    if (e.button === 2) mouseRight = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('mousemove', e => {
    S.cursor.sx = e.clientX;
    S.cursor.sy = e.clientY;
    S.cursor.seen = true;
  });
  canvas.addEventListener('wheel', e => {
    if (S.mode !== 'playing' || S.shopOpen) return;
    e.preventDefault();
    const p = S.player;
    const ownedSlots = SLOT_ORDER.filter(w => p.owned[w]);
    const i = ownedSlots.indexOf(p.weapon);
    const n = (i + (e.deltaY > 0 ? 1 : ownedSlots.length - 1)) % ownedSlots.length;
    trySwitch(ownedSlots[n]);
  }, { passive: false });


  // ------------------------------------------------------------ helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
  const lines = () => LINES[S.player.character];
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  // Hot path (640+ calls/frame): fills and returns a shared scratch object.
  // Callers must consume the result before the next castRay call.
  const rayHit = { dist: 0, side: 0, tile: 1, wallX: 0 };
  function castRay(px, py, dx, dy) {
    let mapX = px | 0, mapY = py | 0;
    const deltaX = Math.abs(1 / (dx || 1e-9)), deltaY = Math.abs(1 / (dy || 1e-9));
    let stepX, stepY, sideX, sideY;
    if (dx < 0) { stepX = -1; sideX = (px - mapX) * deltaX; }
    else { stepX = 1; sideX = (mapX + 1 - px) * deltaX; }
    if (dy < 0) { stepY = -1; sideY = (py - mapY) * deltaY; }
    else { stepY = 1; sideY = (mapY + 1 - py) * deltaY; }
    let side = 0, tile = 1;
    for (let i = 0; i < 160; i++) {
      if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
      else { sideY += deltaY; mapY += stepY; side = 1; }
      tile = GameMap.tileAt(mapX, mapY);
      if (tile > 0) break;
    }
    const dist = side === 0 ? sideX - deltaX : sideY - deltaY;
    let wallX = side === 0 ? py + dist * dy : px + dist * dx;
    wallX -= wallX | 0;
    rayHit.dist = dist; rayHit.side = side; rayHit.tile = tile; rayHit.wallX = wallX;
    return rayHit;
  }

  function hasLOS(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return true;
    return castRay(ax, ay, dx / d, dy / d).dist > d;
  }

  function circleHitsWall(x, y, r) {
    for (let gy = (y - r) | 0; gy <= (y + r) | 0; gy++)
      for (let gx = (x - r) | 0; gx <= (x + r) | 0; gx++) {
        if (!GameMap.solidAt(gx, gy)) continue;
        const cx = clamp(x, gx, gx + 1), cy = clamp(y, gy, gy + 1);
        if (dist2(x, y, cx, cy) < r * r) return true;
      }
    return false;
  }
  function tryMove(ent, nx, ny, r) {
    if (!circleHitsWall(nx, ent.y, r)) ent.x = nx;
    if (!circleHitsWall(ent.x, ny, r)) ent.y = ny;
  }

  function pushFeed(text) {
    S.feed.unshift({ text, t: 5 });
    if (S.feed.length > 6) S.feed.pop();
  }
  // Announcements queue instead of clobbering each other (killstreak
  // cascades, streak + wave-clear on the same kill, rank-ups).
  const announceQueue = [];
  function setAnnounce(big, small, dur = 2.6) {
    if (S.announce && S.announce.t > 0.9) {
      if (announceQueue.length < 3) announceQueue.push({ big, small, dur });
      return;
    }
    S.announce = { big, small, t: dur, max: dur };
  }

  function rankFor(xpVal) {
    let r = RANKS[0];
    for (const entry of RANKS) if (xpVal >= entry[0]) r = entry;
    return r[1];
  }
  function nextRank(xpVal) {
    for (const entry of RANKS) if (xpVal < entry[0]) return entry;
    return null;
  }

  function award(pts, x, y, label) {
    const p = Math.round(pts * S.multiplier);
    S.score += p; S.cash += p; S.xp += p;
    if (x !== undefined) Fx.floater(x, y, `+${p}`, '#f6c945', { size: 0.9 });
    if (label) pushFeed(label + `  +${p}`);
    checkRank();
    return p;
  }

  // ------------------------------------------------------------ weapons
  function spec() { return WEAPONS[S.player.weapon]; }
  function chMod() { return CHARACTERS[S.player.character]; }
  function reloadTime(w) {
    let t = WEAPONS[w].reload * (chMod().reloadMult || 1);
    if (S.player.perks.hands) t *= 0.6;
    return t;
  }
  function rofTime(w) { return WEAPONS[w].rof * (chMod().rofMult || 1); }

  function trySwitch(w) {
    const p = S.player;
    if (!p.owned[w] || p.weapon === w || p.reloading > 0) return;
    p.weapon = w;
    p.swapT = (p.perks.hands ? 0.15 : 0.28);
    // the swap penalty REPLACES any leftover cooldown (swap-to-cancel a bolt)
    p.fireCooldown = p.swapT;
    Sound.play('swap');
  }

  function startReload() {
    const p = S.player, sp = spec();
    if (p.reloading > 0 || p.ammo[p.weapon] >= sp.mag) return;
    if (p.reserve[p.weapon] <= 0) { Sound.play('dry'); return; }
    p.reloading = reloadTime(p.weapon);
    p.reloadTotal = p.reloading;          // renderer animates against this
    Sound.play('reloadStart');
    if (Math.random() < 0.12) Sound.say(pick(lines().reload), p.character);
  }

  function currentSpread() {
    const p = S.player, sp = spec();
    let s = sp.spread + (sp.adsSpread - sp.spread) * p.adsT;
    if (p.sprinting) s *= 2.2;
    if (p.slideT > 0) s *= 1.5;
    if (p.perks.grip) s *= 0.7;
    // scoped sway: breathe unless crouched
    if (sp.scope && p.adsT > 0.8 && !p.crouching) s += sp.sway;
    return s;
  }

  function muzzleWorld() {
    // the hero's gun hand: forward and slightly right of the rig
    const p = S.player;
    const ca = Math.cos(p.a), sa = Math.sin(p.a);
    return {
      x: p.x + ca * 0.42 - sa * 0.14,
      y: p.y + sa * 0.42 + ca * 0.14,
      z: 1.16,
    };
  }

  function fire() {
    const p = S.player, sp = spec();
    if (p.reloading > 0 || p.fireCooldown > 0) return;
    if (p.sprinting) p.sprinting = false;
    if (p.ammo[p.weapon] <= 0) {
      Sound.play('dry');
      p.fireCooldown = 0.25;
      startReload();
      return;
    }
    p.ammo[p.weapon]--;
    p.fireCooldown = rofTime(p.weapon);
    p.recoil = 1;
    const kickMult = p.perks.grip ? 0.7 : 1;
    p.recoilPitch = Math.min(80, p.recoilPitch + sp.kick * kickMult * (0.6 + Math.random() * 0.6));
    p.a += (Math.random() - 0.5) * 0.004 * kickMult;
    S.shake = Math.max(S.shake, sp.pellets > 1 ? 7 : 3);
    S.flash = 0.07;
    Sound.play(sp.sfx);
    if (sp.slot !== 5) Fx.shell(W * 0.6, H * 0.66);
    if (sp.scope) setTimeout(() => { if (S.mode === 'playing') Sound.play('bolt'); }, 260);

    // top-down hitscan: 2D grid ray per pellet; crits replace headshots
    const mz = muzzleWorld();
    const spread = currentSpread();
    let hitAny = false, killedAny = false, critAny = false;

    for (let i = 0; i < sp.pellets; i++) {
      const ang = p.a + (Math.random() - 0.5) * 2 * spread * 1.6;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const wall = castRay(p.x, p.y, dx, dy);
      const wallDist = wall.dist, wallSide = wall.side;

      // nearest live enemy the ray passes through before the wall
      let best = null, bestT = wallDist;
      for (const e of S.enemies) {
        if (e.dead) continue;
        const ex = e.x - p.x, ey = e.y - p.y;
        const t = ex * dx + ey * dy;
        if (t < 0.1 || t > bestT) continue;
        const perp = Math.abs(ex * -dy + ey * dx);
        if (perp < 0.36 * e.type.scale) { best = e; bestT = t; }
      }

      if (best) {
        hitAny = true;
        let dmg = sp.dmg;
        if (bestT > sp.falloffStart) {
          dmg *= clamp(1 - (bestT - sp.falloffStart) / (sp.falloffEnd - sp.falloffStart),
            sp.minDmgMult, 1);
        }
        const crit = Math.random() < 0.18;
        if (crit) { dmg *= sp.headshot; critAny = true; }
        if (p.dmgBoost > 0) dmg *= 2;
        const killed = damageEnemy(best, dmg, bestT, { head: crit });
        if (killed) killedAny = true;
        if (sp.tracer)
          Fx.tracer(mz.x, mz.y, p.x + dx * bestT, p.y + dy * bestT,
            mz.z, 1.05 * best.type.scale);
      } else {
        // wall impact: decal + dust at a believable torso height
        const hx = p.x + dx * wallDist, hy = p.y + dy * wallDist;
        const hz = 0.8 + Math.random() * 0.6;
        const nx = wallSide === 0 ? -Math.sign(dx) : 0;
        const nz = wallSide === 1 ? -Math.sign(dy) : 0;
        Renderer.addDecal(hx, hz, hy, nx, 0, nz);
        Fx.burst(hx, hy,
          { count: 3, color: '#c9b79a', speed: 0.6, life: 0.25, z: hz / CONFIG.WALL_H });
        if (sp.tracer) Fx.tracer(mz.x, mz.y, hx, hy, mz.z, hz);
        if (Math.random() < 0.2) Sound.at('ricochet', hx, hy);
      }
    }
    if (hitAny) {
      S.hitmarker = 0.14;
      S.hitmarkerKind = killedAny ? 'kill' : critAny ? 'head' : 'hit';
      Sound.play(killedAny ? 'killConfirm' : critAny ? 'headshotMark' : 'hitmark');
    }
    if (p.ammo[p.weapon] === 0) startReload();
  }

  function throwGrenade() {
    const p = S.player;
    if (S.mode !== 'playing' || p.grenades <= 0 || p.reloading > 0 || S.shopOpen) return;
    p.grenades--;
    Sound.play('pin');
    const a = p.a;
    // throw strength scales with how far the cursor is from the hero
    const aimDist = Math.hypot(S.aim.x - p.x, S.aim.y - p.y);
    const pitchBoost = clamp((aimDist - 5) / 8, -0.4, 0.6);
    let gx = p.x + Math.cos(a) * 0.4, gy = p.y + Math.sin(a) * 0.4;
    if (GameMap.solidAt(gx, gy)) { gx = p.x; gy = p.y; }   // nose against a wall
    S.grenades.push({
      x: gx, y: gy,
      vx: Math.cos(a) * (6.5 + pitchBoost * 3), vy: Math.sin(a) * (6.5 + pitchBoost * 3),
      z: 0.45, vz: 1.7 + pitchBoost * 1.6, fuse: 1.7,
    });
  }

  function explode(x, y, radius, dmg, hurtsPlayer) {
    Sound.at('explosion', x, y, 1.6);
    S.shake = Math.max(S.shake, 16);
    Fx.burst(x, y, { count: 24, color: '#ffb347', speed: 3.4, life: 0.55, z: 0.3 });
    Fx.burst(x, y, { count: 14, color: '#ff5533', speed: 2.4, life: 0.45, z: 0.3 });
    Fx.burst(x, y, { count: 12, color: '#555', speed: 1.6, life: 0.9, z: 0.4, vz: 1.5 });
    let hits = 0;
    for (const e of S.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius) {
        const f = 1 - 0.7 * (d / radius);
        if (damageEnemy(e, dmg * f * (S.player.dmgBoost > 0 ? 2 : 1), d, { boom: true })) hits++;
      }
    }
    if (hits >= 2) medal('boom', x, y);
    if (hurtsPlayer) {
      const p = S.player;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius) damagePlayer(dmg * 0.35 * (1 - d / radius), x, y);
    }
  }

  // ------------------------------------------------------------ enemies
  function makeEnemy(typeName, x, y, elite = false) {
    const type = ENEMY_TYPES[typeName];
    const maxHp = type.hp * (type.boss ? 1 + S.wave * 0.07 : 1) * (elite ? 1.9 : 1);
    return {
      typeName, type, elite, x, y, hp: maxHp, maxHp,
      attackT: 0.6 + Math.random() * 0.5, windupT: 0, burstLeft: 0, flash: 0,
      animT: Math.random() * 10, dead: false, deadT: 0, pain: 0,
      token: false, wanderA: Math.random() * TAU,
      charging: 0, chargeCd: 0,
      stepT: Math.random(),
    };
  }

  function damageEnemy(e, dmg, distFromPlayer, info = {}) {
    if (e.dead) return false;
    if (e.elite && e.hp > e.maxHp * 0.5) {
      dmg *= 0.7;
      Sound.at('armorHit', e.x, e.y);
    }
    if (!info.boom && e.hp >= e.maxHp - 0.01 && dmg >= e.hp) info.oneHit = true;
    e.hp -= dmg;
    e.pain = 0.13;
    Fx.burst(e.x, e.y, { count: 3, color: '#d43a3a', speed: 1, life: 0.3, z: 0.45 });
    if (settings.dmgNumbers)
      Fx.floater(e.x, e.y, `${Math.round(dmg)}`, info.head ? '#ff5f5f' : '#fff',
        { size: info.head ? 0.85 : 0.65, life: 0.6, z: 2.0 });
    if (e.hp <= 0) {
      e.dead = true; e.deadT = 0;
      Sound.at('splat', e.x, e.y);
      onKill(e, distFromPlayer || 0, info);
      return true;
    }
    return false;
  }

  function medal(key, x, y) {
    const m = MEDALS[key];
    if (!m) return;
    const dup = S.medals.find(e => e.key === key);
    if (dup) {
      dup.t = dup.max;                       // refresh instead of stacking
      dup.count = (dup.count || 1) + 1;
      dup.label = `${m.label} ×${dup.count}`;
    } else {
      S.medals.unshift({ key, label: m.label, color: m.color, t: 2.2, max: 2.2 });
    }
    if (S.medals.length > 4) S.medals.pop();
    S.score += m.bonus; S.cash += m.bonus; S.xp += m.bonus;
    Sound.play('medal');
    if (x !== undefined) Fx.floater(x, y, m.label, m.color, { size: 0.8, life: 0.9, z: 1.5 });
  }

  function onKill(e, distFromPlayer, info = {}) {
    const p = S.player;
    S.kills++;
    S.streak++;
    S.multiplier = S.multTimer > 0 ? Math.min(5, S.multiplier + 0.25) : 1.25;
    S.multTimer = 4;

    award(e.type.score * (e.elite ? 1.5 : 1), e.x, e.y,
      `WASTED ${e.elite ? 'ELITE ' : ''}${e.type.label}`);

    // medals
    if (info.head) medal('headshot', e.x, e.y);
    if (distFromPlayer > 13) medal('longshot', e.x, e.y);
    if (distFromPlayer > 0 && distFromPlayer < 1.6 && !info.boom) medal('pointblank', e.x, e.y);
    if (info.oneHit) medal('onetap', e.x, e.y);
    if (p.slideT > 0) medal('slide', e.x, e.y);
    const now = S.time;
    S.killTimes.push(now);
    S.killTimes = S.killTimes.filter(t => now - t < 2.5);
    if (S.killTimes.length === 2) medal('double');
    else if (S.killTimes.length === 3) medal('triple');
    else if (S.killTimes.length >= 4) medal('quad');

    if (Math.random() < (info.head ? 0.65 : 0.45))
      Sound.say(pick(info.head ? lines().headshot : lines().kill), p.character);

    // drops
    const roll = Math.random();
    if (e.type.boss) { dropPickup(e.x, e.y, 'nachos'); dropPickup(e.x + 0.4, e.y, 'armor'); }
    else if (e.elite && roll < 0.5) dropPickup(e.x, e.y, 'armor');
    else if (roll < 0.13) dropPickup(e.x, e.y, 'nachos');
    else if (roll < 0.36) dropPickup(e.x, e.y, 'ammo');
    else if (roll < 0.43) dropPickup(e.x, e.y, 'grenade');
    if (e.type.boss) {
      S.boss = null;
      award(800, e.x, e.y, 'BOSS DOWN');
    }
    checkKillstreak();
  }

  let lastRank = '';
  function checkRank() {
    const r = rankFor(S.xp);
    if (lastRank && r !== lastRank) {
      Sound.play('rankUp');
      setAnnounce('RANK UP', r, 3);
    }
    lastRank = r;
  }

  function checkKillstreak() {
    const p = S.player;
    if (S.streak === 3 && S.streakFired < 3) {
      S.streakFired = 3;
      Sound.play('fanfare');
      setAnnounce('KILLSTREAK: NACHO RUSH', '+40 HEALTH · SPEED BOOST', 3);
      p.hp = Math.min(p.maxHp, p.hp + 40);
      p.speedBoost = 8;
      Sound.say(pick(lines().streak), p.character);
    } else if (S.streak === 5 && S.streakFired < 5) {
      S.streakFired = 5;
      Sound.play('fanfare');
      setAnnounce('KILLSTREAK: TP FOR THE BUNGHOLE', 'DOUBLE DAMAGE · +2 GRENADES', 3);
      p.grenades = Math.min(CONFIG.MAX_GRENADES, p.grenades + 2);
      p.dmgBoost = 10;
    } else if (S.streak >= 7 && S.streakFired < 7) {
      S.streakFired = 7;
      Sound.play('strike');
      setAnnounce('KILLSTREAK: AIR GUITAR STRIKE', 'TOTAL CARNAGE', 3);
      Sound.say(lines().cornholio, p.character, true);
      S.screenFlash = { color: '255,255,255', a: 0.9 };
      for (const e of S.enemies) {
        if (!e.dead && hasLOS(p.x, p.y, e.x, e.y)) {
          Fx.burst(e.x, e.y, { count: 16, color: '#aee7ff', speed: 2.6, life: 0.5, z: 0.5, vz: 2 });
          damageEnemy(e, 600, Math.hypot(e.x - p.x, e.y - p.y));
        }
      }
      S.streak = 0; S.streakFired = 0;    // the cycle re-arms
    }
  }

  // token assignment: only a few enemies may actively attack at once
  let tokenTimer = 0;
  function assignTokens() {
    const p = S.player;
    const melee = [], ranged = [];
    for (const e of S.enemies) {
      if (e.dead) continue;
      e.token = false;
      (e.type.token === 'melee' ? melee : ranged).push(e);
    }
    const byDist = arr => arr.sort((a, b) =>
      dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y));
    const nm = 2 + Math.floor(S.wave / 6), nr = 2 + Math.floor(S.wave / 8);
    byDist(melee).slice(0, nm).forEach(e => { e.token = true; });
    byDist(ranged).slice(0, nr).forEach(e => { e.token = true; });
    if (S.boss) S.boss.token = true;
  }

  let fieldTimer = 0;
  function updateEnemies(dt) {
    const p = S.player;
    fieldTimer -= dt;
    if (fieldTimer <= 0) { GameMap.computeField(p.x, p.y); fieldTimer = 0.4; }
    tokenTimer -= dt;
    if (tokenTimer <= 0) { assignTokens(); tokenTimer = 0.3; }

    for (const e of S.enemies) {
      if (e.dead) { e.deadT += dt; continue; }
      e.animT += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.pain = Math.max(0, e.pain - dt);
      e.chargeCd = Math.max(0, e.chargeCd - dt);
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      const los = d < 22 && hasLOS(e.x, e.y, p.x, p.y);
      const t = e.type;

      // audible approach
      e.stepT -= dt * (t.speed / 2);
      if (e.stepT <= 0 && d < 9) { Sound.at('stepEnemy', e.x, e.y, 0.5); e.stepT = 0.5; }

      if (e.windupT > 0) {
        e.windupT -= dt;
        if (e.windupT <= 0) enemyAttack(e);
        continue;
      }

      // coach charge
      if (t.charges && e.charging > 0) {
        e.charging -= dt;
        const md = Math.hypot(dx, dy) || 1;
        tryMove(e, e.x + (dx / md) * t.speed * 2.6 * dt, e.y + (dy / md) * t.speed * 2.6 * dt, 0.3);
        if (d < 1.1) {
          e.charging = 0; e.chargeCd = 2.4;
          damagePlayer(t.dmg, e.x, e.y);
          S.shake = Math.max(S.shake, 12);
        }
        continue;
      }
      if (t.charges && e.token && los && d > 2.5 && d < 9 && e.chargeCd <= 0) {
        e.charging = 1.4; e.flash = 0.4;
        Sound.at('enemyShotHeavy', e.x, e.y);
        continue;
      }

      const engage = e.token && los && d < t.range;
      if (engage) {
        e.attackT -= dt;
        if (e.attackT <= 0) {
          e.windupT = t.windup;
          e.flash = t.windup;
          e.attackT = t.rate;
          if (t.burst) e.burstLeft = t.burst;
        }
        const sa = Math.atan2(dy, dx) + Math.PI / 2;
        const wob = Math.sin(e.animT * 2.1) * 0.55;
        tryMove(e, e.x + Math.cos(sa) * wob * dt, e.y + Math.sin(sa) * wob * dt, 0.28);
      } else {
        let mx = 0, my = 0;
        const wantDist = e.token ? 0 : (t.token === 'ranged' ? 6 : 3.2);
        if (los && d < wantDist + 1 && !e.token) {
          // no token: orbit at standoff distance
          e.wanderA += dt * 0.8;
          const orbA = Math.atan2(dy, dx) + Math.PI / 2 + Math.sin(e.wanderA) * 0.6;
          mx = Math.cos(orbA); my = Math.sin(orbA);
          if (d < wantDist - 1.2) { mx -= dx / d * 0.8; my -= dy / d * 0.8; }
        } else if (los) {
          mx = dx / d; my = dy / d;
          if (t.erratic) {
            const zig = Math.sin(e.animT * 5.2) * 0.8;
            mx += -dy / d * zig; my += dx / d * zig;
          }
        } else {
          const cx = e.x | 0, cy = e.y | 0;
          let bd = GameMap.fieldAt(cx, cy), bx = cx, by = cy, fd;
          fd = GameMap.fieldAt(cx + 1, cy); if (fd < bd) { bd = fd; bx = cx + 1; by = cy; }
          fd = GameMap.fieldAt(cx - 1, cy); if (fd < bd) { bd = fd; bx = cx - 1; by = cy; }
          fd = GameMap.fieldAt(cx, cy + 1); if (fd < bd) { bd = fd; bx = cx; by = cy + 1; }
          fd = GameMap.fieldAt(cx, cy - 1); if (fd < bd) { bd = fd; bx = cx; by = cy - 1; }
          const tx = bx + 0.5, ty = by + 0.5;
          const md = Math.hypot(tx - e.x, ty - e.y) || 1;
          mx = (tx - e.x) / md; my = (ty - e.y) / md;
        }
        for (const o of S.enemies) {
          if (o === e || o.dead) continue;
          const ox = e.x - o.x, oy = e.y - o.y;
          const od = Math.hypot(ox, oy);
          if (od > 0.001 && od < 0.75) { mx += (ox / od) * 0.55; my += (oy / od) * 0.55; }
        }
        const mlen = Math.hypot(mx, my) || 1;
        const sp = t.speed * (1 + S.wave * 0.018);
        tryMove(e, e.x + (mx / mlen) * sp * dt, e.y + (my / mlen) * sp * dt, 0.28);
        e.attackT = Math.max(e.attackT - dt, 0.15);
      }
    }
    S.enemies = S.enemies.filter(e => !e.dead || e.deadT < 1.1);
  }

  function enemyAttack(e) {
    const p = S.player, t = e.type;
    if (t.melee) {
      const dNow = Math.hypot(p.x - e.x, p.y - e.y);
      if (dNow < t.range + 0.35) damagePlayer(t.dmg, e.x, e.y);
      return;
    }
    const shoot = () => {
      if (e.dead || S.mode !== 'playing') return;
      if (!hasLOS(e.x, e.y, p.x, p.y)) return;
      Sound.at(t.boss ? 'enemyShotHeavy' : 'enemyShot', e.x, e.y);
      e.flash = 0.08;
      const dd = Math.hypot(p.x - e.x, p.y - e.y);
      const speed = Math.hypot(p.vel.x, p.vel.y);
      let chance = 0.72 - dd * 0.035 - (speed > 2.5 ? 0.16 : 0)
        - (p.sprinting ? 0.08 : 0) - (p.slideT > 0 ? 0.22 : 0) - (p.crouching ? 0.08 : 0);
      if (Math.random() < clamp(chance, 0.07, 0.85)) damagePlayer(t.dmg, e.x, e.y);
      else if (Math.random() < 0.5) Sound.at('ricochet', p.x + (Math.random() - 0.5), p.y + (Math.random() - 0.5));
    };
    if (t.burst && e.burstLeft > 1) {
      const n = e.burstLeft;
      e.burstLeft = 0;
      let i = 0;
      const iv = setInterval(() => {
        shoot();
        if (++i >= n) clearInterval(iv);
      }, 130);
    } else shoot();
  }

  // ------------------------------------------------------------- player
  function damagePlayer(dmg, sx, sy) {
    if (S.mode !== 'playing') return;
    const p = S.player;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, dmg * 0.6);
      p.armor -= absorbed;
      dmg -= absorbed;
      Sound.play('armorHit');
    }
    p.hp -= dmg;
    p.lastHurt = S.time;
    if (settings.shake) S.shake = Math.max(S.shake, 6);
    Sound.play('hurt');
    S.hurtArcs.push({ angle: Math.atan2(sy - p.y, sx - p.x), t: 1.2 });
    if (Math.random() < 0.4) Sound.say(pick(lines().hurt), p.character);
    if (p.hp < 30 && S.streak > 0) {
      S.streak = 0; S.streakFired = 0;
      pushFeed('STREAK LOST');
    }
    if (p.hp <= 0) die();
  }

  function die() {
    S.mode = 'dead';
    document.exitPointerLock();
    Sound.music.setIntensity(0);
    Sound.say(pick(lines().death), S.player.character, true);
    store.bestScore = Math.max(store.bestScore || 0, S.score);
    store.bestWave = Math.max(store.bestWave || 0, S.wave);
    store.xp = (store.xp || 0) + S.xp;
    saveStore();
    UI.showDead({
      score: S.score, wave: S.wave, kills: S.kills, rank: rankFor(S.xp),
      bestScore: store.bestScore, bestWave: store.bestWave,
      careerRank: rankFor(store.xp || 0),
    });
  }

  function crouchPressed() {
    const p = S.player;
    if (p.sprinting && p.slideCd <= 0 && p.slideT <= 0) {
      // dodge-slide in the direction of travel (falls back to facing)
      p.slideT = CONFIG.SLIDE_TIME;
      p.slideCd = CONFIG.SLIDE_COOLDOWN;
      const vl = Math.hypot(p.vel.x, p.vel.y);
      if (vl > 0.1) { p.slideDx = p.vel.x / vl; p.slideDy = p.vel.y / vl; }
      else { p.slideDx = Math.cos(p.a); p.slideDy = Math.sin(p.a); }
      Sound.play('slide');
    } else {
      p.crouching = true;
    }
  }
  function crouchReleased() { S.player.crouching = false; }

  // fixed iso camera sits to the southeast: "up" on screen is this direction
  const CAM_A = -3 * Math.PI / 4;
  let stepTimer = 0;
  function updatePlayer(dt) {
    const p = S.player, sp = spec();

    // face the cursor (arrow keys still nudge aim as a trackpad fallback)
    p.adsT = clamp(p.adsT - dt * 7, 0, 1);
    const turn = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    if (turn) p.a = (p.a + turn * 2.6 * dt) % TAU;
    else if (S.cursor.seen) {
      const adx = S.aim.x - p.x, ady = S.aim.y - p.y;
      if (adx * adx + ady * ady > 0.01) p.a = Math.atan2(ady, adx);
    }
    p.swapT = Math.max(0, p.swapT - dt);
    p.slideCd = Math.max(0, p.slideCd - dt);

    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

    if (p.slideT > 0) {
      p.slideT -= dt;
      const f = p.slideT / CONFIG.SLIDE_TIME;
      const speed = CONFIG.SLIDE_SPEED * (0.35 + 0.65 * f);
      p.vel.x = p.slideDx * speed; p.vel.y = p.slideDy * speed;
      tryMove(p, p.x + p.vel.x * dt, p.y + p.vel.y * dt, CONFIG.PLAYER_RADIUS);
      p.sprinting = false;
    } else {
      p.sprinting = !!(keys.ShiftLeft || keys.ShiftRight) && (fwd !== 0 || strafe !== 0);
      let speed = CONFIG.BASE_SPEED;
      if (p.sprinting) speed *= CONFIG.SPRINT_MULT;
      if (p.crouching) speed *= CONFIG.CROUCH_MULT;
      if (p.speedBoost > 0) speed *= 1.3;
      // screen-relative movement under the fixed iso camera
      const ca = Math.cos(CAM_A), sa = Math.sin(CAM_A);
      let mx = ca * fwd - sa * strafe, my = sa * fwd + ca * strafe;
      const ml = Math.hypot(mx, my);
      if (ml > 0) {
        mx /= ml; my /= ml;
        p.vel.x = mx * speed; p.vel.y = my * speed;
        tryMove(p, p.x + p.vel.x * dt, p.y + p.vel.y * dt, CONFIG.PLAYER_RADIUS);
        p.bobPhase += dt * (p.sprinting ? 13 : p.crouching ? 6 : 9);
        p.bobMag = clamp(p.bobMag + dt * 6, 0, 1);
        stepTimer -= dt;
        if (stepTimer <= 0) {
          Sound.play('step');
          stepTimer = p.sprinting ? 0.28 : p.crouching ? 0.6 : 0.42;
        }
      } else {
        p.vel.x = p.vel.y = 0;
        p.bobMag = clamp(p.bobMag - dt * 6, 0, 1);
      }
    }

    // camera eye height + roll
    const targetEye = p.slideT > 0 ? 0.3 : p.crouching ? 0.36 : 0.5;
    p.eye += (targetEye - p.eye) * clamp(dt * 10, 0, 1);
    const targetRoll = p.slideT > 0 ? 0.06 : (strafe !== 0 && p.slideT <= 0 ? strafe * 0.012 : 0);
    p.roll += (targetRoll - p.roll) * clamp(dt * 8, 0, 1);

    // firing
    if (!S.shopOpen) {
      if (wantFire || (mouseDown && sp.auto)) fire();
    }
    wantFire = false;
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.recoil = Math.max(0, p.recoil - dt * 6);
    p.recoilPitch *= Math.pow(0.004, dt);

    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) {
        const need = sp.mag - p.ammo[p.weapon];
        const take = Math.min(need, p.reserve[p.weapon]);
        p.ammo[p.weapon] += take;
        p.reserve[p.weapon] -= take;
        Sound.play('reloadDone');
      }
    }

    const regenRate = CONFIG.REGEN_RATE * (chMod().regenMult || 1);
    if (S.time - p.lastHurt > CONFIG.REGEN_DELAY && p.hp < p.maxHp)
      p.hp = Math.min(p.maxHp, p.hp + regenRate * dt);

    p.speedBoost = Math.max(0, p.speedBoost - dt);
    p.dmgBoost = Math.max(0, p.dmgBoost - dt);

    for (const pk of S.pickups) {
      if (dist2(p.x, p.y, pk.x, pk.y) < 0.55 * 0.55) {
        pk.taken = true;
        Sound.play('pickup');
        if (pk.kind === 'ammo') {
          for (const wn of SLOT_ORDER) {
            if (!p.owned[wn]) continue;
            p.reserve[wn] = Math.min(WEAPONS[wn].maxReserve,
              p.reserve[wn] + Math.ceil(WEAPONS[wn].mag * 1.5));
          }
          pushFeed('PICKED UP AMMO');
        } else if (pk.kind === 'nachos') {
          p.hp = Math.min(p.maxHp, p.hp + 35);
          pushFeed('NACHOS +35 HP');
        } else if (pk.kind === 'armor') {
          p.armor = Math.min(CONFIG.MAX_ARMOR, p.armor + 50);
          pushFeed('+50 ARMOR');
        } else {
          p.grenades = Math.min(CONFIG.MAX_GRENADES, p.grenades + 1);
          pushFeed('+1 GRENADE');
        }
      }
    }
    S.pickups = S.pickups.filter(pk => !pk.taken);
  }

  // -------------------------------------------------------------- shop
  function shopItems() {
    const p = S.player;
    return SHOP.map(item => {
      if (item.type === 'weapon') {
        const w = WEAPONS[item.id];
        return {
          ...item, label: w.name, desc: `slot ${w.slot}`,
          price: w.price, owned: !!p.owned[item.id],
        };
      }
      if (item.type === 'perk') {
        const pk = PERKS[item.id];
        return { ...item, label: pk.label, desc: pk.desc, price: pk.price, owned: !!p.perks[item.id] };
      }
      return { ...item, owned: false };
    });
  }

  function toggleShop() {
    if (S.mode !== 'playing') return;
    if (!S.shopOpen && S.intermission <= 0) {
      pushFeed('SHOP OPENS BETWEEN WAVES');
      Sound.play('buyFail');
      return;
    }
    S.shopOpen = !S.shopOpen;
    mouseDown = false; wantFire = false;    // no shot on the closing click
    Sound.play('uiClick');
  }

  function buy(index) {
    const items = shopItems();
    const item = items[index];
    const p = S.player;
    if (!item) return;
    if (item.owned || S.cash < item.price) { Sound.play('buyFail'); return; }
    // don't charge for consumables that would do nothing
    if (item.type === 'nade' && p.grenades >= CONFIG.MAX_GRENADES) { Sound.play('buyFail'); return; }
    if (item.type === 'armor' && p.armor >= CONFIG.MAX_ARMOR) { Sound.play('buyFail'); return; }
    if (item.type === 'ammo' &&
        SLOT_ORDER.every(wn => !p.owned[wn] || p.reserve[wn] >= WEAPONS[wn].maxReserve)) {
      Sound.play('buyFail'); return;
    }
    S.cash -= item.price;
    Sound.play('buyOk');
    if (Math.random() < 0.4) Sound.say(pick(lines().buy), p.character);
    if (item.type === 'weapon') {
      p.owned[item.id] = true;
      p.ammo[item.id] = WEAPONS[item.id].mag;
      p.reserve[item.id] = Math.ceil(WEAPONS[item.id].maxReserve * 0.6);
      trySwitch(item.id);
      pushFeed(`BOUGHT ${WEAPONS[item.id].name}`);
    } else if (item.type === 'ammo') {
      for (const wn of SLOT_ORDER)
        if (p.owned[wn]) p.reserve[wn] = WEAPONS[wn].maxReserve;
      pushFeed('RESERVES FILLED');
    } else if (item.type === 'armor') {
      p.armor = CONFIG.MAX_ARMOR;
      pushFeed('ARMOR PLATED');
    } else if (item.type === 'nade') {
      p.grenades = Math.min(CONFIG.MAX_GRENADES, p.grenades + 2);
      pushFeed('+2 GRENADES');
    } else if (item.type === 'perk') {
      p.perks[item.id] = true;
      if (item.id === 'nacho') { p.maxHp += 50; p.hp += 50; }
      pushFeed(`PERK: ${PERKS[item.id].label}`);
    }
  }

  // ------------------------------------------------------- waves & drops
  function waveMix() {
    let mix = WAVE_MIX[0].mix;
    for (const band of WAVE_MIX) if (S.wave >= band.from) mix = band.mix;
    return mix;
  }
  function pickEnemyType() {
    const mix = waveMix();
    let r = Math.random(), acc = 0;
    for (const [k, w] of Object.entries(mix)) {
      acc += w;
      if (r <= acc) return k;
    }
    return Object.keys(mix)[0];
  }

  function startWave(n) {
    S.wave = n;
    S.toSpawn = 5 + n * 3;
    S.spawnTimer = 1;
    S.shopOpen = false;
    const boss = n % 5 === 0;
    setAnnounce(`WAVE ${n}`, boss ? 'THE PRINCIPAL IS COMING' : `${S.toSpawn} DIPWADS INBOUND`);
    Sound.play('waveHorn');
    Sound.say(boss ? pick(lines().boss) : pick(lines().wave), S.player.character);
    if (boss) {
      const s = farSpawn();
      const b = makeEnemy('principal', s.x, s.y);
      S.enemies.push(b);
      S.boss = b;
    }
  }

  function farSpawn() {
    const p = S.player;
    let best = GameMap.spawns[0], bd = -1;
    for (const s of GameMap.spawns) {
      const d = dist2(s.x, s.y, p.x, p.y);
      if (d > bd) { bd = d; best = s; }
    }
    return Math.random() < 0.35 ? pick(GameMap.spawns) : best;
  }

  function updateWave(dt) {
    if (S.intermission > 0) {
      S.intermission -= dt;
      if (S.intermission <= 0) startWave(S.wave + 1);
      return;
    }
    if (S.toSpawn > 0) {
      S.spawnTimer -= dt;
      const aliveCap = Math.min(10 + S.wave, 24);
      if (S.spawnTimer <= 0 && countAlive() < aliveCap) {
        S.spawnTimer = Math.max(0.4, 1.4 - S.wave * 0.05);
        S.toSpawn--;
        let s = pick(GameMap.spawns);
        if (dist2(s.x, s.y, S.player.x, S.player.y) < 36) s = farSpawn();
        const elite = S.wave >= ELITE_FROM_WAVE && Math.random() < ELITE_CHANCE;
        const typeName = pickEnemyType();
        S.enemies.push(makeEnemy(typeName,
          s.x + (Math.random() - 0.5) * 0.4, s.y + (Math.random() - 0.5) * 0.4,
          elite && Textures.enemySpritesElite[typeName] !== undefined));
      }
    } else if (S.enemies.every(e => e.dead)) {
      S.intermission = 12;
      S.player.grenades = Math.min(CONFIG.MAX_GRENADES, S.player.grenades + 1);
      const bonus = 100 * S.wave;
      S.score += bonus; S.cash += bonus; S.xp += bonus;
      setAnnounce('WAVE CLEARED', `+$${bonus} · PRESS TAB TO SHOP`, 4);
      Sound.play('fanfare');
    }
  }

  function dropPickup(x, y, kind) {
    S.pickups.push({ x, y, kind, taken: false, bob: Math.random() * TAU });
  }

  function updateGrenades(dt) {
    for (const n of S.grenades) {
      n.fuse -= dt;
      const nx = n.x + n.vx * dt, ny = n.y + n.vy * dt;
      if (GameMap.solidAt(nx, n.y)) { n.vx *= -0.45; Sound.at('bounce', n.x, n.y); } else n.x = nx;
      if (GameMap.solidAt(n.x, ny)) { n.vy *= -0.45; Sound.at('bounce', n.x, n.y); } else n.y = ny;
      n.vz -= 5 * dt;
      n.z += n.vz * dt;
      if (n.z <= 0.06) {
        n.z = 0.06;
        if (Math.abs(n.vz) > 0.4) Sound.at('bounce', n.x, n.y);
        n.vz = -n.vz * 0.4;
        n.vx *= 0.75; n.vy *= 0.75;
      }
      if (n.fuse <= 0) { n.boom = true; explode(n.x, n.y, 2.4, 175, true); }
    }
    S.grenades = S.grenades.filter(n => !n.boom);
  }

  function countAlive() {
    let n = 0;
    for (const e of S.enemies) if (!e.dead) n++;
    return n;
  }

  // -------------------------------------------------------------- loop
  function update(dt) {
    S.time += dt;

    // project the cursor onto the ground so the hero can face/shoot at it
    if (S.cursor.seen && !S.aimLocked) {
      const ap = Renderer.aimPoint(S.cursor.sx, S.cursor.sy);
      if (ap) { S.aim.x = ap.x; S.aim.y = ap.y; }
    }

    Sound.listener(S.player.x, S.player.y, S.player.a);
    S.aliveCount = countAlive();
    Sound.music.setIntensity(clamp(S.aliveCount / 10 + (S.boss ? 0.35 : 0), 0.15, 1));

    if (!S.shopOpen) {
      updatePlayer(dt);
      updateEnemies(dt);
      updateGrenades(dt);
      Fx.update(dt);
      updateWave(dt);
    } else {
      // world holds its breath while shopping, but timers stay honest
      S.intermission = Math.max(0.5, S.intermission - dt * 0.25);
      Fx.update(dt * 0.2);
    }

    S.hitmarker = Math.max(0, S.hitmarker - dt);
    S.shake = Math.max(0, S.shake - dt * 40);
    S.flash = Math.max(0, S.flash - dt);
    S.multTimer = Math.max(0, S.multTimer - dt);
    if (S.multTimer <= 0) S.multiplier = 1;
    if (S.announce) {
      S.announce.t -= dt;
      if (S.announce.t <= 0) {
        S.announce = null;
        const next = announceQueue.shift();
        if (next) S.announce = { big: next.big, small: next.small, t: next.dur, max: next.dur };
      }
    }
    for (const f of S.feed) f.t -= dt;
    S.feed = S.feed.filter(f => f.t > 0);
    for (const m of S.medals) m.t -= dt;
    S.medals = S.medals.filter(m => m.t > 0);
    for (const a of S.hurtArcs) a.t -= dt;
    S.hurtArcs = S.hurtArcs.filter(a => a.t > 0);
    if (S.screenFlash) { S.screenFlash.a -= dt * 1.6; if (S.screenFlash.a <= 0) S.screenFlash = null; }
  }

  function updateAttract(dt) {
    // slow drift around the gym behind the menu (path stays clear of walls)
    const at = S.attract;
    at.a += dt * 0.12;
    at.x = 17.5 + Math.cos(at.a * 0.7) * 3.4;
    at.y = 11.5 + Math.sin(at.a * 0.4) * 1.7;
  }

  // ------------------------------------------------------------ control
  function start(character) {
    store.character = character;
    saveStore();
    Sound.unlock();
    if (settings.music) Sound.music.start();

    S.player = freshPlayer(character);
    const p = S.player;
    for (const wn of SLOT_ORDER) {
      p.ammo[wn] = WEAPONS[wn].mag;
      p.reserve[wn] = Math.ceil(WEAPONS[wn].maxReserve / 2);
    }
    S.enemies = []; S.grenades = []; S.pickups = [];
    S.feed = []; S.medals = []; S.hurtArcs = []; S.killTimes = [];
    S.score = 0; S.cash = DEBUG ? 20000 : 0; S.xp = 0; S.kills = 0;
    S.streak = 0; S.streakFired = 0;
    S.multiplier = 1; S.multTimer = 0; S.intermission = 0; S.time = 0;
    S.hitmarker = 0; S.shake = 0; S.flash = 0; S.screenFlash = null;
    S.announce = null; S.boss = null; S.shopOpen = false;
    announceQueue.length = 0;
    Fx.reset();
    lastRank = rankFor(0);

    Renderer.onRunStart(character);

    S.mode = 'playing';
    lockPointer();
    startWave(1);
  }

  function pause() {
    if (S.mode !== 'playing') return;
    S.mode = 'paused';
    S.shopOpen = false;
    document.exitPointerLock();
    UI.showPause();
  }
  function resume() {
    if (S.mode !== 'paused') return;
    S.mode = 'playing';
    lockPointer();
  }
  function quitToMenu() {
    S.mode = 'menu';
    Sound.music.setIntensity(0.15);
    Fx.reset();
    document.exitPointerLock();
    UI.showMenu();
  }

  const api = {
    S, settings, saveSettings, castRay,
    start, pause, resume, quitToMenu,
    restart: () => start(S.player ? S.player.character : savedCharacter()),
    update, updateAttract,
    buy, toggleShop, shopItems,
    rankFor, nextRank,
    savedCharacter, stats,
    debug: () => ({
      mode: S.mode, score: S.score, cash: S.cash, kills: S.kills, wave: S.wave,
      hp: S.player ? Math.round(S.player.hp) : 0,
      armor: S.player ? Math.round(S.player.armor) : 0,
      alive: S.enemies.filter(e => !e.dead).length,
      toSpawn: S.toSpawn,
      weapon: S.player ? S.player.weapon : null,
      owned: S.player ? Object.keys(S.player.owned) : [],
      intermission: Math.round(S.intermission * 10) / 10,
      shopOpen: S.shopOpen,
    }),
  };
  function savedCharacter() { return store.character || 'butthead'; }
  function stats() {
    return {
      bestScore: store.bestScore || 0,
      bestWave: store.bestWave || 0,
      careerRank: rankFor(store.xp || 0),
    };
  }
  if (DEBUG) {
    api.cheat = {
      cash: (n = 20000) => { S.cash += n; },
      god: () => { S.player.hp = 99999; S.player.maxHp = 99999; },
      wave: n => { S.enemies = []; S.toSpawn = 0; S.boss = null; S.intermission = 0; startWave(n); },
      give: w => { S.player.owned[w] = true; S.player.ammo[w] = WEAPONS[w].mag; S.player.reserve[w] = WEAPONS[w].maxReserve; },
      spawn: (t, x, y, elite = false) => { const e = makeEnemy(t, x, y, elite); S.enemies.push(e); return e; },
      aimAt: (x, y) => { S.aim.x = x; S.aim.y = y; S.cursor.seen = true; S.aimLocked = true; },
      intermission: () => { S.enemies = []; S.toSpawn = 0; S.boss = null; S.intermission = 60; },
      nuke: () => {
        S.toSpawn = 0;
        for (const e of S.enemies) if (!e.dead) damageEnemy(e, 1e6, 5);
      },
    };
  }
  return api;
})();
