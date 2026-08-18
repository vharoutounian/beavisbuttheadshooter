// All art is generated at runtime on offscreen canvases — no image files.
export const Textures = (() => {
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  const ctxOf = c => c.getContext('2d');

  // Art is authored in design units and rendered at 2x for crisp display.
  const TEXR = 4;
  function hiRes(w, h, draw) {
    const c = mk(w * TEXR, h * TEXR);
    const g = ctxOf(c);
    g.scale(TEXR, TEXR);
    g.lineJoin = 'round';
    draw(g);
    return c;
  }

  // ================================================================ walls
  const TS = 64;                 // design size; canvases are TS*TEXR square

  // faded striped wallpaper with water stains and scuffs
  const wallpaper = () => hiRes(TS, TS, g => {
    g.fillStyle = '#a89a78'; g.fillRect(0, 0, TS, TS);
    for (let x = 0; x < TS; x += 8) {
      g.fillStyle = (x / 8) % 2 ? '#9d8f6e' : '#a89a78';
      g.fillRect(x, 0, 8, TS);
      g.fillStyle = 'rgba(120,100,60,0.35)';
      g.fillRect(x + 3, 0, 1.4, TS);
    }
    // water stain blooming down from the top
    const st = g.createRadialGradient(46, 4, 2, 46, 4, 22);
    st.addColorStop(0, 'rgba(110,85,45,0.4)');
    st.addColorStop(1, 'rgba(110,85,45,0)');
    g.fillStyle = st; g.fillRect(24, 0, 40, 30);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 20; i++) g.fillRect((i * 13) % TS, 40 + (i * 7) % 22, 3, 1.6);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 60, TS, 4);   // scuffed base
  });

  // honey-brown wood paneling, the classic den look
  const paneling = () => hiRes(TS, TS, g => {
    g.fillStyle = '#6a4a28'; g.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 4; i++) {
      const x = i * 16;
      const grad = g.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, '#7d5a34'); grad.addColorStop(0.5, '#71512e');
      grad.addColorStop(1, '#634624');
      g.fillStyle = grad; g.fillRect(x + 1, 0, 14, TS);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x, 0, 1.4, TS);
      // wavy wood grain
      g.strokeStyle = 'rgba(60,38,16,0.35)'; g.lineWidth = 0.8;
      for (let s = 0; s < 3; s++) {
        g.beginPath();
        g.moveTo(x + 4 + s * 4, 0);
        for (let y = 0; y <= TS; y += 8)
          g.lineTo(x + 4 + s * 4 + Math.sin((y + i * 9 + s * 5) * 0.4) * 1.6, y);
        g.stroke();
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, TS, 2);
  });

  // greasy old kitchen tile
  const kitchenTile = () => hiRes(TS, TS, g => {
    g.fillStyle = '#b8b09a'; g.fillRect(0, 0, TS, TS);
    for (let y = 0; y < TS; y += 16)
      for (let x = 0; x < TS; x += 16) {
        g.fillStyle = ((x + y) / 16) % 2 ? '#cfc7ae' : '#c3bba4';
        g.fillRect(x + 1, y + 1, 14, 14);
        g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 1, y + 1, 14, 2);
      }
    g.fillStyle = 'rgba(90,60,20,0.22)';                          // grease film
    g.fillRect(0, 26, TS, 12);
    for (let i = 0; i < 10; i++) {
      g.fillStyle = `rgba(80,50,15,${0.1 + (i % 3) * 0.06})`;
      g.fillRect((i * 19) % TS, (i * 23) % TS, 4, 3);
    }
  });

  // cracked powder-blue bathroom tile
  const bathTile = () => hiRes(TS, TS, g => {
    g.fillStyle = '#7d99a0'; g.fillRect(0, 0, TS, TS);
    for (let y = 0; y < TS; y += 8)
      for (let x = 0; x < TS; x += 8) {
        g.fillStyle = ((x + y) / 8) % 2 ? '#a8c4ca' : '#9cb8be';
        g.fillRect(x + 0.5, y + 0.5, 7, 7);
      }
    g.strokeStyle = 'rgba(40,50,55,0.5)'; g.lineWidth = 1;         // crack
    g.beginPath(); g.moveTo(12, 6); g.lineTo(20, 22); g.lineTo(16, 38); g.stroke();
    g.fillStyle = 'rgba(120,90,40,0.2)'; g.fillRect(0, 56, TS, 8); // grime line
  });

  // sagging bookshelf crammed with junk
  const bookshelf = () => hiRes(TS, TS, g => {
    g.fillStyle = '#4a3018'; g.fillRect(0, 0, TS, TS);
    const spines = ['#8a3030', '#33538a', '#7a7030', '#54406a', '#356048', '#96622a'];
    for (let row = 0; row < 4; row++) {
      const y = 4 + row * 15;
      g.fillStyle = '#2c1c0c'; g.fillRect(2, y, 60, 12);
      let x = 3;
      let k = row * 7;
      while (x < 58) {
        const w = 3 + ((k * 13) % 4);
        const h = 9 + ((k * 7) % 3);
        g.fillStyle = spines[k % spines.length];
        g.fillRect(x, y + 12 - h, w, h);
        g.fillStyle = 'rgba(255,255,255,0.14)';
        g.fillRect(x, y + 12 - h, w, 1);
        x += w + 1; k++;
      }
      g.fillStyle = '#5c3d20'; g.fillRect(2, y + 12, 60, 3);       // shelf lip
    }
  });

  // the front door: kicked-at, boarded, and chained
  const frontDoor = () => hiRes(TS, TS, g => {
    g.fillStyle = '#4a3826'; g.fillRect(0, 0, TS, TS);
    const grad = g.createLinearGradient(6, 0, 58, 0);
    grad.addColorStop(0, '#7a5a36'); grad.addColorStop(0.5, '#6c4e2c');
    grad.addColorStop(1, '#5c4224');
    g.fillStyle = grad; g.fillRect(5, 2, 54, 60);
    g.strokeStyle = '#3a2a16'; g.lineWidth = 2; g.strokeRect(5, 2, 54, 60);
    g.strokeRect(11, 8, 18, 22); g.strokeRect(35, 8, 18, 22);     // door panels
    g.strokeRect(11, 36, 18, 20); g.strokeRect(35, 36, 18, 20);
    g.fillStyle = '#c8b06a'; g.beginPath(); g.arc(31, 40, 2.4, 0, 7); g.fill();
    // nailed board across, crooked
    g.save(); g.translate(32, 22); g.rotate(-0.18);
    g.fillStyle = '#8a6a40'; g.fillRect(-30, -4, 60, 8);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-30, 2.5, 60, 1.5);
    g.fillStyle = '#2a2a2e';
    g.fillRect(-25, -1.5, 2, 3); g.fillRect(23, -1.5, 2, 3);
    g.restore();
    // splintered kick damage at the latch
    g.strokeStyle = 'rgba(30,20,10,0.8)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(54, 44); g.lineTo(46, 40); g.moveTo(54, 48); g.lineTo(44, 47);
    g.stroke();
  });

  // boarded-up window, night showing through the gaps
  const boardedWindow = () => hiRes(TS, TS, g => {
    g.fillStyle = '#a89a78'; g.fillRect(0, 0, TS, TS);
    for (let x = 0; x < TS; x += 8) {
      g.fillStyle = (x / 8) % 2 ? '#9d8f6e' : '#a89a78';
      g.fillRect(x, 0, 8, TS);
    }
    g.fillStyle = '#3a2c18'; g.fillRect(6, 6, 52, 46);            // frame
    g.fillStyle = '#101a30'; g.fillRect(10, 10, 44, 38);          // night glass
    g.fillStyle = 'rgba(160,190,240,0.3)';                        // moon glint
    g.beginPath(); g.moveTo(10, 44); g.lineTo(34, 10); g.lineTo(42, 10);
    g.lineTo(16, 48); g.closePath(); g.fill();
    g.fillStyle = '#3a2c18'; g.fillRect(30, 10, 4, 38);           // mullion
    // planks nailed over it
    for (const [ty, rot] of [[18, 0.12], [34, -0.1]]) {
      g.save(); g.translate(32, ty); g.rotate(rot);
      g.fillStyle = '#7c5c34'; g.fillRect(-30, -4.5, 60, 9);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(-30, 3, 60, 1.5);
      g.fillStyle = '#26262a';
      g.fillRect(-26, -1.5, 2, 3); g.fillRect(24, -1.5, 2, 3);
      g.restore();
    }
    g.fillStyle = '#8a7c5c'; g.fillRect(4, 52, 56, 5);            // sill
  });

  function darken(src, amt) {
    const c = mk(src.width, src.height), g = ctxOf(c);
    g.drawImage(src, 0, 0);
    g.fillStyle = `rgba(0,0,0,${amt})`;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  const walls = [null, wallpaper(), paneling(), kitchenTile(), bathTile(), bookshelf(), frontDoor(), boardedWindow()];
  const wallsDark = walls.map(w => w ? darken(w, 0.32) : null);

  // ====================================================== floor & ceiling
  function floorTile() {
    const c = mk(TS, TS), g = ctxOf(c);
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        g.fillStyle = (x + y) % 2 ? '#8d7a5e' : '#a18d6d';
        g.fillRect(x * 32, y * 32, 32, 32);
      }
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, 0, TS, 1.5); g.fillRect(0, 32, TS, 1.5);
    g.fillRect(0, 0, 1.5, TS); g.fillRect(32, 0, 1.5, TS);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.05 + (i % 5) * 0.02})`;
      g.fillRect((i * 23) % TS, (i * 41) % TS, 2, 2);
    }
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 10; i++) g.fillRect((i * 29) % TS, (i * 17) % TS, 3, 1);
    return c;
  }
  function ceilTile(light) {
    const c = mk(TS, TS), g = ctxOf(c);
    g.fillStyle = '#2c3038'; g.fillRect(0, 0, TS, TS);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(0, 0, TS, 2); g.fillRect(0, 0, 2, TS);
    g.fillStyle = '#343a44'; g.fillRect(4, 4, 56, 56);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(4 + (i * 19) % 56, 4 + (i * 31) % 56, 2, 2);
    }
    if (light) {
      const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      grad.addColorStop(0, '#fff7dd'); grad.addColorStop(0.55, '#e8dcae');
      grad.addColorStop(1, '#3a4048');
      g.fillStyle = grad; g.fillRect(8, 12, 48, 40);
      g.strokeStyle = '#1c1f24'; g.lineWidth = 2; g.strokeRect(8, 12, 48, 40);
      g.beginPath(); g.moveTo(32, 12); g.lineTo(32, 52); g.stroke();
    }
    return c;
  }
  function imageData(c) {
    const g = ctxOf(c);
    return g.getImageData(0, 0, c.width, c.height);
  }
  const floorData = imageData(floorTile());
  const ceilData = imageData(ceilTile(false));
  const ceilLightData = imageData(ceilTile(true));

  // ================================================================ goons
  // 96x144 canvas; feet on y=140. Frame set per type:
  //   walk[4], attack[2] (windup, strike), pain, death[3]
  function goon(o) {
    const frames = { walk: [], attack: [], pain: null, death: [] };

    function base(draw) {
      const c = mk(96 * TEXR, 144 * TEXR), g = ctxOf(c);
      g.scale(TEXR, TEXR);
      g.lineJoin = 'round'; g.lineCap = 'round';
      draw(g);
      return c;
    }

    function legs(g, phase) {
      // phase: -1 left fwd, 0 neutral, 1 right fwd
      const spread = 7 * Math.abs(phase), lift = phase;
      g.fillStyle = o.pants;
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
      const ly = 92, lh = 44;
      g.fillRect(33 - spread * (lift < 0 ? 1 : 0.2), ly, 12, lh);
      g.strokeRect(33 - spread * (lift < 0 ? 1 : 0.2), ly, 12, lh);
      g.fillRect(51 + spread * (lift > 0 ? 1 : 0.2), ly, 12, lh);
      g.strokeRect(51 + spread * (lift > 0 ? 1 : 0.2), ly, 12, lh);
      g.fillStyle = '#1d1d22';
      g.fillRect(30 - spread * (lift < 0 ? 1 : 0.2), ly + lh - 4, 17, 8);
      g.fillRect(49 + spread * (lift > 0 ? 1 : 0.2), ly + lh - 4, 17, 8);
    }

    function torso(g) {
      g.fillStyle = o.shirt;
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(28, 48); g.lineTo(68, 48);
      g.quadraticCurveTo(72, 70, 66, 96);
      g.lineTo(30, 96);
      g.quadraticCurveTo(24, 70, 28, 48);
      g.closePath(); g.fill(); g.stroke();
      if (o.jacket) {
        g.fillStyle = o.jacket;
        g.beginPath(); g.moveTo(28, 48); g.lineTo(38, 48); g.lineTo(36, 96); g.lineTo(30, 96);
        g.quadraticCurveTo(24, 70, 28, 48); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(68, 48); g.lineTo(58, 48); g.lineTo(60, 96); g.lineTo(66, 96);
        g.quadraticCurveTo(72, 70, 68, 48); g.fill(); g.stroke();
      }
      if (o.sash) {
        g.fillStyle = o.sash;
        g.save(); g.translate(48, 70); g.rotate(-0.5);
        g.fillRect(-30, -6, 60, 12); g.restore();
      }
      if (o.tie) {
        g.fillStyle = o.tie;
        g.beginPath(); g.moveTo(44, 48); g.lineTo(52, 48); g.lineTo(50, 76); g.lineTo(48, 80);
        g.lineTo(46, 76); g.closePath(); g.fill(); g.stroke();
      }
      if (o.logo) {
        g.fillStyle = o.logo; g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
        g.fillText(o.logoText || 'ROCK', 48, 72);
      }
      if (o.armor) {
        g.fillStyle = '#3a424e';
        g.fillRect(31, 52, 34, 32);
        g.strokeRect(31, 52, 34, 32);
        g.fillStyle = '#525e6e';
        g.fillRect(34, 55, 28, 6); g.fillRect(34, 64, 28, 6); g.fillRect(34, 73, 28, 6);
      }
    }

    function headAt(g, cx, cy, tilt = 0, painFace = false) {
      g.save(); g.translate(cx, cy); g.rotate(tilt);
      g.fillStyle = o.skin;
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, 0, 17, 19, 0, 0, 7); g.fill(); g.stroke();
      // hair
      g.fillStyle = o.hairColor || '#3c2a12';
      if (o.hair === 'mohawk') {
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          g.moveTo(-8 + i * 5, -14); g.lineTo(-6 + i * 5, -30); g.lineTo(-3 + i * 5, -14);
        }
        g.fill(); g.stroke();
      } else if (o.hair === 'flat') {
        g.beginPath(); g.ellipse(0, -9, 17, 11, 0, Math.PI, 0); g.fill();
      } else if (o.hair === 'cap') {
        g.beginPath(); g.ellipse(0, -8, 17, 11, 0, Math.PI, 0); g.fill();
        g.fillRect(-17, -8, 34, 5);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-17, -8, 34, 2);
      } else if (o.hair === 'backcap') {
        g.beginPath(); g.ellipse(0, -8, 17, 11, 0, Math.PI, 0); g.fill();
        g.fillRect(-24, -10, 14, 6);      // backwards bill
      } else if (o.hair === 'buzz') {
        g.beginPath(); g.ellipse(0, -10, 16, 8, 0, Math.PI, 0); g.fill();
      } else if (o.hair === 'combover') {
        g.beginPath(); g.ellipse(0, -9, 15, 7, 0, Math.PI, 0); g.fill();
        g.fillRect(-15, -9, 5, 8);
      }
      if (o.helmet) {
        g.fillStyle = '#39424e';
        g.beginPath(); g.ellipse(0, -6, 18, 13, 0, Math.PI, 0); g.fill(); g.stroke();
        g.fillRect(-18, -7, 36, 4);
      }
      // face
      if (painFace) {
        g.strokeStyle = '#222'; g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(-10, -2); g.lineTo(-4, 3); g.moveTo(-4, -2); g.lineTo(-10, 3);
        g.moveTo(4, -2); g.lineTo(10, 3); g.moveTo(10, -2); g.lineTo(4, 3);
        g.stroke();
        g.fillStyle = '#5c2020';
        g.beginPath(); g.ellipse(0, 10, 5, 6, 0, 0, 7); g.fill();
      } else {
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(-7, 0, 4.5, 0, 7); g.arc(7, 0, 4.5, 0, 7); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.4;
        g.beginPath(); g.arc(-7, 0, 4.5, 0, 7); g.stroke();
        g.beginPath(); g.arc(7, 0, 4.5, 0, 7); g.stroke();
        g.fillStyle = '#151515';
        g.beginPath(); g.arc(-6.5, 0.6, 2, 0, 7); g.arc(7.5, 0.6, 2, 0, 7); g.fill();
        g.strokeStyle = '#3a2415'; g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(-12, -6); g.lineTo(-3, -4); g.moveTo(12, -6); g.lineTo(3, -4);
        g.stroke();
        g.beginPath(); g.moveTo(-7, 11); g.quadraticCurveTo(0, 7, 7, 11); g.stroke();
        if (o.red) {           // coach's furious flush
          g.fillStyle = 'rgba(210,60,40,0.28)';
          g.beginPath(); g.ellipse(0, 4, 15, 13, 0, 0, 7); g.fill();
        }
      }
      g.restore();
    }

    function armStraight(g, sx, sy, ex, ey, w = 9) {
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.fillStyle = o.sleeves || o.shirt;
      const a = Math.atan2(ey - sy, ex - sx), len = Math.hypot(ex - sx, ey - sy);
      g.save(); g.translate(sx, sy); g.rotate(a);
      g.fillRect(0, -w / 2, len * 0.55, w); g.strokeRect(0, -w / 2, len * 0.55, w);
      g.fillStyle = o.skin;
      g.fillRect(len * 0.5, -w / 2 + 1, len * 0.5, w - 2);
      g.strokeRect(len * 0.5, -w / 2 + 1, len * 0.5, w - 2);
      g.restore();
    }

    function weaponAt(g, cx, cy, mode) {
      if (o.weapon === 'gun') {
        g.fillStyle = '#23262b';
        g.strokeStyle = '#0d0e10'; g.lineWidth = 2;
        g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#0c0d10';
        g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill();
      } else if (o.weapon === 'board' && mode === 'up') {
        g.save(); g.translate(cx, cy - 26); g.rotate(-0.1);
        g.fillStyle = '#c8583a';
        g.beginPath(); g.roundRect(-30, -7, 60, 14, 7); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#f2e9c9';
        g.beginPath(); g.arc(-18, 9, 4, 0, 7); g.arc(18, 9, 4, 0, 7); g.fill();
        g.restore();
      }
    }

    // ---- walk frames
    const phases = [-1, 0, 1, 0];
    for (let f = 0; f < 4; f++) {
      frames.walk.push(base(g => {
        legs(g, phases[f]);
        torso(g);
        const sw = phases[f] * 4;
        armStraight(g, 30, 52, 20 - sw, 86);
        armStraight(g, 66, 52, 76 + sw, 86);
        if (o.weapon === 'gun') {
          g.fillStyle = '#23262b'; g.fillRect(66 + sw, 80, 18, 7);
        }
        if (o.weapon === 'board') {
          g.save(); g.translate(16 - sw, 84); g.rotate(1.35);
          g.fillStyle = '#c8583a';
          g.beginPath(); g.roundRect(-26, -6, 52, 12, 6); g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2; g.stroke();
          g.restore();
        }
        headAt(g, 48, 26, phases[f] * 0.04);
      }));
    }

    // ---- attack frames
    frames.attack.push(base(g => {          // windup / aim
      legs(g, 0);
      torso(g);
      if (o.melee) {
        armStraight(g, 30, 52, 14, 30);
        armStraight(g, 66, 52, 82, 30);
        weaponAt(g, 48, 30, 'up');
      } else {
        armStraight(g, 30, 52, 38, 66);
        armStraight(g, 66, 52, 58, 66);
        weaponAt(g, 48, 66);
      }
      headAt(g, 48, 26, 0);
    }));
    frames.attack.push(base(g => {          // strike / fire
      legs(g, 0);
      torso(g);
      if (o.melee) {
        armStraight(g, 30, 52, 24, 78);
        armStraight(g, 66, 52, 72, 78);
        if (o.weapon === 'board') {
          g.save(); g.translate(48, 84); g.rotate(0.05);
          g.fillStyle = '#c8583a';
          g.beginPath(); g.roundRect(-32, -7, 64, 14, 7); g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2; g.stroke();
          g.restore();
        }
      } else {
        armStraight(g, 30, 52, 38, 64);
        armStraight(g, 66, 52, 58, 64);
        weaponAt(g, 48, 64);
      }
      headAt(g, 48, 27, 0);
    }));

    // ---- pain
    frames.pain = base(g => {
      legs(g, 0);
      g.save(); g.translate(0, 3);
      torso(g);
      armStraight(g, 30, 52, 12, 44);
      armStraight(g, 66, 52, 84, 44);
      headAt(g, 46, 26, -0.12, true);
      g.restore();
    });

    // ---- death: stagger, toppling, down
    frames.death.push(base(g => {
      g.save(); g.translate(4, 6); g.rotate(0.1);
      legs(g, 1);
      torso(g);
      armStraight(g, 30, 52, 10, 40);
      armStraight(g, 66, 52, 86, 48);
      headAt(g, 44, 27, -0.25, true);
      g.restore();
    }));
    frames.death.push(base(g => {
      g.save(); g.translate(48, 110); g.rotate(0.9); g.translate(-48, -96);
      legs(g, 0);
      torso(g);
      armStraight(g, 30, 52, 16, 36);
      armStraight(g, 66, 52, 84, 40);
      headAt(g, 46, 26, -0.3, true);
      g.restore();
    }));
    frames.death.push(base(g => {           // flat on the floor
      g.save(); g.translate(6, 0);
      g.fillStyle = o.pants;
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
      g.fillRect(8, 124, 34, 11); g.strokeRect(8, 124, 34, 11);
      g.fillStyle = o.shirt;
      g.fillRect(40, 122, 30, 14); g.strokeRect(40, 122, 30, 14);
      g.fillStyle = o.skin;
      g.beginPath(); g.ellipse(78, 128, 11, 9, 0.2, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#222'; g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(74, 125); g.lineTo(78, 128); g.moveTo(78, 125); g.lineTo(74, 128);
      g.moveTo(80, 125); g.lineTo(84, 128); g.moveTo(84, 125); g.lineTo(80, 128);
      g.stroke();
      g.restore();
    }));

    return frames;
  }

  const GOON_LOOKS = {
    poser: {
      skin: '#e8bd85', shirt: '#22242a', logo: '#b3b8c2', logoText: 'DÖKK',
      pants: '#3a4048', hair: 'mohawk', hairColor: '#2ecc40', melee: true, weapon: 'claws',
    },
    skater: {
      skin: '#e5c08e', shirt: '#7a3b8f', pants: '#4a4038',
      hair: 'backcap', hairColor: '#c0392b', melee: true, weapon: 'board',
    },
    jock: {
      skin: '#e0b184', shirt: '#f0ead8', jacket: '#a02c2c', pants: '#2c3e6b',
      hair: 'flat', hairColor: '#3a2a14', weapon: 'gun',
    },
    monitor: {
      skin: '#e8c090', shirt: '#c4b489', sash: '#e8a020', pants: '#54462c',
      hair: 'cap', hairColor: '#31517a', weapon: 'gun',
    },
    coach: {
      skin: '#e0a684', shirt: '#8b8f96', pants: '#6b6f76',
      hair: 'buzz', hairColor: '#d8d3c8', melee: true, weapon: 'claws', red: true,
    },
    principal: {
      skin: '#dfc09a', shirt: '#3c3c46', jacket: '#2a2a33', tie: '#7a2020',
      pants: '#22222a', hair: 'combover', hairColor: '#9a9a9a', weapon: 'gun',
    },
  };

  const enemySprites = {}, enemySpritesElite = {};
  for (const k of Object.keys(GOON_LOOKS)) {
    enemySprites[k] = goon(GOON_LOOKS[k]);
    if (k !== 'principal' && k !== 'coach')
      enemySpritesElite[k] = goon({ ...GOON_LOOKS[k], armor: true, helmet: true });
  }

  function tintFrames(set, color, alpha) {
    const out = { walk: [], attack: [], pain: null, death: [] };
    const tint = src => {
      const c = mk(src.width, src.height), g = ctxOf(c);
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = alpha;
      g.fillStyle = color;
      g.fillRect(0, 0, c.width, c.height);
      return c;
    };
    out.walk = set.walk.map(tint);
    out.attack = set.attack.map(tint);
    out.pain = tint(set.pain);
    out.death = set.death.map(tint);
    return out;
  }
  const enemySpritesPain = {}, enemySpritesElitePain = {};
  for (const k of Object.keys(enemySprites))
    enemySpritesPain[k] = tintFrames(enemySprites[k], '#ff4040', 0.5);
  for (const k of Object.keys(enemySpritesElite))
    enemySpritesElitePain[k] = tintFrames(enemySpritesElite[k], '#ff4040', 0.5);

  // ============================================================== pickups
  const pickupAmmo = () => hiRes(48, 48, g => {
    g.fillStyle = '#4a5a30'; g.fillRect(5, 15, 38, 26);
    g.fillStyle = '#3a4826'; g.fillRect(5, 15, 38, 7);
    g.strokeStyle = '#20281a'; g.lineWidth = 2; g.strokeRect(5, 15, 38, 26);
    g.fillStyle = '#d8cf7a'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center';
    g.fillText('AMMO', 24, 34);
    g.fillStyle = '#8a8054'; g.fillRect(9, 17, 6, 3); g.fillRect(33, 17, 6, 3);
  });
  const pickupNachos = () => hiRes(48, 48, g => {
    g.fillStyle = '#c0392b';
    g.beginPath(); g.moveTo(6, 26); g.lineTo(42, 26); g.lineTo(38, 42); g.lineTo(10, 42);
    g.closePath(); g.fill();
    g.strokeStyle = '#7c2418'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#f6c945';
    for (let i = 0; i < 8; i++) {
      const x = 8 + i * 4.4, y = 24 - (i % 3) * 5;
      g.beginPath(); g.moveTo(x, y + 9); g.lineTo(x + 4.5, y); g.lineTo(x + 9, y + 9);
      g.closePath(); g.fill();
      g.strokeStyle = '#c79018'; g.lineWidth = 1; g.stroke();
    }
    g.fillStyle = '#e67e22'; g.fillRect(10, 28, 28, 4);
  });
  const pickupGrenade = () => hiRes(48, 48, g => {
    g.fillStyle = '#3f5f3f';
    g.beginPath(); g.ellipse(24, 28, 11, 13, 0, 0, 7); g.fill();
    g.strokeStyle = '#243924'; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.moveTo(13, 28); g.lineTo(35, 28); g.moveTo(24, 15); g.lineTo(24, 41); g.stroke();
    g.fillStyle = '#777'; g.fillRect(19, 9, 10, 7);
    g.fillStyle = '#c9a227'; g.fillRect(29, 7, 9, 4);
  });
  const pickupArmor = () => hiRes(48, 48, g => {
    g.fillStyle = '#3d5f8f';
    g.beginPath();
    g.moveTo(10, 12); g.lineTo(38, 12); g.lineTo(40, 30);
    g.quadraticCurveTo(38, 42, 24, 44); g.quadraticCurveTo(10, 42, 8, 30);
    g.closePath(); g.fill();
    g.strokeStyle = '#1e3652'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#5b82b8';
    g.fillRect(13, 16, 22, 5); g.fillRect(13, 24, 22, 5); g.fillRect(15, 32, 18, 5);
  });
  const pickups = {
    ammo: pickupAmmo(), nachos: pickupNachos(),
    grenade: pickupGrenade(), armor: pickupArmor(),
  };

  // =========================================================== viewmodels
  // Drawn as seen from behind. tip = muzzle flash anchor; sight = the pixel
  // that must land on screen center at full ADS.
  function vmPistol(sleeve) {
    const w = 360, h = 300;
    const c = mk(w * TEXR, h * TEXR), g = ctxOf(c);
    g.scale(TEXR, TEXR);
    g.lineJoin = 'round';
    g.fillStyle = sleeve; g.fillRect(150, 218, 80, 82);
    g.fillStyle = '#e8bd85'; g.fillRect(156, 180, 66, 52);
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2;
    g.strokeRect(156, 180, 66, 52);
    g.fillStyle = '#55350f'; g.fillRect(168, 168, 42, 40);       // grip
    const grad = g.createLinearGradient(160, 0, 220, 0);
    grad.addColorStop(0, '#3a3e46'); grad.addColorStop(0.5, '#2b2e34'); grad.addColorStop(1, '#1e2126');
    g.fillStyle = grad;
    g.fillRect(164, 70, 50, 104);                                 // slide
    g.strokeStyle = '#101216'; g.lineWidth = 2.5; g.strokeRect(164, 70, 50, 104);
    g.fillStyle = '#15171b'; g.fillRect(164, 118, 50, 12);        // serration band
    g.fillStyle = '#43474f';
    for (let i = 0; i < 6; i++) g.fillRect(168 + i * 8, 119, 4, 10);
    g.fillStyle = '#101216'; g.fillRect(172, 52, 34, 22);         // muzzle block
    g.fillStyle = '#000';
    g.beginPath(); g.arc(189, 62, 8, 0, 7); g.fill();
    // sights: rear notch posts + front post
    g.fillStyle = '#0c0e11';
    g.fillRect(168, 66, 8, 12); g.fillRect(202, 66, 8, 12);       // rear posts
    g.fillRect(185, 46, 8, 14);                                    // front post
    g.fillStyle = '#5fd46a'; g.fillRect(187, 48, 4, 4);            // tritium dot
    return { c, w, h, tipX: 189, tipY: 46, sightX: 189, sightY: 50 };
  }
  function vmSmg(sleeve) {
    const w = 400, h = 300;
    const c = mk(w * TEXR, h * TEXR), g = ctxOf(c);
    g.scale(TEXR, TEXR);
    g.lineJoin = 'round';
    g.fillStyle = sleeve; g.fillRect(96, 216, 84, 84);            // support arm
    g.fillStyle = '#e8bd85'; g.fillRect(104, 182, 62, 48);
    g.fillStyle = sleeve; g.fillRect(238, 224, 84, 76);
    g.fillStyle = '#e8bd85'; g.fillRect(244, 194, 58, 44);
    g.fillStyle = '#23262c';
    g.fillRect(140, 100, 96, 84);                                  // receiver block
    g.strokeStyle = '#101216'; g.lineWidth = 2.5; g.strokeRect(140, 100, 96, 84);
    g.fillStyle = '#1a1d22'; g.fillRect(158, 60, 46, 46);          // upper + barrel shroud
    g.strokeRect(158, 60, 46, 46);
    g.fillStyle = '#000'; g.beginPath(); g.arc(181, 72, 8, 0, 7); g.fill();
    g.fillStyle = '#30343b';
    for (let i = 0; i < 3; i++) g.fillRect(162, 66 + i * 12, 38, 5); // vent slots
    g.fillStyle = '#15171b'; g.fillRect(150, 184, 34, 62);         // mag in front grip
    g.strokeRect(150, 184, 34, 62);
    g.fillStyle = '#2b2e34'; g.fillRect(150, 184, 34, 8);
    // sights
    g.fillStyle = '#0c0e11';
    g.fillRect(146, 88, 8, 14); g.fillRect(216, 88, 8, 14);
    g.fillRect(177, 50, 8, 16);
    g.fillStyle = '#ffcf4a'; g.fillRect(179, 52, 4, 4);
    return { c, w, h, tipX: 181, tipY: 52, sightX: 181, sightY: 55 };
  }
  function vmRifle(sleeve) {
    const w = 420, h = 310;
    const c = mk(w * TEXR, h * TEXR), g = ctxOf(c);
    g.scale(TEXR, TEXR);
    g.lineJoin = 'round';
    g.fillStyle = sleeve; g.fillRect(84, 224, 86, 86);
    g.fillStyle = '#e8bd85'; g.fillRect(92, 190, 62, 48);
    g.fillStyle = sleeve; g.fillRect(268, 230, 86, 80);
    g.fillStyle = '#e8bd85'; g.fillRect(274, 198, 58, 46);
    const wood = g.createLinearGradient(150, 0, 240, 0);
    wood.addColorStop(0, '#6d4517'); wood.addColorStop(0.5, '#5a370f'); wood.addColorStop(1, '#472a08');
    g.fillStyle = wood;
    g.fillRect(154, 140, 84, 100);                                 // wood handguard
    g.strokeStyle = '#2c1c06'; g.lineWidth = 2.5; g.strokeRect(154, 140, 84, 100);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(154, 156, 84, 6); g.fillRect(154, 176, 84, 6);
    g.fillStyle = '#2c2f35'; g.fillRect(168, 56, 56, 90);          // gas block + barrel
    g.strokeStyle = '#101216'; g.strokeRect(168, 56, 56, 90);
    g.fillStyle = '#1b1d21'; g.fillRect(178, 34, 36, 28);
    g.fillStyle = '#000'; g.beginPath(); g.arc(196, 48, 8, 0, 7); g.fill();
    g.fillStyle = wood;                                            // curved mag
    g.beginPath();
    g.moveTo(178, 238); g.quadraticCurveTo(158, 288, 194, 292);
    g.lineTo(222, 280); g.quadraticCurveTo(206, 250, 214, 238);
    g.closePath(); g.fill();
    g.strokeStyle = '#2c1c06'; g.stroke();
    // AK post-in-ring front sight
    g.fillStyle = '#0c0e11';
    g.fillRect(172, 100, 8, 16); g.fillRect(212, 100, 8, 16);      // rear wings
    g.strokeStyle = '#0c0e11'; g.lineWidth = 5;
    g.beginPath(); g.arc(196, 38, 15, 0, 7); g.stroke();           // front ring
    g.fillRect(193, 26, 6, 18);                                     // post
    return { c, w, h, tipX: 196, tipY: 24, sightX: 196, sightY: 36 };
  }
  function vmShotgun(sleeve) {
    const w = 420, h = 310;
    const c = mk(w * TEXR, h * TEXR), g = ctxOf(c);
    g.scale(TEXR, TEXR);
    g.lineJoin = 'round';
    g.fillStyle = sleeve; g.fillRect(92, 210, 90, 100);
    g.fillStyle = '#e8bd85'; g.fillRect(100, 174, 64, 52);
    g.fillStyle = sleeve; g.fillRect(264, 226, 88, 84);
    g.fillStyle = '#e8bd85'; g.fillRect(270, 196, 58, 46);
    const wood = g.createLinearGradient(150, 0, 250, 0);
    wood.addColorStop(0, '#54330e'); wood.addColorStop(1, '#3b2206');
    g.fillStyle = wood; g.fillRect(158, 150, 86, 96);              // stock body
    g.strokeStyle = '#241503'; g.lineWidth = 2.5; g.strokeRect(158, 150, 86, 96);
    g.fillStyle = '#2c2f35'; g.fillRect(166, 42, 70, 112);         // twin barrels block
    g.strokeStyle = '#101216'; g.strokeRect(166, 42, 70, 112);
    g.fillStyle = '#000';
    g.beginPath(); g.arc(185, 56, 10, 0, 7); g.arc(217, 56, 10, 0, 7); g.fill();
    g.strokeStyle = '#43474f'; g.lineWidth = 2;
    g.beginPath(); g.arc(185, 56, 10, 0, 7); g.stroke();
    g.beginPath(); g.arc(217, 56, 10, 0, 7); g.stroke();
    g.fillStyle = wood; g.fillRect(160, 132, 82, 22);              // pump
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 5; i++) g.fillRect(164 + i * 16, 134, 8, 18);
    g.fillStyle = '#d8c15a';                                       // brass bead
    g.beginPath(); g.arc(201, 40, 4, 0, 7); g.fill();
    return { c, w, h, tipX: 201, tipY: 42, sightX: 201, sightY: 42 };
  }
  function vmSniper(sleeve) {
    const w = 420, h = 310;
    const c = mk(w * TEXR, h * TEXR), g = ctxOf(c);
    g.scale(TEXR, TEXR);
    g.lineJoin = 'round';
    g.fillStyle = sleeve; g.fillRect(88, 220, 88, 90);
    g.fillStyle = '#e8bd85'; g.fillRect(96, 186, 62, 48);
    g.fillStyle = sleeve; g.fillRect(268, 228, 86, 82);
    g.fillStyle = '#e8bd85'; g.fillRect(274, 196, 58, 46);
    g.fillStyle = '#233324'; g.fillRect(160, 150, 82, 96);         // olive body
    g.strokeStyle = '#101510'; g.lineWidth = 2.5; g.strokeRect(160, 150, 82, 96);
    g.fillStyle = '#1a1d22'; g.fillRect(178, 40, 46, 116);         // heavy barrel
    g.strokeStyle = '#0b0d10'; g.strokeRect(178, 40, 46, 116);
    g.fillStyle = '#000'; g.beginPath(); g.arc(201, 52, 9, 0, 7); g.fill();
    g.fillStyle = '#15171b';                                       // muzzle brake
    g.fillRect(172, 40, 58, 18);
    g.fillStyle = '#2b2e34';
    g.fillRect(176, 44, 8, 10); g.fillRect(218, 44, 8, 10);
    // the big scope tube
    g.fillStyle = '#101319';
    g.beginPath(); g.ellipse(201, 118, 34, 26, 0, 0, 7); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 3; g.stroke();
    const lens = g.createRadialGradient(195, 112, 3, 201, 118, 25);
    lens.addColorStop(0, '#9fd4ff'); lens.addColorStop(0.5, '#2a5f8f'); lens.addColorStop(1, '#0a1520');
    g.fillStyle = lens;
    g.beginPath(); g.ellipse(201, 118, 26, 19, 0, 0, 7); g.fill();
    g.fillStyle = '#0f1115'; g.fillRect(150, 108, 22, 20);         // side turret
    g.fillStyle = '#23262b'; g.fillRect(230, 108, 22, 20);
    g.fillStyle = '#2b2e34'; g.fillRect(252, 168, 26, 14);         // bolt handle
    g.beginPath(); g.arc(280, 175, 9, 0, 7); g.fill();
    return { c, w, h, tipX: 201, tipY: 42, sightX: 201, sightY: 118 };
  }
  function viewmodels(sleeve) {
    return {
      pistol: vmPistol(sleeve), smg: vmSmg(sleeve), rifle: vmRifle(sleeve),
      shotgun: vmShotgun(sleeve), sniper: vmSniper(sleeve),
    };
  }

  // ============================================================== overlays
  function makeScope(W, H) {
    const c = mk(W, H), g = ctxOf(c);
    const cx = W / 2, cy = H / 2, r = H * 0.42;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
    const rim = g.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
    rim.addColorStop(0, 'rgba(20,40,60,0)');
    rim.addColorStop(0.92, 'rgba(10,20,35,0.35)');
    rim.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = rim;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 6;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    // reticle
    g.strokeStyle = 'rgba(10,10,10,0.95)'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - r, cy); g.lineTo(cx + r, cy);
    g.moveTo(cx, cy - r); g.lineTo(cx, cy + r);
    g.stroke();
    g.fillStyle = 'rgba(10,10,10,0.95)';
    for (let i = 1; i <= 4; i++) {           // mil dots
      g.beginPath();
      g.arc(cx + i * 40, cy, 2.5, 0, 7); g.arc(cx - i * 40, cy, 2.5, 0, 7);
      g.arc(cx, cy + i * 40, 2.5, 0, 7); g.arc(cx, cy - i * 40, 2.5, 0, 7);
      g.fill();
    }
    return c;
  }

  function muzzleFlash(size) {
    const c = mk(size, size), g = ctxOf(c);
    const h = size / 2;
    const grad = g.createRadialGradient(h, h, size * 0.04, h, h, h * 0.96);
    grad.addColorStop(0, 'rgba(255,255,225,0.95)');
    grad.addColorStop(0.35, 'rgba(255,195,70,0.85)');
    grad.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      const r = i % 2 ? h * 0.4 : h * 0.96;
      g.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    return c;
  }

  function shadowBlob() {
    const c = mk(96, 32), g = ctxOf(c);
    const grad = g.createRadialGradient(48, 16, 2, 48, 16, 44);
    grad.addColorStop(0, 'rgba(0,0,0,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(48, 16, 46, 14, 0, 0, 7); g.fill();
    return c;
  }

  function bulletHole() {
    const c = mk(22, 22), g = ctxOf(c);
    g.fillStyle = 'rgba(20,16,12,0.9)';
    g.beginPath(); g.ellipse(11, 11, 4.5, 4, 0.3, 0, 7); g.fill();
    g.strokeStyle = 'rgba(60,52,44,0.8)'; g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(11, 11); g.lineTo(3, 7); g.moveTo(11, 11); g.lineTo(19, 6);
    g.moveTo(11, 11); g.lineTo(17, 18); g.moveTo(11, 11); g.lineTo(4, 16);
    g.stroke();
    g.fillStyle = 'rgba(90,80,70,0.5)';
    g.beginPath(); g.arc(7, 8, 1.4, 0, 7); g.arc(16, 14, 1.2, 0, 7); g.fill();
    return c;
  }

  return {
    walls, wallsDark,
    floorData, ceilData, ceilLightData,
    enemySprites, enemySpritesElite, enemySpritesPain, enemySpritesElitePain,
    pickups, viewmodels, makeScope,
    muzzle: muzzleFlash(256), muzzleSmall: muzzleFlash(160),
    shadow: shadowBlob(), bulletHole: bulletHole(),
  };
})();
