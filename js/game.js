// Beavis & Butt-Head Shooter — a COD-flavored wave shooter on a raycasting engine.
const Game = (() => {
  const canvas = document.getElementById('game');
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const COLW = 2, RAYS = W / COLW;
  const zbuf = new Float32Array(RAYS);
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------ tuning
  const BASE_FOV = 68 * Math.PI / 180;
  const ADS_FOV = 46 * Math.PI / 180;
  const SPRINT_FOV = 76 * Math.PI / 180;
  const MOUSE_SENS = 0.0022;
  const PLAYER_RADIUS = 0.22;
  const REGEN_DELAY = 4.0, REGEN_RATE = 28;

  const WEAPONS = {
    pistol: {
      name: 'BURRITO BLASTER 9', slot: 1, auto: false, pellets: 1,
      dmg: 35, rof: 0.26, mag: 12, maxReserve: 96, reload: 1.1,
      spread: 0.02, adsSpread: 0.004, kick: 14,
      falloffStart: 10, falloffEnd: 22, minDmgMult: 0.5,
      sfx: () => Sound.shotPistol(),
    },
    rifle: {
      name: 'TURBO THRASHER AK', slot: 2, auto: true, pellets: 1,
      dmg: 24, rof: 0.105, mag: 30, maxReserve: 180, reload: 1.9,
      spread: 0.035, adsSpread: 0.011, kick: 8,
      falloffStart: 12, falloffEnd: 26, minDmgMult: 0.55,
      sfx: () => Sound.shotRifle(),
    },
    shotgun: {
      name: 'NACHO BOOMSTICK', slot: 3, auto: false, pellets: 8,
      dmg: 13, rof: 0.95, mag: 6, maxReserve: 42, reload: 2.3,
      spread: 0.09, adsSpread: 0.055, kick: 30,
      falloffStart: 4, falloffEnd: 9, minDmgMult: 0.15,
      sfx: () => Sound.shotShotgun(),
    },
  };
  const SLOT_ORDER = ['pistol', 'rifle', 'shotgun'];

  const ENEMY_TYPES = {
    poser:     { hp: 60,  speed: 2.5, dmg: 14, rate: 0.9, range: 1.1,  windup: 0.35,
                 score: 100, melee: true,  scale: 1.0,  label: 'POSER' },
    jock:      { hp: 95,  speed: 1.7, dmg: 9,  rate: 1.3, range: 9,    windup: 0.5,
                 score: 150, melee: false, scale: 1.0,  label: 'JOCK' },
    monitor:   { hp: 130, speed: 1.45, dmg: 6, rate: 1.7, range: 11,   windup: 0.55,
                 score: 200, melee: false, burst: 3, scale: 1.05, label: 'HALL MONITOR' },
    principal: { hp: 950, speed: 1.25, dmg: 9, rate: 1.5, range: 8,    windup: 0.6,
                 score: 1000, melee: false, burst: 4, scale: 1.35, boss: true,
                 label: 'PRINCIPAL McDOOM' },
  };

  const RANKS = [
    [0,     'PRIVATE BUTTMUNCH'],
    [500,   'CORPORAL DILLWEED'],
    [1200,  'SERGEANT DOOFUS'],
    [2500,  'STAFF SGT. FARTKNOCKER'],
    [4200,  'LIEUTENANT WANNABE'],
    [6500,  'CAPTAIN SEMI-COOL'],
    [9500,  'MAJOR METALHEAD'],
    [13500, 'COLONEL ULTRA-COOL'],
    [18500, 'GENERAL OF NACHOS'],
    [25000, 'THE GREAT CORNHOLIO'],
  ];

  const LINES = {
    beavis: {
      kill:   ['Heh heh, yes!', 'Fire! Fire!', 'That was cool!', 'Take that, dillweed!'],
      streak: ['Heh heh heh, I am unstoppable!', 'This is the greatest day of my life!'],
      cornholio: 'I am the Great Cornholio!',
      hurt:   ['Ow! Cut it out, butthole!', 'That sucked!'],
      wave:   ['Heh heh, here they come.', 'This is gonna be cool.'],
      death:  ['This sucks more than anything has ever sucked.'],
      boss:   ['Whoa! The principal! Run!'],
    },
    butthead: {
      kill:   ['Uh huh huh, cool.', 'Nice one.', 'That was cool.', 'Whoa. Heh heh.'],
      streak: ['I am like, a war hero or something.', 'This is the coolest thing I have ever seen.'],
      cornholio: 'Uh huh huh. Carnage.',
      hurt:   ['Hey! Watch it, buttmunch.', 'Uh, ow.'],
      wave:   ['Uh huh huh, more of these guys.', 'Come to Butt-Head.'],
      death:  ['Uh... this sucks. Huh huh.'],
      boss:   ['Whoa, the principal. Not cool.'],
    },
  };

  // ------------------------------------------------------------- state
  let mode = 'menu';           // menu | playing | paused | dead
  let last = 0, time = 0;

  const player = {
    x: 0, y: 0, a: 0, pitch: 0, recoilPitch: 0,
    hp: 100, lastHurt: -99,
    weapon: 'rifle', ammo: {}, reserve: {}, reloading: 0,
    grenades: 3, fireCooldown: 0, adsT: 0, sprinting: false,
    bobPhase: 0, bobMag: 0, recoil: 0, character: 'butthead',
    speedBoost: 0, dmgBoost: 0,
  };

  let enemies = [], grenades = [], particles = [], pickupsList = [], feed = [], hurtArcs = [];
  let wave = 0, remainingToSpawn = 0, spawnTimer = 0, intermission = 0;
  let score = 0, xp = 0, kills = 0, streak = 0, streakFired = 0;
  let multiplier = 1, multTimer = 0;
  let hitmarker = 0, hitmarkerKill = false, shake = 0, flash = 0, screenFlash = null;
  let announce = null; // {big, small, t}
  let viewmodels = null, portraitCanvas = null, portraitHurt = null;
  let velX = 0, velY = 0, fieldTimer = 0, stepTimer = 0;

  const store = (() => {
    try { return JSON.parse(localStorage.getItem('bbshooter') || '{}'); }
    catch (e) { return {}; }
  })();
  function saveStore() {
    try { localStorage.setItem('bbshooter', JSON.stringify(store)); } catch (e) {}
  }

  // ------------------------------------------------------------- input
  const keys = {};
  let mouseDown = false, mouseRight = false, wantFire = false;

  function lockPointer() {
    // returns a promise in newer browsers; a rejection (headless, iframe
    // policies) must not surface as an error
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* pointer lock unavailable; game still runs */ }
  }

  document.addEventListener('keydown', e => {
    if (mode === 'menu') return;
    keys[e.code] = true;
    if (mode === 'playing') {
      if (e.code === 'KeyR') startReload();
      if (e.code === 'KeyG') throwGrenade();
      if (e.code === 'Digit1') switchWeapon('pistol');
      if (e.code === 'Digit2') switchWeapon('rifle');
      if (e.code === 'Digit3') switchWeapon('shotgun');
      if (e.code === 'KeyM') { Sound.state.sfx = !Sound.state.sfx; pushFeed(Sound.state.sfx ? 'SFX ON' : 'SFX OFF'); }
      if (e.code === 'KeyV') { Sound.state.voice = !Sound.state.voice; pushFeed(Sound.state.voice ? 'VOICE ON' : 'VOICE OFF'); }
      if (e.code === 'KeyP') pause();
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) e.preventDefault();
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  canvas.addEventListener('mousedown', e => {
    if (mode === 'playing' && document.pointerLockElement !== canvas) {
      lockPointer();
      return;
    }
    if (e.button === 0) { mouseDown = true; wantFire = true; }
    if (e.button === 2) mouseRight = true;
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 0) mouseDown = false;
    if (e.button === 2) mouseRight = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('mousemove', e => {
    if (mode !== 'playing' || document.pointerLockElement !== canvas) return;
    const sens = MOUSE_SENS * (player.adsT > 0.5 ? 0.6 : 1);
    player.a = (player.a + e.movementX * sens) % TAU;
    player.pitch = Math.max(-150, Math.min(150, player.pitch - e.movementY * 0.35));
  });
  canvas.addEventListener('wheel', e => {
    if (mode !== 'playing') return;
    e.preventDefault();
    const i = SLOT_ORDER.indexOf(player.weapon);
    const n = (i + (e.deltaY > 0 ? 1 : SLOT_ORDER.length - 1)) % SLOT_ORDER.length;
    switchWeapon(SLOT_ORDER[n]);
  }, { passive: false });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && mode === 'playing') pause();
  });

  // ------------------------------------------------------------ helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
  const lines = () => LINES[player.character];
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  function castRay(px, py, dx, dy) {
    // DDA against the grid; returns perpendicular distance + hit info.
    let mapX = px | 0, mapY = py | 0;
    const deltaX = Math.abs(1 / (dx || 1e-9)), deltaY = Math.abs(1 / (dy || 1e-9));
    let stepX, stepY, sideX, sideY;
    if (dx < 0) { stepX = -1; sideX = (px - mapX) * deltaX; }
    else { stepX = 1; sideX = (mapX + 1 - px) * deltaX; }
    if (dy < 0) { stepY = -1; sideY = (py - mapY) * deltaY; }
    else { stepY = 1; sideY = (mapY + 1 - py) * deltaY; }
    let side = 0, tile = 1;
    for (let i = 0; i < 128; i++) {
      if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
      else { sideY += deltaY; mapY += stepY; side = 1; }
      tile = GameMap.tileAt(mapX, mapY);
      if (tile > 0) break;
    }
    const dist = side === 0 ? sideX - deltaX : sideY - deltaY;
    let wallX = side === 0 ? py + dist * dy : px + dist * dx;
    wallX -= wallX | 0;
    return { dist, side, tile, wallX };
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
    // axis-separated slide against the grid
    if (!circleHitsWall(nx, ent.y, r)) ent.x = nx;
    if (!circleHitsWall(ent.x, ny, r)) ent.y = ny;
  }

  function pushFeed(text) {
    feed.unshift({ text, t: 5 });
    if (feed.length > 6) feed.pop();
  }
  function setAnnounce(big, small, dur = 2.6) { announce = { big, small, t: dur }; }

  function rankFor(xpVal) {
    let r = RANKS[0];
    for (const entry of RANKS) if (xpVal >= entry[0]) r = entry;
    return r[1];
  }

  // ------------------------------------------------------------ weapons
  function switchWeapon(w) {
    if (player.weapon === w || player.reloading > 0) return;
    player.weapon = w;
    player.fireCooldown = Math.max(player.fireCooldown, 0.25);
    Sound.reload();
  }

  function startReload() {
    const spec = WEAPONS[player.weapon];
    if (player.reloading > 0 || player.ammo[player.weapon] >= spec.mag) return;
    if (player.reserve[player.weapon] <= 0) { Sound.dryFire(); return; }
    player.reloading = spec.reload;
    Sound.reload();
  }

  function currentSpread() {
    const spec = WEAPONS[player.weapon];
    let s = spec.spread + (spec.adsSpread - spec.spread) * player.adsT;
    if (player.sprinting) s *= 2.2;
    return s;
  }

  function fire() {
    const spec = WEAPONS[player.weapon];
    if (player.reloading > 0 || player.fireCooldown > 0) return;
    if (player.sprinting) player.sprinting = false;
    if (player.ammo[player.weapon] <= 0) {
      Sound.dryFire();
      player.fireCooldown = 0.25;
      startReload();
      return;
    }
    player.ammo[player.weapon]--;
    player.fireCooldown = spec.rof;
    player.recoil = 1;
    player.recoilPitch = Math.min(70, player.recoilPitch + spec.kick * (0.6 + Math.random() * 0.6));
    player.a += (Math.random() - 0.5) * 0.004;
    shake = Math.max(shake, spec.pellets > 1 ? 7 : 3);
    flash = 0.07;
    spec.sfx();

    const spread = currentSpread();
    let hitAny = false, killedAny = false;
    for (let p = 0; p < spec.pellets; p++) {
      const a = player.a + (Math.random() - 0.5) * 2 * spread;
      const dx = Math.cos(a), dy = Math.sin(a);
      const wall = castRay(player.x, player.y, dx, dy);
      // nearest enemy under this pellet
      let best = null, bestT = wall.dist;
      for (const e of enemies) {
        if (e.dead) continue;
        const relX = e.x - player.x, relY = e.y - player.y;
        const t = relX * dx + relY * dy;
        if (t <= 0 || t >= bestT) continue;
        const perp = Math.abs(relX * dy - relY * dx);
        if (perp < 0.36 * e.type.scale) { best = e; bestT = t; }
      }
      if (best) {
        hitAny = true;
        let dmg = spec.dmg;
        if (bestT > spec.falloffStart) {
          const f = clamp(1 - (bestT - spec.falloffStart) / (spec.falloffEnd - spec.falloffStart),
            spec.minDmgMult, 1);
          dmg *= f;
        }
        if (player.dmgBoost > 0) dmg *= 2;
        if (damageEnemy(best, dmg, bestT)) killedAny = true;
      } else {
        // wall dust
        spawnParticles(player.x + dx * (wall.dist - 0.05), player.y + dy * (wall.dist - 0.05),
          3, '#c9b79a', 0.5, 0.25);
      }
    }
    if (hitAny) {
      hitmarker = 0.14; hitmarkerKill = killedAny;
      killedAny ? Sound.killmarker() : Sound.hitmarker();
    }
    if (player.ammo[player.weapon] === 0) startReload();
  }

  function throwGrenade() {
    if (mode !== 'playing' || player.grenades <= 0 || player.reloading > 0) return;
    player.grenades--;
    Sound.throwPin();
    const a = player.a;
    grenades.push({
      x: player.x + Math.cos(a) * 0.4, y: player.y + Math.sin(a) * 0.4,
      vx: Math.cos(a) * 7, vy: Math.sin(a) * 7,
      z: 0.4, vz: 1.6, fuse: 1.7,
    });
  }

  function explode(x, y, radius, dmg, hurtsPlayer) {
    Sound.explosion();
    shake = Math.max(shake, 16);
    spawnParticles(x, y, 26, '#ffb347', 3.2, 0.6);
    spawnParticles(x, y, 14, '#ff5533', 2.4, 0.5);
    spawnParticles(x, y, 10, '#555', 1.6, 0.9);
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius) {
        const f = 1 - 0.7 * (d / radius);
        damageEnemy(e, dmg * f * (player.dmgBoost > 0 ? 2 : 1), d);
      }
    }
    if (hurtsPlayer) {
      const d = Math.hypot(player.x - x, player.y - y);
      if (d < radius) damagePlayer(dmg * 0.4 * (1 - d / radius), x, y);
    }
  }

  // ------------------------------------------------------------ enemies
  function makeEnemy(typeName, x, y) {
    const type = ENEMY_TYPES[typeName];
    const maxHp = type.hp * (type.boss ? 1 + wave * 0.06 : 1);
    return {
      typeName, type, x, y, hp: maxHp, maxHp,
      attackT: 0.5, windupT: 0, burstLeft: 0, flash: 0,
      animT: Math.random() * 10, dead: false, deadT: 0, pain: 0,
    };
  }

  function damageEnemy(e, dmg, distFromPlayer) {
    if (e.dead) return false;
    e.hp -= dmg;
    e.pain = 0.12;
    spawnParticles(e.x, e.y, 3, '#d43a3a', 0.9, 0.3);
    if (e.hp <= 0) {
      e.dead = true; e.deadT = 0;
      Sound.splat();
      onKill(e, distFromPlayer || 0);
      return true;
    }
    return false;
  }

  function onKill(e, distFromPlayer) {
    kills++; streak++;
    multiplier = multTimer > 0 ? Math.min(5, multiplier + 0.25) : 1.25;
    multTimer = 4;
    let pts = Math.round(e.type.score * multiplier);
    let tag = '';
    if (distFromPlayer > 12) { pts += 50; tag = ' · LONGSHOT +50'; }
    score += pts; xp += pts;
    pushFeed(`WASTED ${e.type.label}  +${pts}${tag}`);
    if (Math.random() < 0.5) Sound.say(pick(lines().kill), player.character);

    // drops
    const roll = Math.random();
    if (e.type.boss || roll < 0.16) dropPickup(e.x, e.y, 'nachos');
    else if (roll < 0.44) dropPickup(e.x, e.y, 'ammo');
    else if (roll < 0.52) dropPickup(e.x, e.y, 'grenade');
    if (e.type.boss) { score += 500; xp += 500; pushFeed('BOSS DOWN +500'); }

    checkRank();
    checkKillstreak();
  }

  let lastRank = '';
  function checkRank() {
    const r = rankFor(xp);
    if (lastRank && r !== lastRank) {
      Sound.rankUp();
      setAnnounce('RANK UP', r, 3);
    }
    lastRank = r;
  }

  function checkKillstreak() {
    if (streak === 3 && streakFired < 3) {
      streakFired = 3;
      Sound.fanfare();
      setAnnounce('KILLSTREAK: NACHO RUSH', '+40 HEALTH · SPEED BOOST', 3);
      player.hp = Math.min(100, player.hp + 40);
      player.speedBoost = 8;
      Sound.say(pick(lines().streak), player.character);
    } else if (streak === 5 && streakFired < 5) {
      streakFired = 5;
      Sound.fanfare();
      setAnnounce('KILLSTREAK: TP FOR THE BUNGHOLE', 'DOUBLE DAMAGE · +2 GRENADES', 3);
      player.grenades = Math.min(6, player.grenades + 2);
      player.dmgBoost = 10;
    } else if (streak >= 7 && streakFired < 7) {
      streakFired = 7;
      Sound.strike();
      setAnnounce('KILLSTREAK: AIR GUITAR STRIKE', 'TOTAL CARNAGE', 3);
      Sound.say(lines().cornholio, player.character, true);
      screenFlash = { color: '255,255,255', a: 0.9 };
      for (const e of enemies) {
        if (!e.dead && hasLOS(player.x, player.y, e.x, e.y)) {
          spawnParticles(e.x, e.y, 16, '#aee7ff', 2.5, 0.5);
          damageEnemy(e, 500, Math.hypot(e.x - player.x, e.y - player.y));
        }
      }
      // the cycle re-arms so streaks stay earnable all run
      streak = 0; streakFired = 0;
    }
  }

  function updateEnemies(dt) {
    // shared flow field toward the player
    fieldTimer -= dt;
    if (fieldTimer <= 0) { GameMap.computeField(player.x, player.y); fieldTimer = 0.4; }

    for (const e of enemies) {
      if (e.dead) { e.deadT += dt; continue; }
      e.animT += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.pain = Math.max(0, e.pain - dt);
      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.hypot(dx, dy);
      const los = d < 20 && hasLOS(e.x, e.y, player.x, player.y);
      const t = e.type;

      if (e.windupT > 0) {
        e.windupT -= dt;
        if (e.windupT <= 0) enemyAttack(e);
        continue; // stands still while telegraphing
      }

      if (los && d < t.range) {
        e.attackT -= dt;
        if (e.attackT <= 0) {
          e.windupT = t.windup;
          e.flash = t.windup;
          e.attackT = t.rate;
          if (t.burst) e.burstLeft = t.burst;
        }
        // light strafe so they aren't statues
        const sa = Math.atan2(dy, dx) + Math.PI / 2;
        const wob = Math.sin(e.animT * 2.1) * 0.5;
        tryMove(e, e.x + Math.cos(sa) * wob * dt, e.y + Math.sin(sa) * wob * dt, 0.28);
      } else {
        // walk downhill on the flow field
        let mx = 0, my = 0;
        if (los) { mx = dx / d; my = dy / d; }
        else {
          const cx = e.x | 0, cy = e.y | 0;
          let bd = GameMap.fieldAt(cx, cy), bx = cx, by = cy;
          for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
            const fd = GameMap.fieldAt(nx, ny);
            if (fd < bd) { bd = fd; bx = nx; by = ny; }
          }
          const tx = bx + 0.5, ty = by + 0.5;
          const md = Math.hypot(tx - e.x, ty - e.y) || 1;
          mx = (tx - e.x) / md; my = (ty - e.y) / md;
        }
        // separation from buddies
        for (const o of enemies) {
          if (o === e || o.dead) continue;
          const ox = e.x - o.x, oy = e.y - o.y;
          const od = Math.hypot(ox, oy);
          if (od > 0.001 && od < 0.7) { mx += (ox / od) * 0.5; my += (oy / od) * 0.5; }
        }
        const mlen = Math.hypot(mx, my) || 1;
        const sp = t.speed * (1 + wave * 0.02);
        tryMove(e, e.x + (mx / mlen) * sp * dt, e.y + (my / mlen) * sp * dt, 0.28);
        e.attackT = Math.max(e.attackT - dt, 0.15);
      }
    }
    // clear finished corpses
    enemies = enemies.filter(e => !e.dead || e.deadT < 0.6);
  }

  function enemyAttack(e) {
    const t = e.type;
    if (t.melee) {
      const dNow = Math.hypot(player.x - e.x, player.y - e.y);
      if (dNow < t.range + 0.3) damagePlayer(t.dmg, e.x, e.y);
      return;
    }
    const shoot = () => {
      if (e.dead || mode !== 'playing') return;
      if (!hasLOS(e.x, e.y, player.x, player.y)) return;
      Sound.enemyShot();
      e.flash = 0.08;
      const dd = Math.hypot(player.x - e.x, player.y - e.y);
      const moving = Math.hypot(velX, velY) > 2.5;
      const chance = 0.75 - dd * 0.035 - (moving ? 0.18 : 0) - (player.sprinting ? 0.1 : 0);
      if (Math.random() < clamp(chance, 0.08, 0.85)) damagePlayer(t.dmg, e.x, e.y);
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
    if (mode !== 'playing') return;
    player.hp -= dmg;
    player.lastHurt = time;
    shake = Math.max(shake, 6);
    Sound.hurt();
    hurtArcs.push({ angle: Math.atan2(sy - player.y, sx - player.x), t: 1.2 });
    if (Math.random() < 0.4) Sound.say(pick(lines().hurt), player.character);
    if (player.hp < 30 && streak > 0) {
      streak = 0; streakFired = 0;
      pushFeed('STREAK LOST');
    }
    if (player.hp <= 0) die();
  }

  function die() {
    mode = 'dead';
    document.exitPointerLock();
    Sound.say(pick(lines().death), player.character, true);
    store.bestScore = Math.max(store.bestScore || 0, score);
    store.bestWave = Math.max(store.bestWave || 0, wave);
    store.xp = (store.xp || 0) + xp;
    saveStore();
    UI.showDead({
      score, wave, kills, rank: rankFor(xp),
      bestScore: store.bestScore, bestWave: store.bestWave,
      careerRank: rankFor(store.xp || 0),
    });
  }

  function updatePlayer(dt) {
    const spec = WEAPONS[player.weapon];

    // aim-down-sights
    const wantAds = mouseRight && !player.sprinting && player.reloading <= 0;
    player.adsT = clamp(player.adsT + (wantAds ? dt * 7 : -dt * 7), 0, 1);

    // arrow keys: turn + move (trackpad-friendly fallback)
    const turn = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    if (turn) player.a = (player.a + turn * 2.6 * dt) % TAU;

    // movement
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    player.sprinting = !!(keys.ShiftLeft || keys.ShiftRight) && fwd > 0 && player.adsT < 0.3;
    let speed = 3.6;
    if (player.sprinting) speed *= 1.55;
    if (player.adsT > 0.3) speed *= 0.55;
    if (player.speedBoost > 0) speed *= 1.3;
    const ca = Math.cos(player.a), sa = Math.sin(player.a);
    let mx = ca * fwd - sa * strafe, my = sa * fwd + ca * strafe;
    const ml = Math.hypot(mx, my);
    if (ml > 0) {
      mx /= ml; my /= ml;
      velX = mx * speed; velY = my * speed;
      tryMove(player, player.x + velX * dt, player.y + velY * dt, PLAYER_RADIUS);
      player.bobPhase += dt * (player.sprinting ? 13 : 9);
      player.bobMag = clamp(player.bobMag + dt * 6, 0, 1);
      stepTimer -= dt;
      if (stepTimer <= 0) { Sound.step(); stepTimer = player.sprinting ? 0.28 : 0.42; }
    } else {
      velX = velY = 0;
      player.bobMag = clamp(player.bobMag - dt * 6, 0, 1);
    }

    // firing
    if (wantFire || (mouseDown && spec.auto)) fire();
    wantFire = false;
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.recoil = Math.max(0, player.recoil - dt * 6);
    player.recoilPitch *= Math.pow(0.005, dt); // settle back after the kick

    // reload
    if (player.reloading > 0) {
      player.reloading -= dt;
      if (player.reloading <= 0) {
        const need = spec.mag - player.ammo[player.weapon];
        const take = Math.min(need, player.reserve[player.weapon]);
        player.ammo[player.weapon] += take;
        player.reserve[player.weapon] -= take;
        Sound.reloadDone();
      }
    }

    // health regen, COD style
    if (time - player.lastHurt > REGEN_DELAY && player.hp < 100)
      player.hp = Math.min(100, player.hp + REGEN_RATE * dt);

    player.speedBoost = Math.max(0, player.speedBoost - dt);
    player.dmgBoost = Math.max(0, player.dmgBoost - dt);

    // pickups
    for (const p of pickupsList) {
      if (dist2(player.x, player.y, p.x, p.y) < 0.55 * 0.55) {
        p.taken = true;
        Sound.pickup();
        if (p.kind === 'ammo') {
          for (const wn of SLOT_ORDER)
            player.reserve[wn] = Math.min(WEAPONS[wn].maxReserve,
              player.reserve[wn] + Math.ceil(WEAPONS[wn].mag * 1.5));
          pushFeed('PICKED UP AMMO');
        } else if (p.kind === 'nachos') {
          player.hp = Math.min(100, player.hp + 35);
          pushFeed('NACHOS +35 HP');
        } else {
          player.grenades = Math.min(6, player.grenades + 1);
          pushFeed('+1 GRENADE');
        }
      }
    }
    pickupsList = pickupsList.filter(p => !p.taken);
  }

  // ------------------------------------------------------- waves & drops
  function startWave(n) {
    wave = n;
    remainingToSpawn = 5 + n * 3;
    spawnTimer = 1;
    const boss = n % 5 === 0;
    setAnnounce(`WAVE ${n}`, boss ? 'THE PRINCIPAL IS COMING' : `${remainingToSpawn} DIPWADS INBOUND`);
    Sound.waveHorn();
    Sound.say(boss ? pick(lines().boss) : pick(lines().wave), player.character);
    if (boss) {
      const s = farSpawn();
      enemies.push(makeEnemy('principal', s.x, s.y));
    }
  }

  function farSpawn() {
    let best = GameMap.spawns[0], bd = -1;
    for (const s of GameMap.spawns) {
      const d = dist2(s.x, s.y, player.x, player.y);
      if (d > bd) { bd = d; best = s; }
    }
    return Math.random() < 0.35 ? pick(GameMap.spawns) : best;
  }

  function pickEnemyType() {
    const r = Math.random();
    if (wave < 2) return 'poser';
    if (wave < 4) return r < 0.6 ? 'poser' : 'jock';
    if (r < 0.4) return 'poser';
    if (r < 0.75) return 'jock';
    return 'monitor';
  }

  function updateWave(dt) {
    if (intermission > 0) {
      intermission -= dt;
      if (intermission <= 0) startWave(wave + 1);
      return;
    }
    if (remainingToSpawn > 0) {
      spawnTimer -= dt;
      const aliveCap = Math.min(10 + wave, 22);
      if (spawnTimer <= 0 && enemies.filter(e => !e.dead).length < aliveCap) {
        spawnTimer = Math.max(0.4, 1.4 - wave * 0.05);
        remainingToSpawn--;
        let s = pick(GameMap.spawns);
        if (dist2(s.x, s.y, player.x, player.y) < 36) s = farSpawn();
        enemies.push(makeEnemy(pickEnemyType(),
          s.x + (Math.random() - 0.5) * 0.4, s.y + (Math.random() - 0.5) * 0.4));
      }
    } else if (enemies.every(e => e.dead)) {
      intermission = 7;
      player.grenades = Math.min(6, player.grenades + 1);
      score += 100 * wave; xp += 100 * wave;
      setAnnounce('WAVE CLEARED', `+${100 * wave} · GET READY`, 4);
      Sound.fanfare();
    }
  }

  function dropPickup(x, y, kind) {
    pickupsList.push({ x, y, kind, taken: false, bob: Math.random() * TAU });
  }

  function updateGrenades(dt) {
    for (const n of grenades) {
      n.fuse -= dt;
      const nx = n.x + n.vx * dt, ny = n.y + n.vy * dt;
      if (GameMap.solidAt(nx, n.y)) { n.vx *= -0.45; Sound.bounce(); } else n.x = nx;
      if (GameMap.solidAt(n.x, ny)) { n.vy *= -0.45; Sound.bounce(); } else n.y = ny;
      n.vz -= 5 * dt;
      n.z += n.vz * dt;
      if (n.z <= 0.06) {
        n.z = 0.06;
        if (Math.abs(n.vz) > 0.4) Sound.bounce();
        n.vz = -n.vz * 0.4;
        n.vx *= 0.75; n.vy *= 0.75;
      }
      if (n.fuse <= 0) { n.boom = true; explode(n.x, n.y, 2.4, 170, true); }
    }
    grenades = grenades.filter(n => !n.boom);
  }

  function spawnParticles(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.3 + Math.random() * 0.7);
      particles.push({
        x, y, z: 0.3 + Math.random() * 0.5,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (Math.random() - 0.2) * 2,
        life: life * (0.5 + Math.random() * 0.8), maxLife: life, color,
      });
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }
  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vz -= 3 * dt; p.z = Math.max(0.02, p.z + p.vz * dt);
    }
    particles = particles.filter(p => p.life > 0);
  }

  // ---------------------------------------------------------- rendering
  function currentFov() {
    let f = BASE_FOV + (ADS_FOV - BASE_FOV) * player.adsT;
    if (player.sprinting) f += (SPRINT_FOV - BASE_FOV) * 0.7;
    return f;
  }

  function render() {
    const fov = currentFov();
    const planeScale = Math.tan(fov / 2);
    const dirX = Math.cos(player.a), dirY = Math.sin(player.a);
    const planeX = -dirY * planeScale, planeY = dirX * planeScale;

    const shakeX = (Math.random() - 0.5) * shake, shakeY = (Math.random() - 0.5) * shake;
    const bobY = Math.sin(player.bobPhase * 2) * 4 * player.bobMag;
    const horizon = H / 2 + player.pitch + player.recoilPitch + bobY + shakeY;

    g.save();
    g.translate(shakeX, 0);

    // ceiling & floor
    let grad = g.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    grad.addColorStop(0, '#20242e'); grad.addColorStop(1, '#3a4050');
    g.fillStyle = grad; g.fillRect(-8, -8, W + 16, Math.max(0, horizon) + 8);
    grad = g.createLinearGradient(0, horizon, 0, H);
    grad.addColorStop(0, '#4a4238'); grad.addColorStop(1, '#241f18');
    g.fillStyle = grad; g.fillRect(-8, horizon, W + 16, H - horizon + 8);

    // walls
    for (let r = 0; r < RAYS; r++) {
      const cameraX = 2 * r / RAYS - 1;
      const rdx = dirX + planeX * cameraX, rdy = dirY + planeY * cameraX;
      const hit = castRay(player.x, player.y, rdx, rdy);
      const dist = Math.max(hit.dist, 0.01);
      zbuf[r] = dist;
      const lineH = H / dist;
      const y0 = horizon - lineH / 2;
      const tex = (hit.side ? Textures.wallsDark : Textures.walls)[hit.tile] || Textures.walls[1];
      const tx = clamp((hit.wallX * 64) | 0, 0, 63);
      g.drawImage(tex, tx, 0, 1, 64, r * COLW, y0, COLW, lineH);
      const shade = clamp(dist / 16, 0, 0.82);
      if (shade > 0.03) {
        g.fillStyle = `rgba(8,8,14,${shade})`;
        g.fillRect(r * COLW, y0, COLW, lineH);
      }
    }

    // billboards: enemies, pickups, grenades, particles.
    // zLift is world-units above the floor for the sprite's bottom edge.
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const bills = [];
    const pushBill = (x, y, img, wScale, hScale, zLift, extra) => {
      const relX = x - player.x, relY = y - player.y;
      const tX = invDet * (dirY * relX - dirX * relY);
      const tY = invDet * (-planeY * relX + planeX * relY);
      if (tY < 0.12) return;
      bills.push({ tX, tY, img, wScale, hScale, zLift, extra });
    };

    for (const e of enemies) {
      const pain = e.pain > 0 && !e.dead;
      const frames = (pain ? Textures.enemySpritesPain : Textures.enemySprites)[e.typeName];
      let img;
      if (e.dead) img = frames[0];
      else if (e.windupT > 0 || e.flash > 0) img = frames[2];
      else img = frames[(e.animT * 5 | 0) % 2];
      const s = e.type.scale;
      pushBill(e.x, e.y, img, 0.62 * s, 0.95 * s, e.dead ? -0.5 * (e.deadT / 0.6) : 0, { enemy: e });
    }
    for (const p of pickupsList)
      pushBill(p.x, p.y, Textures.pickups[p.kind], 0.32, 0.32,
        0.05 + Math.sin(time * 3 + p.bob) * 0.03, null);
    for (const n of grenades)
      pushBill(n.x, n.y, Textures.pickups.grenade, 0.13, 0.13, n.z, null);
    for (const p of particles)
      pushBill(p.x, p.y, null, 0, 0, p.z, { particle: p });

    bills.sort((a, b) => b.tY - a.tY);

    for (const b of bills) {
      const screenX = (W / 2) * (1 + b.tX / b.tY);
      const size = H / b.tY;                       // pixels per world unit at this depth
      const bottom = horizon + size / 2 - size * b.zLift;

      if (b.extra && b.extra.particle) {
        const p = b.extra.particle;
        const col = Math.round(screenX / COLW);
        if (col < 0 || col >= RAYS || zbuf[col] < b.tY) continue;
        const s = Math.max(2, size * 0.03);
        g.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
        g.fillStyle = p.color;
        g.fillRect(screenX - s / 2, bottom - s / 2, s, s);
        g.globalAlpha = 1;
        continue;
      }

      const sh = size * b.hScale, sw = size * b.wScale;
      const top = bottom - sh;
      const left = screenX - sw / 2;
      const e = b.extra && b.extra.enemy;
      const alpha = e && e.dead ? clamp(1 - e.deadT / 0.6, 0, 1) : 1;
      const c0 = clamp(Math.floor(left / COLW), 0, RAYS - 1);
      const c1 = clamp(Math.ceil((left + sw) / COLW), 0, RAYS);
      const iw = b.img.width;
      const srcW = Math.max(1, iw / (sw / COLW));
      g.globalAlpha = alpha;
      for (let c = c0; c < c1; c++) {
        if (zbuf[c] < b.tY) continue;
        const u = ((c * COLW - left) / sw) * iw;
        g.drawImage(b.img, clamp(u, 0, iw - 1), 0, srcW, b.img.height, c * COLW, top, COLW, sh);
      }
      g.globalAlpha = 1;

      if (e && !e.dead) {
        if (e.flash > 0 && e.flash < 0.12 && !e.type.melee) {
          const ms = size * 0.35;
          g.drawImage(Textures.muzzle, screenX - ms / 2, top + sh * 0.5 - ms / 2, ms, ms);
        }
        if (e.type.boss) {
          const bh = Math.max(3, size * 0.03);
          g.fillStyle = '#222'; g.fillRect(left, top - bh * 2, sw, bh);
          g.fillStyle = '#d43a3a';
          g.fillRect(left, top - bh * 2, sw * clamp(e.hp / e.maxHp, 0, 1), bh);
        }
      }
    }

    g.restore();
    renderViewmodel();
    renderHud();
  }

  function renderViewmodel() {
    const vm = viewmodels[player.weapon];
    const spec = WEAPONS[player.weapon];
    const bob = Math.sin(player.bobPhase) * 14 * player.bobMag * (1 - player.adsT * 0.8);
    const bob2 = Math.abs(Math.cos(player.bobPhase)) * 8 * player.bobMag * (1 - player.adsT * 0.8);
    const recoilY = player.recoil * 26;
    const reloadDip = player.reloading > 0
      ? Math.sin(Math.min(1, 1 - player.reloading / spec.reload) * Math.PI) * 110 : 0;
    const scale = 1.15 + player.adsT * 0.12;
    const cx = W / 2 + (1 - player.adsT) * 110 + bob;
    const cy = H - vm.c.height * scale + 40 + bob2 + recoilY + reloadDip + (player.sprinting ? 50 : 0);
    g.save();
    if (player.sprinting) {
      g.translate(cx, cy + 200); g.rotate(0.35); g.translate(-cx, -(cy + 200));
    }
    g.drawImage(vm.c, cx - (vm.c.width * scale) / 2, cy, vm.c.width * scale, vm.c.height * scale);
    if (player.recoil > 0.55) {
      const ms = 90 + Math.random() * 40;
      g.drawImage(Textures.muzzle,
        cx - (vm.c.width * scale) / 2 + vm.tipX * scale - ms / 2,
        cy + vm.tipY * scale - ms / 2, ms, ms);
    }
    g.restore();
  }

  // ----------------------------------------------------------------- HUD
  let minimapBase = null;
  function buildMinimap() {
    minimapBase = document.createElement('canvas');
    minimapBase.width = GameMap.W * 4; minimapBase.height = GameMap.H * 4;
    const mg = minimapBase.getContext('2d');
    mg.fillStyle = 'rgba(10,12,16,0.85)';
    mg.fillRect(0, 0, minimapBase.width, minimapBase.height);
    const cols = { 1: '#6b4638', 2: '#3d5a63', 3: '#8a7050', 4: '#565a60' };
    for (let y = 0; y < GameMap.H; y++)
      for (let x = 0; x < GameMap.W; x++) {
        const t = GameMap.grid[y][x];
        if (t > 0) { mg.fillStyle = cols[t] || '#666'; mg.fillRect(x * 4, y * 4, 4, 4); }
      }
  }

  const FONT = 'Impact, "Arial Black", sans-serif';
  function text(str, x, y, size, color, align = 'left', alpha = 1) {
    g.globalAlpha = alpha;
    g.font = `${size}px ${FONT}`;
    g.textAlign = align;
    g.fillStyle = '#000';
    g.fillText(str, x + 2, y + 2);
    g.fillStyle = color;
    g.fillText(str, x, y);
    g.globalAlpha = 1;
  }

  function renderHud() {
    const spec = WEAPONS[player.weapon];
    const cx = W / 2, cy = H / 2;

    // crosshair (dynamic gap) — fades out at full ADS
    if (player.adsT < 0.9 && !player.sprinting) {
      const gap = 8 + currentSpread() * 900 * (1 - player.adsT * 0.6);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - gap - 8, cy); g.lineTo(cx - gap, cy);
      g.moveTo(cx + gap, cy); g.lineTo(cx + gap + 8, cy);
      g.moveTo(cx, cy - gap - 8); g.lineTo(cx, cy - gap);
      g.moveTo(cx, cy + gap); g.lineTo(cx, cy + gap + 8);
      g.stroke();
    }
    if (player.adsT >= 0.9) {
      g.fillStyle = 'rgba(255,80,80,0.9)';
      g.fillRect(cx - 2, cy - 2, 4, 4);
    }
    if (hitmarker > 0) {
      g.strokeStyle = hitmarkerKill ? 'rgba(255,60,60,0.95)' : 'rgba(255,255,255,0.95)';
      g.lineWidth = 3;
      const o = 6, l = 12;
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.moveTo(cx + sx * o, cy + sy * o);
        g.lineTo(cx + sx * (o + l), cy + sy * (o + l));
      }
      g.stroke();
    }

    // health + portrait, bottom left
    const px = 20, py = H - 84;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(px, py, 250, 64);
    const hurt = time - player.lastHurt < 0.8 || player.hp < 30;
    g.drawImage(hurt ? portraitHurt : portraitCanvas, px + 4, py + 4, 56, 56);
    g.fillStyle = '#333'; g.fillRect(px + 68, py + 12, 148, 14);
    g.fillStyle = player.hp > 35 ? '#5fbf4f' : '#d43a3a';
    g.fillRect(px + 68, py + 12, 148 * clamp(player.hp / 100, 0, 1), 14);
    text(`${Math.ceil(Math.max(0, player.hp))}`, px + 244, py + 25, 16, '#fff', 'right');
    text(rankFor(xp), px + 68, py + 50, 15, '#f6c945');

    // weapon + ammo, bottom right
    const ax = W - 20, ay = H - 84;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(ax - 250, ay, 250, 64);
    text(spec.name, ax - 12, ay + 22, 17, '#fff', 'right');
    const ammoStr = player.reloading > 0 ? 'RELOADING…'
      : `${player.ammo[player.weapon]} / ${player.reserve[player.weapon]}`;
    text(ammoStr, ax - 12, ay + 50, 26,
      player.ammo[player.weapon] === 0 && player.reloading <= 0 ? '#d43a3a' : '#f6c945', 'right');
    text(`G×${player.grenades}`, ax - 190, ay + 50, 18, '#9fd06a', 'right');

    // score / wave, top left
    text(`SCORE ${score}`, 20, 34, 24, '#fff');
    if (multiplier > 1 && multTimer > 0)
      text(`×${multiplier.toFixed(2).replace(/\.?0+$/, '')}`, 150, 34, 18, '#f6c945');
    const alive = enemies.filter(e => !e.dead).length;
    text(`WAVE ${wave}`, 20, 62, 20, '#e67e22');
    text(`ENEMIES ${alive + remainingToSpawn}`, 20, 84, 15, '#ccc');
    if (streak >= 2) text(`STREAK ${streak}`, 20, 106, 15, '#ff8888');
    if (player.dmgBoost > 0) text(`DOUBLE DAMAGE ${Math.ceil(player.dmgBoost)}s`, 20, 128, 14, '#ffd0d0');

    // minimap, top right
    const mmW = 150, mmH = mmW * (GameMap.H / GameMap.W);
    const mx = W - mmW - 16, my = 16;
    g.drawImage(minimapBase, mx, my, mmW, mmH);
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.strokeRect(mx, my, mmW, mmH);
    const sxm = mmW / GameMap.W, sym = mmH / GameMap.H;
    for (const e of enemies) {
      if (e.dead) continue;
      g.fillStyle = e.type.boss ? '#ff4444' : '#ff8844';
      const ds = e.type.boss ? 5 : 3;
      g.fillRect(mx + e.x * sxm - ds / 2, my + e.y * sym - ds / 2, ds, ds);
    }
    for (const p of pickupsList) {
      g.fillStyle = '#f6c945';
      g.fillRect(mx + p.x * sxm - 1, my + p.y * sym - 1, 3, 3);
    }
    g.save();
    g.translate(mx + player.x * sxm, my + player.y * sym);
    g.rotate(player.a);
    g.fillStyle = '#7fd4ff';
    g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -4); g.lineTo(-4, 4); g.closePath(); g.fill();
    g.restore();

    // kill feed under the minimap
    let fy = my + mmH + 22;
    for (const f of feed) {
      text(f.text, W - 16, fy, 14, '#eee', 'right', clamp(f.t, 0, 1));
      fy += 20;
    }

    // announcements
    if (announce) {
      const a = clamp(announce.t / 0.4, 0, 1);
      text(announce.big, cx, H * 0.3, 52, '#f6c945', 'center', a);
      if (announce.small) text(announce.small, cx, H * 0.3 + 36, 22, '#fff', 'center', a);
    }
    if (intermission > 0)
      text(`NEXT WAVE IN ${Math.ceil(intermission)}`, cx, H * 0.62, 26, '#7fd4ff', 'center');

    // damage direction arcs
    for (const arc of hurtArcs) {
      const rel = arc.angle - player.a;
      g.save();
      g.translate(cx, cy);
      g.rotate(rel);
      g.strokeStyle = `rgba(230,40,40,${clamp(arc.t, 0, 0.8)})`;
      g.lineWidth = 10;
      g.beginPath(); g.arc(0, 0, 120, -0.45, 0.45); g.stroke();
      g.restore();
    }

    // low-health vignette + hit flash
    const hurtA = clamp(1 - player.hp / 55, 0, 1) * 0.55
      + clamp(0.8 - (time - player.lastHurt), 0, 0.8) * 0.4;
    if (hurtA > 0.02) {
      const vg = g.createRadialGradient(cx, cy, H * 0.32, cx, cy, H * 0.75);
      vg.addColorStop(0, 'rgba(160,0,0,0)');
      vg.addColorStop(1, `rgba(160,0,0,${clamp(hurtA, 0, 0.85)})`);
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
    if (flash > 0) {
      g.fillStyle = `rgba(255,240,200,${flash})`;
      g.fillRect(0, 0, W, H);
    }
    if (screenFlash) {
      g.fillStyle = `rgba(${screenFlash.color},${clamp(screenFlash.a, 0, 1)})`;
      g.fillRect(0, 0, W, H);
    }
  }

  // ------------------------------------------------------------- loop
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (mode !== 'playing') {
      if (mode === 'dead') render(); // freeze-frame behind the overlay
      return;
    }
    time += dt;

    updatePlayer(dt);
    updateEnemies(dt);
    updateGrenades(dt);
    updateParticles(dt);
    updateWave(dt);

    hitmarker = Math.max(0, hitmarker - dt);
    shake = Math.max(0, shake - dt * 40);
    flash = Math.max(0, flash - dt);
    multTimer = Math.max(0, multTimer - dt);
    if (multTimer <= 0) multiplier = 1;
    if (announce) { announce.t -= dt; if (announce.t <= 0) announce = null; }
    for (const f of feed) f.t -= dt;
    feed = feed.filter(f => f.t > 0);
    for (const a of hurtArcs) a.t -= dt;
    hurtArcs = hurtArcs.filter(a => a.t > 0);
    if (screenFlash) { screenFlash.a -= dt * 1.6; if (screenFlash.a <= 0) screenFlash = null; }

    render();
  }

  // ------------------------------------------------------------ control
  function start(character) {
    player.character = character;
    store.character = character;
    saveStore();
    Sound.unlock();

    Object.assign(player, {
      x: GameMap.playerStart.x, y: GameMap.playerStart.y, a: -Math.PI / 2,
      pitch: 0, recoilPitch: 0,
      hp: 100, lastHurt: -99, weapon: 'rifle', reloading: 0, grenades: 3,
      fireCooldown: 0, adsT: 0, sprinting: false, bobPhase: 0, bobMag: 0,
      recoil: 0, speedBoost: 0, dmgBoost: 0,
    });
    player.ammo = {}; player.reserve = {};
    for (const wn of SLOT_ORDER) {
      player.ammo[wn] = WEAPONS[wn].mag;
      player.reserve[wn] = Math.ceil(WEAPONS[wn].maxReserve / 2);
    }
    enemies = []; grenades = []; particles = []; pickupsList = []; feed = []; hurtArcs = [];
    score = 0; xp = 0; kills = 0; streak = 0; streakFired = 0;
    multiplier = 1; multTimer = 0; intermission = 0; time = 0;
    hitmarker = 0; shake = 0; flash = 0; screenFlash = null; announce = null;
    lastRank = rankFor(0);

    const sleeve = character === 'beavis' ? '#274a8f' : '#4d4d52';
    viewmodels = Textures.viewmodels(sleeve);
    portraitCanvas = Textures.portrait(character, 112);
    portraitHurt = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 112;
      const pg = c.getContext('2d');
      pg.drawImage(portraitCanvas, 0, 0);
      pg.fillStyle = 'rgba(220,30,30,0.35)';
      pg.fillRect(0, 0, 112, 112);
      return c;
    })();
    if (!minimapBase) buildMinimap();

    mode = 'playing';
    lockPointer();
    startWave(1);
  }

  function pause() {
    if (mode !== 'playing') return;
    mode = 'paused';
    document.exitPointerLock();
    UI.showPause();
  }
  function resume() {
    if (mode !== 'paused') return;
    mode = 'playing';
    last = performance.now();
    lockPointer();
  }
  function quitToMenu() {
    mode = 'menu';
    document.exitPointerLock();
    UI.showMenu();
  }

  requestAnimationFrame(tick);

  return {
    start, pause, resume, quitToMenu,
    restart: () => start(player.character),
    savedCharacter: () => store.character || 'butthead',
    stats: () => ({
      bestScore: store.bestScore || 0,
      bestWave: store.bestWave || 0,
      careerRank: rankFor(store.xp || 0),
    }),
    debug: () => ({
      mode, score, kills, wave, hp: Math.round(player.hp),
      alive: enemies.filter(e => !e.dead).length, toSpawn: remainingToSpawn,
    }),
  };
})();
