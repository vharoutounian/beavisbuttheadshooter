// Everything drawn on screen. Reads Game.S; never mutates gameplay state.
const Renderer = (() => {
  const canvas = document.getElementById('game');
  const g = canvas.getContext('2d');
  const { W, H, COLW, FLOOR_W, FLOOR_H, FOG_DIST } = CONFIG;
  canvas.width = W; canvas.height = H;
  const RAYS = W / COLW;
  const zbuf = new Float32Array(RAYS);
  const TAU = Math.PI * 2;

  const BANNER_FONT = 'Impact, "Arial Black", sans-serif';
  const UI_FONT = '"Segoe UI", system-ui, sans-serif';

  // ------------------------------------------------- per-run resources
  let viewmodels = null, portraitOk = null, portraitHurt = null, scopeOverlay = null;
  function onRunStart(character) {
    const sleeve = CHARACTERS[character].sleeve;
    viewmodels = Textures.viewmodels(sleeve);
    portraitOk = Characters.portrait(character, 128, 'normal');
    portraitHurt = Characters.portrait(character, 128, 'hurt');
    if (!scopeOverlay) scopeOverlay = Textures.makeScope(W, H);
    swayA = 0; swayP = 0; prevA = null; prevPitch = 0;
  }

  // --------------------------------------------- floor & ceiling caster
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = FLOOR_W; floorCanvas.height = FLOOR_H;
  const floorCtx = floorCanvas.getContext('2d');
  const floorImg = floorCtx.createImageData(FLOOR_W, FLOOR_H);
  const floorPix = new Uint32Array(floorImg.data.buffer);
  const texF = Textures.floorData, texC = Textures.ceilData, texCL = Textures.ceilLightData;
  const texF32 = new Uint32Array(texF.data.buffer);
  const texC32 = new Uint32Array(texC.data.buffer);
  const texCL32 = new Uint32Array(texCL.data.buffer);

  function castFloorCeil(px, py, dirX, dirY, planeX, planeY, horizon, eye) {
    const hb = horizon * (FLOOR_H / H);
    const ray0x = dirX - planeX, ray0y = dirY - planeY;
    const ray1x = dirX + planeX, ray1y = dirY + planeY;
    const posZfloor = eye * FLOOR_H;
    const posZceil = (1 - eye) * FLOOR_H;
    for (let y = 0; y < FLOOR_H; y++) {
      const isFloor = y > hb;
      const p = isFloor ? (y - hb) : (hb - y);
      if (p < 0.6) {                    // near-horizon rows: haze it out
        const base = y * FLOOR_W;
        for (let x = 0; x < FLOOR_W; x++) floorPix[base + x] = 0xff0a0a10;
        continue;
      }
      const rowDist = (isFloor ? posZfloor : posZceil) / p;
      const stepX = rowDist * (ray1x - ray0x) / FLOOR_W;
      const stepY = rowDist * (ray1y - ray0y) / FLOOR_W;
      let wx = px + rowDist * ray0x;
      let wy = py + rowDist * ray0y;
      // shade: distance fog
      let shade = 1 - rowDist / FOG_DIST;
      if (shade < 0.06) shade = 0.06; else if (shade > 1) shade = 1;
      shade *= isFloor ? 1 : 0.82;
      const base = y * FLOOR_W;
      for (let x = 0; x < FLOOR_W; x++) {
        const cellX = wx | 0, cellY = wy | 0;
        let tx = ((wx - cellX) * 64) | 0, ty = ((wy - cellY) * 64) | 0;
        if (tx < 0) tx = 0; if (ty < 0) ty = 0;
        let src;
        if (isFloor) src = texF32;
        else src = ((cellX * 7 + cellY * 13) % 5 === 0) ? texCL32 : texC32;
        const t = src[ty * 64 + tx];
        const r = (t & 0xff) * shade;
        const gg = ((t >> 8) & 0xff) * shade;
        const b = ((t >> 16) & 0xff) * shade;
        floorPix[base + x] = 0xff000000 | (b << 16) | (gg << 8) | r;
        wx += stepX; wy += stepY;
      }
    }
    floorCtx.putImageData(floorImg, 0, 0);
  }

  // ------------------------------------------------------- world render
  let swayA = 0, swayP = 0, prevA = null, prevPitch = 0;

  function renderWorld(cam, dt, visuals) {
    const S = Game.S;
    const fov = cam.fov;
    const planeScale = Math.tan(fov / 2);
    const dirX = Math.cos(cam.a), dirY = Math.sin(cam.a);
    const planeX = -dirY * planeScale, planeY = dirX * planeScale;
    const horizon = cam.horizon;
    const eye = cam.eye;

    // roll wrap
    g.save();
    if (cam.roll) {
      g.translate(W / 2, H / 2);
      g.rotate(cam.roll);
      const sc = 1 + Math.abs(cam.roll) * 2.2;
      g.scale(sc, sc);
      g.translate(-W / 2, -H / 2);
    }

    castFloorCeil(cam.x, cam.y, dirX, dirY, planeX, planeY, horizon, eye);
    g.imageSmoothingEnabled = true;
    g.drawImage(floorCanvas, 0, 0, W, H);

    // walls
    g.imageSmoothingEnabled = false;
    const muzzleGlow = visuals && visuals.flash > 0 ? 2.4 : 0;
    for (let r = 0; r < RAYS; r++) {
      const cameraX = 2 * r / RAYS - 1;
      const rdx = dirX + planeX * cameraX, rdy = dirY + planeY * cameraX;
      const hit = Game.castRay(cam.x, cam.y, rdx, rdy);
      const dist = Math.max(hit.dist, 0.01);
      zbuf[r] = dist;
      const lineH = H / dist;
      const y0 = horizon - lineH * (1 - eye);
      const tex = (hit.side ? Textures.wallsDark : Textures.walls)[hit.tile] || Textures.walls[1];
      const tx = Math.min(63, Math.max(0, (hit.wallX * 64) | 0));
      g.drawImage(tex, tx, 0, 1, 64, r * COLW, y0, COLW, lineH);
      let shade = (dist - muzzleGlow) / FOG_DIST;
      if (shade > 0.86) shade = 0.86; if (shade < 0) shade = 0;
      if (shade > 0.03) {
        g.fillStyle = `rgba(6,7,12,${shade})`;
        g.fillRect(r * COLW, y0, COLW, lineH);
      }
    }

    // ------- billboards
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const bills = [];
    const project = (x, y) => {
      const relX = x - cam.x, relY = y - cam.y;
      const tX = invDet * (dirY * relX - dirX * relY);
      const tY = invDet * (-planeY * relX + planeX * relY);
      return { tX, tY };
    };
    const pushBill = (x, y, img, wScale, hScale, zLift, extra) => {
      const pr = project(x, y);
      if (pr.tY < 0.12) return;
      bills.push({ tX: pr.tX, tY: pr.tY, img, wScale, hScale, zLift, extra });
    };

    if (S.mode !== 'menu') {
      // decals hug the walls
      for (const d of Fx.decals)
        pushBill(d.x, d.y, Textures.bulletHole, 0.06, 0.06, 0.42,
          { decal: true, fade: Math.min(1, d.t / 3) });

      for (const e of S.enemies) {
        const setBase = e.elite && Textures.enemySpritesElite[e.typeName]
          ? Textures.enemySpritesElite : Textures.enemySprites;
        const setPain = e.elite && Textures.enemySpritesElitePain[e.typeName]
          ? Textures.enemySpritesElitePain : Textures.enemySpritesPain;
        const frames = (e.pain > 0 && !e.dead) ? setPain[e.typeName] : setBase[e.typeName];
        let img;
        if (e.dead) {
          img = e.deadT < 0.16 ? frames.death[0] : e.deadT < 0.34 ? frames.death[1] : frames.death[2];
        } else if (e.pain > 0) img = frames.pain;
        else if (e.windupT > 0 || e.charging > 0) img = frames.attack[0];
        else if (e.flash > 0) img = frames.attack[1];
        else img = frames.walk[(e.animT * 6 | 0) % 4];
        const s = e.type.scale;
        if (!e.dead)
          pushBill(e.x, e.y, Textures.shadow, 0.5 * s, 0.14, 0, { shadow: true });
        pushBill(e.x, e.y, img, 0.62 * s, 0.95 * s, 0, { enemy: e });
      }
      for (const p of S.pickups) {
        pushBill(p.x, p.y, Textures.shadow, 0.22, 0.07, 0, { shadow: true });
        pushBill(p.x, p.y, Textures.pickups[p.kind], 0.3, 0.3,
          0.08 + Math.sin(S.time * 3 + p.bob) * 0.04, null);
      }
      for (const n of S.grenades)
        pushBill(n.x, n.y, Textures.pickups.grenade, 0.11, 0.11, n.z, null);
      for (const p of Fx.particles)
        pushBill(p.x, p.y, null, 0, 0, p.z, { particle: p });
    }

    bills.sort((a, b) => b.tY - a.tY);

    for (const b of bills) {
      const screenX = (W / 2) * (1 + b.tX / b.tY);
      const size = H / b.tY;
      const bottom = horizon + size * eye - size * b.zLift;

      if (b.extra && b.extra.particle) {
        const p = b.extra.particle;
        const col = Math.round(screenX / COLW);
        if (col < 0 || col >= RAYS || zbuf[col] < b.tY) continue;
        const s = Math.max(2, size * p.size);
        g.globalAlpha = Math.min(1, p.life / p.maxLife * 1.6);
        g.fillStyle = p.color;
        g.fillRect(screenX - s / 2, bottom - s / 2, s, s);
        g.globalAlpha = 1;
        continue;
      }

      const sh = size * b.hScale, sw = size * b.wScale;
      const top = bottom - sh;
      const left = screenX - sw / 2;
      const e = b.extra && b.extra.enemy;
      let alpha = 1;
      if (e && e.dead) alpha = Math.max(0, 1 - Math.max(0, e.deadT - 0.7) / 0.4);
      if (b.extra && b.extra.decal !== undefined) alpha = b.extra.fade;
      if (b.extra && b.extra.shadow) alpha = 0.8;
      const c0 = Math.max(0, Math.floor(left / COLW));
      const c1 = Math.min(RAYS, Math.ceil((left + sw) / COLW));
      const iw = b.img.width;
      const srcW = Math.max(1, iw / (sw / COLW));
      const depthBias = b.extra && b.extra.decal ? 0.08 : 0;
      g.globalAlpha = alpha;
      for (let c = c0; c < c1; c++) {
        if (zbuf[c] < b.tY - depthBias) continue;
        const u = ((c * COLW - left) / sw) * iw;
        g.drawImage(b.img, Math.min(iw - 1, Math.max(0, u)), 0, srcW, b.img.height,
          c * COLW, top, COLW, sh);
      }
      g.globalAlpha = 1;

      if (e && !e.dead) {
        if (e.flash > 0 && e.flash < 0.12 && !e.type.melee) {
          const ms = size * 0.32;
          g.drawImage(Textures.muzzleSmall, screenX - ms / 2, top + sh * 0.42 - ms / 2, ms, ms);
        }
        if (e.elite) {
          g.fillStyle = 'rgba(120,180,255,0.9)';
          g.font = `bold ${Math.max(8, size * 0.05)}px ${UI_FONT}`;
          g.textAlign = 'center';
          g.fillText('◆', screenX, top - size * 0.02);
        }
      }
    }

    // tracers
    for (const t of Fx.tracers) {
      const a0 = project(t.x0, t.y0), a1 = project(t.x1, t.y1);
      if (a0.tY < 0.1 && a1.tY < 0.1) continue;
      const pt = pr => ({
        x: (W / 2) * (1 + pr.tX / Math.max(0.1, pr.tY)),
        y: horizon + (H / Math.max(0.1, pr.tY)) * (eye - 0.45),
      });
      const p0 = pt(a0), p1 = pt(a1);
      g.strokeStyle = `rgba(255,225,140,${(t.t / t.max) * 0.8})`;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
    }

    // floating text (world-anchored)
    for (const f of Fx.floaters) {
      const pr = project(f.x, f.y);
      if (pr.tY < 0.25) continue;
      const size = H / pr.tY;
      const sx = (W / 2) * (1 + pr.tX / pr.tY);
      const sy = horizon + size * eye - size * f.z;
      const col = Math.round(sx / COLW);
      if (col >= 0 && col < RAYS && zbuf[col] < pr.tY - 0.2) continue;
      const fs = Math.max(9, Math.min(34, size * 0.085 * f.size));
      g.globalAlpha = Math.min(1, f.t / f.max * 1.8);
      g.font = `bold ${fs}px ${UI_FONT}`;
      g.textAlign = 'center';
      g.fillStyle = '#000';
      g.fillText(f.text, sx + 1.5, sy + 1.5);
      g.fillStyle = f.color;
      g.fillText(f.text, sx, sy);
      g.globalAlpha = 1;
    }

    g.restore();  // roll
  }

  // -------------------------------------------------------- viewmodel
  function renderViewmodel(dt) {
    const S = Game.S, p = S.player;
    const sp = WEAPONS[p.weapon];
    const vm = viewmodels[p.weapon];

    // scope: at full ADS the viewmodel disappears behind the optic
    if (sp.scope && p.adsT > 0.92) {
      g.drawImage(scopeOverlay, 0, 0);
      return;
    }

    // weapon sway from turning
    if (prevA === null) { prevA = p.a; prevPitch = p.pitch; }
    let dA = p.a - prevA;
    if (dA > Math.PI) dA -= TAU; if (dA < -Math.PI) dA += TAU;
    const dP = p.pitch - prevPitch;
    prevA = p.a; prevPitch = p.pitch;
    swayA += (dA * 260 - swayA) * Math.min(1, dt * 9);
    swayP += (dP * 0.7 - swayP) * Math.min(1, dt * 9);

    const ads = p.adsT * p.adsT * (3 - 2 * p.adsT); // smoothstep
    const bob = Math.sin(p.bobPhase) * 13 * p.bobMag * (1 - ads * 0.85);
    const bob2 = Math.abs(Math.cos(p.bobPhase)) * 8 * p.bobMag * (1 - ads * 0.85);
    const idle = Math.sin(S.time * 1.7) * 2.2 * (1 - ads);
    const recoilY = p.recoil * (20 + sp.viewKick * 8);
    const reloadDip = p.reloading > 0
      ? Math.sin(Math.min(1, 1 - p.reloading / (sp.reload || 1)) * Math.PI) * 130 : 0;
    const swapDip = p.swapT > 0 ? p.swapT * 320 : 0;

    const scale = 1.12 + ads * 0.1;
    // left-edge coordinates for both anchors; the ADS anchor puts the
    // weapon's sight pixel exactly on screen center
    const hipX = W / 2 + 150 - (vm.c.width * scale) / 2;
    const hipY = H - vm.c.height * scale + 46;
    const adsX = W / 2 - vm.sightX * scale;
    const adsY = H / 2 - vm.sightY * scale + recoilY * 0.4;
    const drawX = hipX + (adsX - hipX) * ads - swayA * (1 - ads * 0.7) + bob;
    const y = hipY + (adsY - hipY) * ads - swayP * (1 - ads * 0.7) + bob2 + idle
      + recoilY + reloadDip + swapDip + (p.sprinting ? 60 : 0) + (p.slideT > 0 ? 40 : 0);

    g.save();
    if (p.sprinting || p.slideT > 0) {
      g.translate(drawX + vm.c.width * scale / 2, y + 260);
      g.rotate(p.slideT > 0 ? 0.22 : 0.35);
      g.translate(-(drawX + vm.c.width * scale / 2), -(y + 260));
    }
    g.drawImage(vm.c, drawX, y, vm.c.width * scale, vm.c.height * scale);
    if (p.recoil > 0.55) {
      const ms = 96 + Math.random() * 44;
      g.drawImage(Textures.muzzle,
        drawX + vm.tipX * scale - ms / 2, y + vm.tipY * scale - ms / 2, ms, ms);
    }
    g.restore();

    // shell casings (screen space)
    for (const s of Fx.shells) {
      g.save();
      g.translate(s.x, s.y);
      g.rotate(s.rot);
      g.globalAlpha = Math.min(1, s.t * 2);
      g.fillStyle = '#c9a742';
      g.fillRect(-4, -2, 8, 4);
      g.fillStyle = '#8f742a';
      g.fillRect(2, -2, 2, 4);
      g.restore();
    }
    g.globalAlpha = 1;
  }

  // -------------------------------------------------------------- HUD
  function panel(x, y, w, h, r = 10) {
    g.fillStyle = 'rgba(10,12,18,0.62)';
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill(); g.stroke();
  }
  function label(str, x, y, size, color, align = 'left', weight = 700, font = UI_FONT, alpha = 1) {
    g.globalAlpha = alpha;
    g.font = `${weight} ${size}px ${font}`;
    g.textAlign = align;
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillText(str, x + 1.5, y + 1.5);
    g.fillStyle = color;
    g.fillText(str, x, y);
    g.globalAlpha = 1;
  }
  function bar(x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.12)') {
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
    if (frac > 0.01) {
      g.fillStyle = color;
      g.beginPath(); g.roundRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2); g.fill();
    }
  }

  // rotating minimap resources
  let mapBase = null;
  function buildMapBase() {
    mapBase = document.createElement('canvas');
    const SC = 8;
    mapBase.width = GameMap.W * SC; mapBase.height = GameMap.H * SC;
    const mg = mapBase.getContext('2d');
    mg.fillStyle = 'rgba(16,20,28,0.95)';
    mg.fillRect(0, 0, mapBase.width, mapBase.height);
    const cols = { 1: '#7a5240', 2: '#48707e', 3: '#9a7f5c', 4: '#5e646c', 5: '#8a7a52', 6: '#75512f', 7: '#7d9080' };
    for (let y = 0; y < GameMap.H; y++)
      for (let x = 0; x < GameMap.W; x++) {
        const t = GameMap.grid[y][x];
        if (t > 0) { mg.fillStyle = cols[t] || '#666'; mg.fillRect(x * SC, y * SC, SC, SC); }
      }
  }

  function drawMinimap() {
    if (!mapBase) buildMapBase();
    const S = Game.S, p = S.player;
    const R = 76;                     // radius on screen
    const cx = W - R - 22, cy = R + 22;
    const SC = 8;
    const range = 9;                  // world tiles visible

    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    g.fillStyle = 'rgba(8,10,14,0.8)';
    g.fillRect(cx - R, cy - R, R * 2, R * 2);
    const scale = R / range;          // px per world tile
    g.translate(cx, cy);
    if (Game.settings.minimapRotate) g.rotate(-p.a - Math.PI / 2);
    g.scale(scale / SC, scale / SC);
    g.translate(-p.x * SC, -p.y * SC);
    g.drawImage(mapBase, 0, 0);
    g.restore();

    // dots (transform manually so they stay crisp)
    const dot = (wx, wy, color, sz) => {
      let rx = (wx - p.x), ry = (wy - p.y);
      if (Game.settings.minimapRotate) {
        const rot = -p.a - Math.PI / 2;
        const c = Math.cos(rot), s = Math.sin(rot);
        const nx = rx * c - ry * s, ny = rx * s + ry * c;
        rx = nx; ry = ny;
      }
      const d = Math.hypot(rx, ry);
      if (d > range - 0.4) return;
      g.fillStyle = color;
      g.beginPath(); g.arc(cx + rx * (R / range), cy + ry * (R / range), sz, 0, TAU); g.fill();
    };
    for (const e of S.enemies) {
      if (e.dead) continue;
      dot(e.x, e.y, e.type.boss ? '#ff4040' : e.elite ? '#7fb4ff' : '#ff9955', e.type.boss ? 4.5 : 3);
    }
    for (const pk of S.pickups) dot(pk.x, pk.y, '#f6c945', 2.4);

    // player arrow + view cone
    g.save();
    g.translate(cx, cy);
    if (!Game.settings.minimapRotate) g.rotate(p.a);
    else g.rotate(-Math.PI / 2 + 0);
    if (Game.settings.minimapRotate) g.rotate(0);
    g.fillStyle = 'rgba(140,210,255,0.14)';
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, R * 0.9, -0.6, 0.6);
    g.closePath(); g.fill();
    g.fillStyle = '#8cd2ff';
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-5, -5); g.lineTo(-5, 5); g.closePath(); g.fill();
    g.restore();

    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
  }

  function drawCompass() {
    const S = Game.S, p = S.player;
    const cw = 430, cx = W / 2, y = 26;
    panel(cx - cw / 2, y - 16, cw, 30, 15);
    g.save();
    g.beginPath(); g.rect(cx - cw / 2 + 8, y - 16, cw - 16, 30); g.clip();
    // bearing: 0 = north (-y). screen offset per degree
    const degPer = 3.4;
    const bearing = ((p.a + Math.PI / 2) * 180 / Math.PI % 360 + 360) % 360;
    const marks = [
      [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'],
    ];
    for (const [deg, txt] of marks) {
      let rel = deg - bearing;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      const x = cx + rel * degPer;
      if (x < cx - cw / 2 || x > cx + cw / 2) continue;
      const major = txt.length === 1;
      label(txt, x, y + 5, major ? 15 : 11,
        major ? '#fff' : 'rgba(255,255,255,0.55)', 'center', 700);
    }
    for (let deg = 0; deg < 360; deg += 15) {
      let rel = deg - bearing;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      const x = cx + rel * degPer;
      if (x < cx - cw / 2 + 6 || x > cx + cw / 2 - 6) continue;
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(x, y + 8, 1.5, 4);
    }
    // damage pings on the compass
    for (const arc of S.hurtArcs) {
      let rel = ((arc.angle + Math.PI / 2) * 180 / Math.PI) - bearing;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      const x = cx + rel * degPer;
      if (x < cx - cw / 2 || x > cx + cw / 2) continue;
      g.fillStyle = `rgba(230,50,50,${Math.min(1, arc.t)})`;
      g.beginPath(); g.moveTo(x, y + 12); g.lineTo(x - 5, y + 4); g.lineTo(x + 5, y + 4);
      g.closePath(); g.fill();
    }
    // boss ping
    if (S.boss && !S.boss.dead) {
      const a = Math.atan2(S.boss.y - p.y, S.boss.x - p.x);
      let rel = ((a + Math.PI / 2) * 180 / Math.PI) - bearing;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      const x = cx + Math.max(-cw / 2 + 10, Math.min(cw / 2 - 10, rel * degPer));
      label('☠', x, y + 6, 13, '#ff6a5f', 'center');
    }
    g.restore();
    // center caret
    g.fillStyle = '#f6c945';
    g.beginPath(); g.moveTo(cx, y - 18); g.lineTo(cx - 5, y - 24); g.lineTo(cx + 5, y - 24);
    g.closePath(); g.fill();
  }

  function drawHud(dt) {
    const S = Game.S, p = S.player;
    const sp = WEAPONS[p.weapon];
    const cx = W / 2, cy = H / 2;
    const scoped = sp.scope && p.adsT > 0.92;

    // ---------- crosshair
    if (!scoped && p.adsT < 0.9 && !p.sprinting && p.slideT <= 0 && !S.shopOpen) {
      const spreadPx = 8 + (sp.spread + (sp.adsSpread - sp.spread) * p.adsT) * 620;
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - spreadPx - 7, cy); g.lineTo(cx - spreadPx, cy);
      g.moveTo(cx + spreadPx, cy); g.lineTo(cx + spreadPx + 7, cy);
      g.moveTo(cx, cy - spreadPx - 7); g.lineTo(cx, cy - spreadPx);
      g.moveTo(cx, cy + spreadPx); g.lineTo(cx, cy + spreadPx + 7);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(cx - 1, cy - 1, 2, 2);
    }
    if (!scoped && p.adsT >= 0.9 && !sp.scope) {
      g.fillStyle = 'rgba(255,90,90,0.95)';
      g.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    if (S.hitmarker > 0) {
      const col = S.hitmarkerKind === 'kill' ? 'rgba(255,60,60,0.95)'
        : S.hitmarkerKind === 'head' ? 'rgba(255,200,60,0.95)' : 'rgba(255,255,255,0.9)';
      g.strokeStyle = col; g.lineWidth = 3;
      const o = 7, l = 11;
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.moveTo(cx + sx * o, cy + sy * o);
        g.lineTo(cx + sx * (o + l), cy + sy * (o + l));
      }
      g.stroke();
    }

    // ---------- bottom-left: portrait + health/armor
    const hx = 24, hy = H - 96;
    panel(hx, hy, 292, 74, 12);
    const hurt = S.time - p.lastHurt < 0.8 || p.hp < 30;
    g.save();
    g.beginPath(); g.arc(hx + 38, hy + 37, 28, 0, TAU); g.clip();
    g.fillStyle = '#1c2028'; g.fillRect(hx + 10, hy + 9, 56, 56);
    g.drawImage(hurt ? portraitHurt : portraitOk, hx + 10, hy + 9, 56, 56);
    g.restore();
    g.strokeStyle = hurt ? 'rgba(230,70,70,0.9)' : 'rgba(255,255,255,0.3)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(hx + 38, hy + 37, 28, 0, TAU); g.stroke();
    if (p.armor > 0)
      bar(hx + 78, hy + 16, 170, 8, p.armor / CONFIG.MAX_ARMOR, '#5b8fd4');
    bar(hx + 78, hy + 30, 170, 12, p.hp / p.maxHp,
      p.hp / p.maxHp > 0.35 ? '#63c74d' : '#d43a3a');
    label(`${Math.ceil(Math.max(0, p.hp))}`, hx + 258, hy + 41, 18, '#fff', 'left', 800);
    label(Game.rankFor(S.xp), hx + 78, hy + 58, 12.5, '#f6c945', 'left', 700);
    // xp progress to next rank, tucked under the rank name
    const nr = Game.nextRank(S.xp);
    if (nr) {
      const prev = RANKS.filter(r => r[0] <= S.xp).pop();
      bar(hx + 78, hy + 63, 204, 4, (S.xp - prev[0]) / (nr[0] - prev[0]), '#f6c945');
    }

    // ---------- bottom-right: weapon
    const ax = W - 24, ay = H - 96;
    panel(ax - 292, ay, 292, 74, 12);
    label(sp.name, ax - 14, ay + 24, 15, '#fff', 'right', 800);
    const ammoStr = p.reloading > 0 ? 'RELOADING'
      : `${p.ammo[p.weapon]}`;
    label(ammoStr, ax - 66, ay + 58, p.reloading > 0 ? 18 : 30,
      p.ammo[p.weapon] === 0 && p.reloading <= 0 ? '#d43a3a' : '#fff', 'right', 800);
    if (p.reloading <= 0)
      label(`/ ${p.reserve[p.weapon]}`, ax - 14, ay + 58, 15, 'rgba(255,255,255,0.6)', 'right', 700);
    // slot pips
    let px2 = ax - 284;
    for (const wn of SLOT_ORDER) {
      const owned = p.owned[wn];
      const cur = p.weapon === wn;
      g.fillStyle = cur ? '#f6c945' : owned ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.15)';
      g.beginPath(); g.roundRect(px2, ay + 10, 18, 14, 3); g.fill();
      label(`${WEAPONS[wn].slot}`, px2 + 9, ay + 21, 10, cur ? '#000' : '#000', 'center', 800);
      px2 += 23;
    }
    // grenades
    for (let i = 0; i < p.grenades; i++) {
      g.fillStyle = '#9fd06a';
      g.beginPath(); g.arc(ax - 278 + i * 14, ay + 42, 4.5, 0, TAU); g.fill();
    }
    if (p.reloading > 0)
      bar(ax - 284, ay + 66, 270, 4, 1 - p.reloading / (sp.reload || 1), '#f6c945');

    // ---------- top-left: cash / score / wave
    panel(24, 20, 210, 92, 12);
    label(`$${S.cash}`, 40, 50, 26, '#9fd06a', 'left', 800);
    label(`SCORE ${S.score}`, 40, 74, 14, '#fff', 'left', 700);
    if (S.multiplier > 1 && S.multTimer > 0)
      label(`×${S.multiplier.toFixed(2).replace(/\.?0+$/, '')}`, 160, 74, 13, '#f6c945', 'left', 800);
    const alive = S.enemies.filter(e => !e.dead).length;
    label(`WAVE ${S.wave}`, 40, 98, 15, '#e67e22', 'left', 800);
    label(`✖ ${alive + S.toSpawn}`, 130, 98, 14, 'rgba(255,255,255,0.75)', 'left', 700);

    // killstreak pips under panel
    if (S.streak >= 1) {
      const marks = [3, 5, 7];
      let kx = 34;
      label(`STREAK ${S.streak}`, kx, 132, 12, '#ff9d9d', 'left', 800);
      kx += 84;
      for (const m of marks) {
        g.fillStyle = S.streak >= m ? '#f6c945' : 'rgba(255,255,255,0.2)';
        g.beginPath(); g.arc(kx, 128, 5, 0, TAU); g.fill();
        kx += 16;
      }
    }
    if (p.dmgBoost > 0)
      label(`DOUBLE DAMAGE ${Math.ceil(p.dmgBoost)}s`, 34, 152, 12, '#ffd0d0', 'left', 800);

    drawCompass();
    if (!scoped) drawMinimap();

    // ---------- kill feed (under minimap)
    let fy = 190;
    for (const f of S.feed) {
      label(f.text, W - 24, fy, 12.5, 'rgba(255,255,255,0.92)', 'right', 700, UI_FONT,
        Math.min(1, f.t));
      fy += 19;
    }

    // ---------- medals (center-right, punchy)
    let my = cy - 60;
    for (const m of S.medals) {
      const age = m.max - m.t;
      const scaleIn = age < 0.12 ? 0.7 + (age / 0.12) * 0.3 : 1;
      g.save();
      g.translate(W * 0.72, my);
      g.scale(scaleIn, scaleIn);
      label(m.label, 0, 0, 21, m.color, 'center', 800, BANNER_FONT, Math.min(1, m.t / 0.5));
      g.restore();
      my += 30;
    }

    // ---------- boss bar
    if (S.boss && !S.boss.dead) {
      const bw = 420;
      panel(cx - bw / 2, 56, bw, 34, 10);
      label(S.boss.type.label, cx, 71, 13, '#ff8a7f', 'center', 800);
      bar(cx - bw / 2 + 14, 76, bw - 28, 8, S.boss.hp / S.boss.maxHp, '#d43a3a');
    }

    // ---------- announcements
    if (S.announce) {
      const a = S.announce;
      const inT = Math.min(1, (a.max - a.t) / 0.18);
      const outT = Math.min(1, a.t / 0.35);
      const alpha = Math.min(inT, outT);
      const rise = (1 - inT) * 26;
      label(a.big, cx, H * 0.3 + rise, 54, '#f6c945', 'center', 400, BANNER_FONT, alpha);
      if (a.small)
        label(a.small, cx, H * 0.3 + 38 + rise, 20, '#fff', 'center', 700, UI_FONT, alpha);
    }
    if (S.intermission > 0 && !S.shopOpen) {
      label(`NEXT WAVE IN ${Math.ceil(S.intermission)}`, cx, 122, 20, '#7fd4ff', 'center', 800);
      label('TAB — SHOP', cx, 146, 13, 'rgba(255,255,255,0.7)', 'center', 700);
    }

    // ---------- damage direction arcs
    for (const arc of S.hurtArcs) {
      const rel = arc.angle - p.a;
      g.save();
      g.translate(cx, cy);
      g.rotate(rel);
      g.strokeStyle = `rgba(230,40,40,${Math.min(0.8, arc.t)})`;
      g.lineWidth = 9;
      g.beginPath(); g.arc(0, 0, 130, -0.4, 0.4); g.stroke();
      g.restore();
    }

    // ---------- vignette / flashes
    const beat = p.hp < 35 ? (Math.sin(S.time * 6) * 0.5 + 0.5) * 0.15 : 0;
    const hurtA = Math.max(0, 1 - p.hp / 55) * 0.5
      + Math.max(0, 0.8 - (S.time - p.lastHurt)) * 0.4 + beat;
    if (hurtA > 0.02) {
      const vg = g.createRadialGradient(cx, cy, H * 0.3, cx, cy, H * 0.72);
      vg.addColorStop(0, 'rgba(150,0,0,0)');
      vg.addColorStop(1, `rgba(150,0,0,${Math.min(0.85, hurtA)})`);
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
    if (S.flash > 0) {
      g.fillStyle = `rgba(255,240,200,${S.flash})`;
      g.fillRect(0, 0, W, H);
    }
    if (S.screenFlash) {
      g.fillStyle = `rgba(${S.screenFlash.color},${Math.min(1, S.screenFlash.a)})`;
      g.fillRect(0, 0, W, H);
    }

    if (S.shopOpen) drawShop();
  }

  // ------------------------------------------------------------- shop
  function drawShop() {
    const S = Game.S;
    g.fillStyle = 'rgba(6,8,12,0.82)';
    g.fillRect(0, 0, W, H);
    label('THE SCHOOL STORE', W / 2, 96, 42, '#f6c945', 'center', 400, BANNER_FONT);
    label(`CASH  $${S.cash}`, W / 2, 128, 18, '#9fd06a', 'center', 800);
    const items = Game.shopItems();
    const cols = 3, cw = 330, chh = 96, gap = 18;
    const total = Math.ceil(items.length / cols);
    const x0 = W / 2 - (cols * cw + (cols - 1) * gap) / 2;
    const y0 = 170;
    items.forEach((item, i) => {
      const col = i % cols, row = (i / cols) | 0;
      const x = x0 + col * (cw + gap), y = y0 + row * (chh + gap);
      const afford = S.cash >= item.price && !item.owned;
      g.fillStyle = item.owned ? 'rgba(40,60,40,0.6)'
        : afford ? 'rgba(24,28,40,0.85)' : 'rgba(20,20,26,0.7)';
      g.strokeStyle = item.owned ? 'rgba(120,200,120,0.5)'
        : afford ? 'rgba(246,201,69,0.55)' : 'rgba(255,255,255,0.12)';
      g.lineWidth = 2;
      g.beginPath(); g.roundRect(x, y, cw, chh, 10); g.fill(); g.stroke();
      g.fillStyle = afford ? '#f6c945' : 'rgba(255,255,255,0.25)';
      g.beginPath(); g.roundRect(x + 12, y + 12, 26, 26, 6); g.fill();
      label(`${i + 1}`, x + 25, y + 31, 15, '#000', 'center', 800);
      label(item.label, x + 50, y + 30, 16.5,
        item.owned ? 'rgba(160,220,160,0.9)' : '#fff', 'left', 800);
      label(item.desc || '', x + 50, y + 52, 12.5, 'rgba(255,255,255,0.6)', 'left', 600);
      label(item.owned ? 'OWNED' : `$${item.price}`, x + cw - 14, y + 30, 16,
        item.owned ? 'rgba(160,220,160,0.9)' : afford ? '#9fd06a' : '#d46a5f', 'right', 800);
    });
    label('PRESS NUMBER TO BUY  ·  TAB TO CLOSE', W / 2, y0 + total * (chh + gap) + 26,
      14, 'rgba(255,255,255,0.7)', 'center', 700);
  }

  // ------------------------------------------------------- frame entry
  let fps = 0, fpsT = 0, fpsN = 0;
  function render(dt) {
    const S = Game.S;

    if (S.mode === 'menu') {
      const at = S.attract;
      renderWorld({
        x: at.x, y: at.y, a: at.a, fov: 72 * Math.PI / 180,
        horizon: H / 2 + Math.sin(at.a * 2) * 14, eye: 0.5, roll: 0,
      }, dt, null);
      g.fillStyle = 'rgba(5,6,10,0.5)';
      g.fillRect(0, 0, W, H);
      return;
    }
    if (!S.player) return;
    const p = S.player;

    const sp = WEAPONS[p.weapon];
    const baseFov = Game.settings.fov * Math.PI / 180;
    const adsFov = (sp.adsFov || 48) * Math.PI / 180;
    let fov = baseFov + (adsFov - baseFov) * p.adsT;
    if (p.sprinting) fov += 6 * Math.PI / 180;
    if (p.slideT > 0) fov += 9 * Math.PI / 180;

    const shakeAmp = Game.settings.shake ? S.shake : 0;
    const shakeX = (Math.random() - 0.5) * shakeAmp;
    const shakeY = (Math.random() - 0.5) * shakeAmp;
    const bobY = Math.sin(p.bobPhase * 2) * 4 * p.bobMag;
    const horizon = H / 2 + p.pitch + p.recoilPitch + bobY + shakeY;

    g.save();
    g.translate(shakeX, 0);
    renderWorld({ x: p.x, y: p.y, a: p.a, fov, horizon, eye: p.eye, roll: p.roll },
      dt, { flash: S.flash });
    g.restore();

    renderViewmodel(dt);
    drawHud(dt);

    if (S.mode === 'dead') {
      g.fillStyle = 'rgba(30,0,0,0.35)';
      g.fillRect(0, 0, W, H);
    }

    if (S.debug) {
      fpsN++; fpsT += dt;
      if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
      label(`${fps} FPS`, W - 16, H - 14, 12, '#7fd4ff', 'right', 700);
    }
  }

  return { render, onRunStart };
})();
