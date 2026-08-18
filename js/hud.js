import { CONFIG, WEAPONS, SLOT_ORDER, RANKS } from './config.js';
import { GameMap } from './map.js';
import { Textures } from './textures.js';
import { Characters } from './characters.js';
import { Fx } from './fx.js';
import { Game } from './game.js';           // runtime-only (circular is fine)
import { Renderer } from './render3d.js';   // runtime-only (circular is fine)

// 2D overlay on top of the 3D scene: viewmodel, HUD, shop, scope, and
// world-anchored floating text (projected via Renderer.worldToScreen).
export const Hud = (() => {
  const canvas = document.getElementById('hud');
  const g = canvas.getContext('2d');
  const DW = 1280, DH = 720;
  const TAU = Math.PI * 2;
  let W = 1280, H = 720, uiScale = 1;
  let scopeOverlay = null;

  const BANNER_FONT = 'Impact, "Arial Black", sans-serif';
  const UI_FONT = '"Segoe UI", system-ui, sans-serif';

  function setSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fitH = Math.min(window.innerHeight || DH, (window.innerWidth || DW) * 9 / 16);
    H = Math.max(540, Math.min(1440, Math.round(fitH * dpr)));
    W = Math.round(H * 16 / 9);
    canvas.width = W; canvas.height = H;
    uiScale = H / DH;
    scopeOverlay = Textures.makeScope(W, H);
  }
  setSize();

  let portraitOk = null, portraitHurt = null;
  function onRunStart(character) {
    portraitOk = Characters.portrait(character, 256, 'normal');
    portraitHurt = Characters.portrait(character, 256, 'hurt');
  }

  // ------------------------------------------------------------ helpers
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

  // ------------------------------------------- scope overlay + casings
  // (the weapon itself is a real 3D model riding on the camera)
  function renderViewmodel(dt) {
    const S = Game.S, p = S.player;
    const sp = WEAPONS[p.weapon];
    if (sp.scope && p.adsT > 0.92) {
      g.drawImage(scopeOverlay, 0, 0);
      return;
    }
    if (!Fx.shells.length) return;
    g.save();
    g.scale(uiScale, uiScale);
    for (const s2 of Fx.shells) {
      g.save();
      g.translate(s2.x, s2.y);
      g.rotate(s2.rot);
      g.globalAlpha = Math.min(1, s2.t * 2);
      g.fillStyle = '#c9a742';
      g.fillRect(-4, -2, 8, 4);
      g.fillStyle = '#8f742a';
      g.fillRect(2, -2, 2, 4);
      g.restore();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  // -------------------------------------------------------- minimap
  let mapBase = null;
  function buildMapBase() {
    mapBase = document.createElement('canvas');
    const SC = 16;
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
    const R = 76;
    const cx = DW - R - 22, cy = R + 22;
    const SC = 16;
    const range = 9;

    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    g.fillStyle = 'rgba(8,10,14,0.8)';
    g.fillRect(cx - R, cy - R, R * 2, R * 2);
    const scale = R / range;
    g.translate(cx, cy);
    if (Game.settings.minimapRotate) g.rotate(-p.a - Math.PI / 2);
    g.scale(scale / SC, scale / SC);
    g.translate(-p.x * SC, -p.y * SC);
    g.drawImage(mapBase, 0, 0);
    g.restore();

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
    const cw = 430, cx = DW / 2, y = 26;
    panel(cx - cw / 2, y - 16, cw, 30, 15);
    g.save();
    g.beginPath(); g.rect(cx - cw / 2 + 8, y - 16, cw - 16, 30); g.clip();
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
    if (S.boss && !S.boss.dead) {
      const a = Math.atan2(S.boss.y - p.y, S.boss.x - p.x);
      let rel = ((a + Math.PI / 2) * 180 / Math.PI) - bearing;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      const x = cx + Math.max(-cw / 2 + 10, Math.min(cw / 2 - 10, rel * degPer));
      label('☠', x, y + 6, 13, '#ff6a5f', 'center');
    }
    g.restore();
    g.fillStyle = '#f6c945';
    g.beginPath(); g.moveTo(cx, y - 18); g.lineTo(cx - 5, y - 24); g.lineTo(cx + 5, y - 24);
    g.closePath(); g.fill();
  }

  // -------------------------------------------------------------- HUD
  function drawFloaters() {
    for (const f of Fx.floaters) {
      const pr = Renderer.worldToScreen(f.x, f.y, f.z);
      if (!pr.visible) continue;
      const fs = Math.max(10, Math.min(30, 22 * f.size));
      label(f.text, pr.x, pr.y, fs, f.color, 'center', 800, UI_FONT,
        Math.min(1, (f.t / f.max) * 1.8));
    }
  }

  const SLOT_SHORT = { pistol: 'BB-9', smg: 'SCORCH', rifle: 'AK', shotgun: 'BOOM', sniper: '.50' };

  // ARPG glass orb: dark vessel, liquid fill, specular glint
  function orb(x, y, r, frac, colTop, colBot, rim) {
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    g.fillStyle = 'rgba(8,10,16,0.88)';
    g.fillRect(x - r, y - r, r * 2, r * 2);
    const level = y + r - frac * r * 2;
    const lg = g.createLinearGradient(0, level, 0, y + r);
    lg.addColorStop(0, colTop); lg.addColorStop(1, colBot);
    g.fillStyle = lg;
    g.fillRect(x - r, level, r * 2, r * 2 * frac + 2);
    // liquid surface shimmer
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(x - r, level, r * 2, 2.5);
    // glass highlight
    const hg = g.createRadialGradient(x - r * 0.35, y - r * 0.45, 2, x - r * 0.35, y - r * 0.45, r * 0.9);
    hg.addColorStop(0, 'rgba(255,255,255,0.28)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
    g.lineWidth = 3.5;
    g.strokeStyle = rim;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.beginPath(); g.arc(x, y, r - 2.6, 0, TAU); g.stroke();
  }

  function cursorDesignPos() {
    const S = Game.S;
    const winW = window.innerWidth || DW, winH = window.innerHeight || DH;
    const fitW = Math.min(winW, winH * 16 / 9), fitH = fitW * 9 / 16;
    return {
      x: (S.cursor.sx - (winW - fitW) / 2) / fitW * DW,
      y: (S.cursor.sy - (winH - fitH) / 2) / fitH * DH,
    };
  }

  function drawHud(dt) {
    const S = Game.S, p = S.player;
    const sp = WEAPONS[p.weapon];
    const cx = DW / 2, cy = DH / 2;
    const scoped = false;

    // hovered enemy: nameplate + health bar over their head
    const hov = S.hoverEnemy;
    if (hov && !S.shopOpen) {
      const hp2 = Renderer.worldToScreen(hov.x, hov.y, 2.15 * hov.type.scale);
      if (hp2.visible) {
        const bw2 = hov.type.boss ? 130 : 84;
        panel(hp2.x - bw2 / 2 - 6, hp2.y - 24, bw2 + 12, 34, 6);
        label(hov.type.label + (hov.elite ? ' ★' : ''), hp2.x, hp2.y - 9, 11.5,
          hov.elite ? '#7fb4ff' : '#ffb0a0', 'center', 800);
        bar(hp2.x - bw2 / 2, hp2.y - 3, bw2, 6, Math.max(0, hov.hp / hov.maxHp), '#d43a3a');
      }
    }

    // cursor reticle: gold over ground, red brackets over an enemy
    if (!S.shopOpen && S.cursor.seen) {
      const c = cursorDesignPos();
      const spreadPx = 7 + sp.spread * 260;
      if (hov) {
        g.strokeStyle = 'rgba(255,90,70,0.95)'; g.lineWidth = 2.5;
        const b = spreadPx + 3, seg = 6;
        g.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          g.moveTo(c.x + sx * b, c.y + sy * b - sy * seg);
          g.lineTo(c.x + sx * b, c.y + sy * b);
          g.lineTo(c.x + sx * b - sx * seg, c.y + sy * b);
        }
        g.stroke();
      } else {
        g.strokeStyle = 'rgba(255,235,190,0.9)'; g.lineWidth = 2;
        g.beginPath(); g.arc(c.x, c.y, spreadPx, 0, TAU); g.stroke();
      }
      g.fillStyle = hov ? 'rgba(255,120,100,0.95)' : 'rgba(255,235,190,0.95)';
      g.fillRect(c.x - 1.5, c.y - 1.5, 3, 3);
      if (S.hitmarker > 0) {
        const col = S.hitmarkerKind === 'kill' ? 'rgba(255,60,60,0.95)'
          : S.hitmarkerKind === 'head' ? 'rgba(255,200,60,0.95)' : 'rgba(255,255,255,0.9)';
        g.strokeStyle = col; g.lineWidth = 3;
        const o = spreadPx + 3, l = 9;
        g.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          g.moveTo(c.x + sx * o, c.y + sy * o);
          g.lineTo(c.x + sx * (o + l), c.y + sy * (o + l));
        }
        g.stroke();
      }
    }

    // ---- bottom-left: HEALTH ORB + portrait
    const orbR = 54, oy = DH - 74;
    const hurt = S.time - p.lastHurt < 0.8 || p.hp < 30;
    orb(84, oy, orbR, Math.max(0, p.hp / p.maxHp),
      p.hp / p.maxHp > 0.35 ? '#c62b2b' : '#e34040', '#5e0a0a',
      hurt ? 'rgba(240,90,70,0.95)' : 'rgba(140,110,70,0.9)');
    label(`${Math.ceil(Math.max(0, p.hp))}`, 84, oy + 6, 21, '#fff', 'center', 800);
    // portrait medallion above the orb
    g.save();
    g.beginPath(); g.arc(84, oy - orbR - 26, 22, 0, TAU); g.clip();
    g.fillStyle = '#1c2028'; g.fillRect(62, oy - orbR - 48, 44, 44);
    g.imageSmoothingEnabled = true;
    g.drawImage(hurt ? portraitHurt : portraitOk, 62, oy - orbR - 48, 44, 44);
    g.restore();
    g.strokeStyle = hurt ? 'rgba(230,70,70,0.9)' : 'rgba(140,110,70,0.85)';
    g.lineWidth = 2.5;
    g.beginPath(); g.arc(84, oy - orbR - 26, 22, 0, TAU); g.stroke();

    // ---- bottom-right: ARMOR ORB
    orb(DW - 84, oy, orbR, Math.max(0, p.armor / CONFIG.MAX_ARMOR),
      '#3e78c8', '#0d2148', 'rgba(140,110,70,0.9)');
    label(p.armor > 0 ? `${Math.ceil(p.armor)}` : '—', DW - 84, oy + 6, 21,
      p.armor > 0 ? '#cfe2ff' : 'rgba(255,255,255,0.35)', 'center', 800);

    // ---- center-bottom: skill bar (weapons, grenade, ammo, XP)
    const barW = 470, bx0 = cx - barW / 2, by0 = DH - 78;
    panel(bx0, by0, barW, 62, 10);
    // XP strip along the top edge of the bar
    const nr = Game.nextRank(S.xp);
    if (nr) {
      const prev = RANKS.filter(r => r[0] <= S.xp).pop();
      bar(bx0 + 10, by0 - 7, barW - 20, 4, (S.xp - prev[0]) / (nr[0] - prev[0]), '#f6c945');
    }
    label(Game.rankFor(S.xp), cx, by0 - 12, 11.5, '#f6c945', 'center', 700);
    let sx0 = bx0 + 12;
    for (const wn of SLOT_ORDER) {
      const owned = p.owned[wn];
      const cur = p.weapon === wn;
      g.fillStyle = cur ? 'rgba(246,201,69,0.24)' : 'rgba(255,255,255,0.05)';
      g.strokeStyle = cur ? '#f6c945' : owned ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)';
      g.lineWidth = 2;
      g.beginPath(); g.roundRect(sx0, by0 + 10, 42, 42, 6); g.fill(); g.stroke();
      label(`${WEAPONS[wn].slot}`, sx0 + 6, by0 + 22, 10,
        owned ? '#f6c945' : 'rgba(255,255,255,0.25)', 'left', 800);
      label(SLOT_SHORT[wn], sx0 + 21, by0 + 40, 9.5,
        owned ? (cur ? '#fff' : 'rgba(255,255,255,0.7)') : 'rgba(255,255,255,0.2)', 'center', 700);
      sx0 += 48;
    }
    // grenade slot
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.strokeStyle = p.grenades > 0 ? 'rgba(159,208,106,0.7)' : 'rgba(255,255,255,0.12)';
    g.lineWidth = 2;
    g.beginPath(); g.roundRect(sx0, by0 + 10, 42, 42, 6); g.fill(); g.stroke();
    g.fillStyle = p.grenades > 0 ? '#9fd06a' : 'rgba(255,255,255,0.2)';
    g.beginPath(); g.arc(sx0 + 21, by0 + 27, 7, 0, TAU); g.fill();
    label(`×${p.grenades}`, sx0 + 21, by0 + 47, 10, 'rgba(255,255,255,0.8)', 'center', 800);
    sx0 += 52;
    // ammo readout
    const ammoStr = p.reloading > 0 ? 'REL' : `${p.ammo[p.weapon]}`;
    label(ammoStr, sx0 + 52, by0 + 34, p.reloading > 0 ? 15 : 24,
      p.ammo[p.weapon] === 0 && p.reloading <= 0 ? '#d43a3a' : '#fff', 'center', 800);
    label(`/ ${p.reserve[p.weapon]}`, sx0 + 52, by0 + 50, 11, 'rgba(255,255,255,0.55)', 'center', 700);
    if (p.reloading > 0)
      bar(bx0 + 10, by0 + 56, barW - 20, 3, 1 - p.reloading / (p.reloadTotal || sp.reload), '#f6c945');

    // top-left: cash / score / wave
    panel(24, 20, 210, 92, 12);
    label(`$${S.cash}`, 40, 50, 26, '#9fd06a', 'left', 800);
    label(`SCORE ${S.score}`, 40, 74, 14, '#fff', 'left', 700);
    if (S.multiplier > 1 && S.multTimer > 0)
      label(`×${S.multiplier.toFixed(2).replace(/\.?0+$/, '')}`, 160, 74, 13, '#f6c945', 'left', 800);
    let alive = 0;
    for (const e of S.enemies) if (!e.dead) alive++;
    label(`WAVE ${S.wave}`, 40, 98, 15, '#e67e22', 'left', 800);
    label(`✖ ${alive + S.toSpawn}`, 130, 98, 14, 'rgba(255,255,255,0.75)', 'left', 700);

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

    drawMinimap();

    // kill feed
    let fy = 190;
    for (const f of S.feed) {
      label(f.text, DW - 24, fy, 12.5, 'rgba(255,255,255,0.92)', 'right', 700, UI_FONT,
        Math.min(1, f.t));
      fy += 19;
    }

    // medals
    let my = cy - 60;
    for (const m of S.medals) {
      const age = m.max - m.t;
      const scaleIn = age < 0.12 ? 0.7 + (age / 0.12) * 0.3 : 1;
      g.save();
      g.translate(DW * 0.72, my);
      g.scale(scaleIn, scaleIn);
      label(m.label, 0, 0, 21, m.color, 'center', 800, BANNER_FONT, Math.min(1, m.t / 0.5));
      g.restore();
      my += 30;
    }

    // boss bar
    if (S.boss && !S.boss.dead) {
      const bw = 420;
      panel(cx - bw / 2, 56, bw, 34, 10);
      label(S.boss.type.label, cx, 71, 13, '#ff8a7f', 'center', 800);
      bar(cx - bw / 2 + 14, 76, bw - 28, 8, S.boss.hp / S.boss.maxHp, '#d43a3a');
    }

    // announcements
    if (S.announce) {
      const a = S.announce;
      const inT = Math.min(1, (a.max - a.t) / 0.18);
      const outT = Math.min(1, a.t / 0.35);
      const alpha = Math.min(inT, outT);
      const rise = (1 - inT) * 26;
      label(a.big, cx, DH * 0.3 + rise, 54, '#f6c945', 'center', 400, BANNER_FONT, alpha);
      if (a.small)
        label(a.small, cx, DH * 0.3 + 38 + rise, 20, '#fff', 'center', 700, UI_FONT, alpha);
    }
    if (S.intermission > 0 && !S.shopOpen) {
      label(`NEXT WAVE IN ${Math.ceil(S.intermission)}`, cx, 122, 20, '#7fd4ff', 'center', 800);
      label('TAB — SHOP', cx, 146, 13, 'rgba(255,255,255,0.7)', 'center', 700);
    }

    // damage direction arcs (screen-up is world angle -3π/4 under the iso cam)
    for (const arc of S.hurtArcs) {
      const rel = arc.angle + 3 * Math.PI / 4;
      g.save();
      g.translate(cx, cy);
      g.rotate(rel - Math.PI / 2);
      g.strokeStyle = `rgba(230,40,40,${Math.min(0.8, arc.t)})`;
      g.lineWidth = 9;
      g.beginPath(); g.arc(0, 0, 130, -0.4, 0.4); g.stroke();
      g.restore();
    }

    drawFloaters();

    // vignette / flashes
    const beat = p.hp < 35 ? (Math.sin(S.time * 6) * 0.5 + 0.5) * 0.15 : 0;
    const hurtA = Math.max(0, 1 - p.hp / 55) * 0.5
      + Math.max(0, 0.8 - (S.time - p.lastHurt)) * 0.4 + beat;
    if (hurtA > 0.02) {
      const vg = g.createRadialGradient(cx, cy, DH * 0.3, cx, cy, DH * 0.72);
      vg.addColorStop(0, 'rgba(150,0,0,0)');
      vg.addColorStop(1, `rgba(150,0,0,${Math.min(0.85, hurtA)})`);
      g.fillStyle = vg; g.fillRect(0, 0, DW, DH);
    }
    if (S.flash > 0) {
      g.fillStyle = `rgba(255,240,200,${S.flash * 0.6})`;
      g.fillRect(0, 0, DW, DH);
    }
    if (S.screenFlash) {
      g.fillStyle = `rgba(${S.screenFlash.color},${Math.min(1, S.screenFlash.a)})`;
      g.fillRect(0, 0, DW, DH);
    }

    if (S.shopOpen) drawShop();
  }

  function drawShop() {
    const S = Game.S;
    g.fillStyle = 'rgba(6,8,12,0.82)';
    g.fillRect(0, 0, DW, DH);
    label('THE SCHOOL STORE', DW / 2, 96, 42, '#f6c945', 'center', 400, BANNER_FONT);
    label(`CASH  $${S.cash}`, DW / 2, 128, 18, '#9fd06a', 'center', 800);
    const items = Game.shopItems();
    const cols = 3, cw = 330, chh = 96, gap = 18;
    const total = Math.ceil(items.length / cols);
    const x0 = DW / 2 - (cols * cw + (cols - 1) * gap) / 2;
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
    label('PRESS NUMBER TO BUY  ·  TAB TO CLOSE', DW / 2, y0 + total * (chh + gap) + 26,
      14, 'rgba(255,255,255,0.7)', 'center', 700);
  }

  // ------------------------------------------------------- frame entry
  let fps = 0, fpsT = 0, fpsN = 0;
  function render(dt) {
    const S = Game.S;
    g.clearRect(0, 0, W, H);
    if (S.mode === 'menu' || !S.player) return;

    g.save();
    g.scale(uiScale, uiScale);
    drawHud(dt);
    g.restore();

    if (S.mode === 'dead') {
      g.fillStyle = 'rgba(30,0,0,0.35)';
      g.fillRect(0, 0, W, H);
    }
    if (S.debug) {
      fpsN++; fpsT += dt;
      if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
      const rs = Renderer.stats();
      g.save();
      g.scale(uiScale, uiScale);
      label(`${fps} FPS · ${rs.W}×${rs.H}`, DW - 16, DH - 8, 12, '#7fd4ff', 'right', 700);
      g.restore();
    }
  }

  return { render, setSize, onRunStart };
})();
