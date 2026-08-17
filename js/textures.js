// All art is generated at runtime on offscreen canvases — no image files.
const Textures = (() => {
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  const ctxOf = c => c.getContext('2d');

  // ---------------------------------------------------------------- walls
  const TS = 64;

  function brick() {
    const c = mk(TS, TS), g = ctxOf(c);
    g.fillStyle = '#7a4a3a'; g.fillRect(0, 0, TS, TS);
    g.fillStyle = '#8f5945';
    for (let row = 0; row < 8; row++) {
      const off = (row % 2) * 8;
      for (let col = -1; col < 4; col++) {
        g.fillRect(col * 16 + off + 1, row * 8 + 1, 14, 6);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 40; i++) g.fillRect((i * 13) % TS, (i * 29) % TS, 2, 2);
    return c;
  }

  function lockers() {
    const c = mk(TS, TS), g = ctxOf(c);
    g.fillStyle = '#3d5a63'; g.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 4; i++) {
      const x = i * 16;
      g.fillStyle = '#4d707c'; g.fillRect(x + 1, 2, 14, 60);
      g.fillStyle = '#33505a';
      for (let v = 0; v < 3; v++) g.fillRect(x + 4, 8 + v * 4, 8, 2);   // vents
      g.fillRect(x + 4, 40, 8, 2);
      g.fillStyle = '#222';
      g.fillRect(x + 11, 26, 3, 5);                                     // latch
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 60, TS, 4);
    return c;
  }

  function chalkboard() {
    const c = mk(TS, TS), g = ctxOf(c);
    g.fillStyle = '#caa87c'; g.fillRect(0, 0, TS, TS);            // classroom wall
    g.fillStyle = '#6b4a2f'; g.fillRect(4, 10, 56, 40);           // frame
    g.fillStyle = '#2e4d3a'; g.fillRect(7, 13, 50, 34);           // board
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
    g.beginPath();                                                 // scrawl
    g.moveTo(12, 22); g.lineTo(24, 22); g.moveTo(12, 30); g.lineTo(40, 30);
    g.moveTo(12, 38); g.lineTo(30, 38); g.moveTo(44, 20); g.lineTo(52, 26);
    g.moveTo(52, 20); g.lineTo(44, 26);
    g.stroke();
    g.fillStyle = '#f5f0e0'; g.fillRect(10, 48, 10, 2);           // chalk
    return c;
  }

  function gymMetal() {
    const c = mk(TS, TS), g = ctxOf(c);
    g.fillStyle = '#5c6066'; g.fillRect(0, 0, TS, TS);
    g.fillStyle = '#6b7078';
    for (let y = 0; y < TS; y += 16) g.fillRect(0, y, TS, 12);
    g.fillStyle = '#41454b';
    for (let y = 12; y < TS; y += 16) g.fillRect(0, y, TS, 4);
    g.fillStyle = '#33363b';
    for (let y = 6; y < TS; y += 16)
      for (let x = 6; x < TS; x += 12) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
    return c;
  }

  function darken(src, amt) {
    const c = mk(src.width, src.height), g = ctxOf(c);
    g.drawImage(src, 0, 0);
    g.fillStyle = `rgba(0,0,0,${amt})`;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  const walls = [null, brick(), lockers(), chalkboard(), gymMetal()];
  const wallsDark = walls.map(w => w ? darken(w, 0.35) : null);

  // ---------------------------------------------------------------- faces
  function drawBeavisFace(g, s) {
    const u = s / 100;
    g.save(); g.scale(u, u);
    g.fillStyle = '#1c2a4a'; g.fillRect(22, 78, 56, 22);                 // blue shirt
    g.fillStyle = '#eec584';                                             // head
    g.beginPath(); g.ellipse(50, 55, 24, 28, 0, 0, 7); g.fill();
    g.fillStyle = '#f7d94c';                                             // spiky hair
    g.beginPath(); g.moveTo(26, 46);
    for (let i = 0; i <= 6; i++) {
      const x = 26 + i * 8;
      g.lineTo(x + 4, 12 + (i % 2) * 6); g.lineTo(x + 8, 34);
    }
    g.lineTo(74, 46); g.closePath(); g.fill();
    g.strokeStyle = '#caa437'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#eec584'; g.fillRect(30, 40, 40, 10);                 // brow ridge
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(32, 46); g.lineTo(46, 44);                   // brows
    g.moveTo(54, 44); g.lineTo(68, 46); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(41, 52, 5, 6, 0, 0, 7); g.ellipse(59, 52, 5, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#222';
    g.beginPath(); g.arc(41, 53, 2, 0, 7); g.arc(59, 53, 2, 0, 7); g.fill();
    g.fillStyle = '#d9a860';                                             // pointy nose
    g.beginPath(); g.moveTo(50, 54); g.lineTo(57, 64); g.lineTo(48, 66); g.closePath(); g.fill();
    g.fillStyle = '#b5854e';                                             // underbite grin
    g.beginPath(); g.moveTo(36, 72); g.quadraticCurveTo(50, 66, 66, 72);
    g.quadraticCurveTo(52, 84, 36, 78); g.closePath(); g.fill();
    g.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) g.fillRect(39 + i * 5.4, 72 + (i % 2), 4, 5);
    g.restore();
  }

  function drawButtheadFace(g, s) {
    const u = s / 100;
    g.save(); g.scale(u, u);
    g.fillStyle = '#555'; g.fillRect(20, 80, 60, 20);                    // gray shirt
    g.fillStyle = '#e3b877';                                             // head
    g.beginPath(); g.ellipse(50, 56, 26, 29, 0, 0, 7); g.fill();
    g.fillStyle = '#6e4423';                                             // parted hair
    g.beginPath(); g.moveTo(24, 46);
    g.quadraticCurveTo(28, 14, 47, 16); g.lineTo(48, 34); g.lineTo(52, 34);
    g.lineTo(53, 16); g.quadraticCurveTo(72, 14, 76, 46);
    g.quadraticCurveTo(64, 36, 50, 38); g.quadraticCurveTo(36, 36, 24, 46);
    g.closePath(); g.fill();
    g.fillStyle = '#fff';                                                // droopy eyes
    g.beginPath(); g.ellipse(40, 50, 6, 6, 0, 0, 7); g.ellipse(60, 50, 6, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#e3b877'; g.fillRect(33, 42, 34, 6);                  // lids
    g.fillStyle = '#222';
    g.beginPath(); g.arc(40, 52, 2, 0, 7); g.arc(60, 52, 2, 0, 7); g.fill();
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(33, 44); g.lineTo(47, 43);
    g.moveTo(53, 43); g.lineTo(67, 44); g.stroke();
    g.fillStyle = '#c99555';                                             // big nose
    g.beginPath(); g.ellipse(50, 62, 8, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#8a5a30';
    g.beginPath(); g.arc(46, 64, 1.7, 0, 7); g.arc(54, 64, 1.7, 0, 7); g.fill();
    g.fillStyle = '#b5854e';                                             // braces grin
    g.beginPath(); g.moveTo(34, 74); g.quadraticCurveTo(50, 70, 66, 74);
    g.quadraticCurveTo(52, 86, 34, 80); g.closePath(); g.fill();
    g.fillStyle = '#ddd'; g.fillRect(38, 74, 24, 6);
    g.strokeStyle = '#888'; g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 5; i++) { g.moveTo(40 + i * 5, 74); g.lineTo(40 + i * 5, 80); }
    g.moveTo(38, 77); g.lineTo(62, 77); g.stroke();
    g.restore();
  }

  function portrait(who, size) {
    const c = mk(size, size), g = ctxOf(c);
    (who === 'beavis' ? drawBeavisFace : drawButtheadFace)(g, size);
    return c;
  }

  // ------------------------------------------------------------- enemies
  // Front-facing cartoon goon, 64x96. Frames: walk0, walk1, attack.
  function dude(opts) {
    const frames = [];
    for (let f = 0; f < 3; f++) {
      const c = mk(64, 96), g = ctxOf(c);
      const legSwing = f === 0 ? 4 : f === 1 ? -4 : 0;
      // legs
      g.fillStyle = opts.pants;
      g.fillRect(22 + legSwing, 66, 8, 28);
      g.fillRect(34 - legSwing, 66, 8, 28);
      g.fillStyle = '#222';
      g.fillRect(20 + legSwing, 90, 12, 6);
      g.fillRect(32 - legSwing, 90, 12, 6);
      // torso
      g.fillStyle = opts.shirt;
      g.fillRect(18, 38, 28, 30);
      if (opts.jacket) {
        g.fillStyle = opts.jacket;
        g.fillRect(18, 38, 7, 30); g.fillRect(39, 38, 7, 30);
      }
      if (opts.sash) {
        g.fillStyle = opts.sash;
        g.save(); g.translate(32, 52); g.rotate(-0.5); g.fillRect(-20, -4, 40, 8); g.restore();
      }
      // arms
      g.fillStyle = opts.skin;
      if (f === 2) {
        // attack: both hands pushed toward the viewer holding the weapon
        g.fillRect(14, 44, 8, 12); g.fillRect(42, 44, 8, 12);
        if (opts.gun) {
          g.fillStyle = '#23262b';
          g.beginPath(); g.arc(32, 52, 7, 0, 7); g.fill();     // barrel at viewer
          g.fillStyle = '#0c0d10';
          g.beginPath(); g.arc(32, 52, 3.2, 0, 7); g.fill();
        } else {
          g.fillStyle = opts.skin;                              // claws up
          g.fillRect(10, 30, 8, 16); g.fillRect(46, 30, 8, 16);
        }
      } else {
        g.fillRect(12, 42, 7, 22); g.fillRect(45, 42, 7, 22);
        if (opts.gun) {
          g.fillStyle = '#23262b';
          g.fillRect(40, 58, 14, 6);
        }
      }
      // head
      g.fillStyle = opts.skin;
      g.beginPath(); g.ellipse(32, 22, 13, 15, 0, 0, 7); g.fill();
      // hair / hat
      g.fillStyle = opts.hairColor || '#4a3018';
      if (opts.hair === 'mohawk') {
        g.fillRect(28, 2, 8, 12);
      } else if (opts.hair === 'flat') {
        g.beginPath(); g.ellipse(32, 13, 13, 8, 0, Math.PI, 0); g.fill();
      } else if (opts.hair === 'cap') {
        g.beginPath(); g.ellipse(32, 12, 13, 8, 0, Math.PI, 0); g.fill();
        g.fillRect(19, 12, 30, 4);
      } else if (opts.hair === 'combover') {
        g.beginPath(); g.ellipse(32, 12, 12, 5, 0, Math.PI, 0); g.fill();
        g.fillRect(20, 12, 5, 6);
      }
      // face
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(27, 21, 3.4, 0, 7); g.arc(37, 21, 3.4, 0, 7); g.fill();
      g.fillStyle = '#111';
      g.beginPath(); g.arc(27, 22, 1.5, 0, 7); g.arc(37, 22, 1.5, 0, 7); g.fill();
      g.strokeStyle = '#5a3a20'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(23, 16); g.lineTo(30, 18);
      g.moveTo(41, 16); g.lineTo(34, 18); g.stroke();          // angry brows
      g.beginPath(); g.moveTo(26, 30); g.quadraticCurveTo(32, 26, 38, 30); g.stroke(); // frown
      frames.push(c);
    }
    return frames;
  }

  const enemySprites = {
    poser: dude({ skin: '#e8bd85', shirt: '#3a7d44', pants: '#333',
                  hair: 'mohawk', hairColor: '#2ecc40', gun: false }),
    jock: dude({ skin: '#e0b184', shirt: '#f2f2f2', jacket: '#b03030', pants: '#28407a',
                 hair: 'flat', hairColor: '#3a2a14', gun: true }),
    monitor: dude({ skin: '#e8c090', shirt: '#c8b98a', sash: '#e8a020', pants: '#5a4a30',
                    hair: 'cap', hairColor: '#3a5070', gun: true }),
    principal: dude({ skin: '#dfc09a', shirt: '#4a4a55', jacket: '#33333c', pants: '#26262e',
                      hair: 'combover', hairColor: '#8a8a8a', gun: true }),
  };

  // red-tinted copies shown for a beat when an enemy takes a hit
  function tinted(src, color, alpha) {
    const c = mk(src.width, src.height), g = ctxOf(c);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  const enemySpritesPain = {};
  for (const k of Object.keys(enemySprites))
    enemySpritesPain[k] = enemySprites[k].map(f => tinted(f, '#ff4040', 0.55));

  // ------------------------------------------------------------- pickups
  function pickupAmmo() {
    const c = mk(40, 40), g = ctxOf(c);
    g.fillStyle = '#4a5a30'; g.fillRect(4, 12, 32, 22);
    g.fillStyle = '#333d1e'; g.fillRect(4, 12, 32, 5);
    g.fillStyle = '#d8cf7a'; g.font = 'bold 9px sans-serif';
    g.textAlign = 'center'; g.fillText('AMMO', 20, 28);
    g.strokeStyle = '#222'; g.strokeRect(4, 12, 32, 22);
    return c;
  }
  function pickupNachos() {
    const c = mk(40, 40), g = ctxOf(c);
    g.fillStyle = '#c0392b'; g.fillRect(6, 22, 28, 12);        // basket
    g.fillStyle = '#f6c945';                                    // chips
    for (let i = 0; i < 7; i++) {
      const x = 8 + i * 4, y = 20 - (i % 3) * 4;
      g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + 4, y); g.lineTo(x + 8, y + 8);
      g.closePath(); g.fill();
      g.strokeStyle = '#c79018'; g.stroke();
    }
    g.fillStyle = '#e67e22'; g.fillRect(10, 24, 20, 3);         // cheese
    return c;
  }
  function pickupGrenade() {
    const c = mk(40, 40), g = ctxOf(c);
    g.fillStyle = '#3f5f3f';
    g.beginPath(); g.ellipse(20, 24, 9, 11, 0, 0, 7); g.fill();
    g.fillStyle = '#777'; g.fillRect(16, 10, 8, 5);
    g.fillStyle = '#c9a227'; g.fillRect(24, 8, 8, 3);
    g.strokeStyle = '#243924';
    g.beginPath(); g.moveTo(11, 24); g.lineTo(29, 24); g.moveTo(20, 14); g.lineTo(20, 34); g.stroke();
    return c;
  }
  const pickups = { ammo: pickupAmmo(), nachos: pickupNachos(), grenade: pickupGrenade() };

  // ---------------------------------------------------------- viewmodels
  // Big first-person weapon sprites, drawn as seen from behind the gun.
  function vmPistol(sleeve) {
    const c = mk(300, 240), g = ctxOf(c);
    g.fillStyle = sleeve; g.fillRect(120, 170, 70, 70);           // arm
    g.fillStyle = '#e8bd85'; g.fillRect(128, 140, 54, 44);        // hand
    g.fillStyle = '#2e3138';
    g.fillRect(132, 60, 46, 90);                                  // slide/body
    g.fillStyle = '#1d2025'; g.fillRect(140, 40, 30, 26);         // muzzle block
    g.fillStyle = '#0d0e10'; g.beginPath(); g.arc(155, 52, 8, 0, 7); g.fill();
    g.fillStyle = '#43474f'; g.fillRect(132, 108, 46, 10);        // ejection line
    g.fillStyle = '#55350f'; g.fillRect(140, 150, 30, 30);        // grip peek
    return { c, tipX: 155, tipY: 46 };
  }
  function vmRifle(sleeve) {
    const c = mk(360, 260), g = ctxOf(c);
    g.fillStyle = sleeve; g.fillRect(60, 190, 70, 70);            // support arm
    g.fillStyle = '#e8bd85'; g.fillRect(70, 160, 52, 44);
    g.fillStyle = sleeve; g.fillRect(230, 190, 70, 70);           // trigger arm
    g.fillStyle = '#e8bd85'; g.fillRect(238, 168, 48, 40);
    g.fillStyle = '#5d3a15'; g.fillRect(150, 120, 60, 110);       // wood body
    g.fillStyle = '#3a2408'; g.fillRect(150, 120, 60, 14);
    g.fillStyle = '#2c2f35'; g.fillRect(160, 40, 40, 90);         // upper + barrel
    g.fillStyle = '#1b1d21'; g.fillRect(168, 24, 24, 24);
    g.fillStyle = '#0d0e10'; g.beginPath(); g.arc(180, 36, 7, 0, 7); g.fill();
    g.fillStyle = '#41454c'; g.fillRect(152, 96, 56, 8);          // sight bar
    g.fillStyle = '#5d3a15';                                       // curved mag
    g.beginPath(); g.moveTo(166, 228); g.quadraticCurveTo(150, 258, 176, 258);
    g.lineTo(196, 250); g.quadraticCurveTo(188, 232, 194, 228); g.closePath(); g.fill();
    return { c, tipX: 180, tipY: 30 };
  }
  function vmShotgun(sleeve) {
    const c = mk(360, 260), g = ctxOf(c);
    g.fillStyle = sleeve; g.fillRect(70, 180, 74, 80);            // pump arm
    g.fillStyle = '#e8bd85'; g.fillRect(80, 150, 54, 46);
    g.fillStyle = sleeve; g.fillRect(230, 190, 70, 70);
    g.fillStyle = '#e8bd85'; g.fillRect(238, 168, 48, 40);
    g.fillStyle = '#432a10'; g.fillRect(148, 130, 64, 100);       // stock body
    g.fillStyle = '#2c2f35'; g.fillRect(158, 34, 44, 100);        // twin barrel block
    g.fillStyle = '#0d0e10';
    g.beginPath(); g.arc(170, 44, 8, 0, 7); g.arc(190, 44, 8, 0, 7); g.fill();
    g.fillStyle = '#5d3a15'; g.fillRect(150, 118, 60, 18);        // pump
    g.fillStyle = '#3a2408'; g.fillRect(150, 118, 60, 5);
    return { c, tipX: 180, tipY: 38 };
  }
  function viewmodels(sleeve) {
    return { pistol: vmPistol(sleeve), rifle: vmRifle(sleeve), shotgun: vmShotgun(sleeve) };
  }

  function muzzleFlash() {
    const c = mk(96, 96), g = ctxOf(c);
    const grad = g.createRadialGradient(48, 48, 4, 48, 48, 46);
    grad.addColorStop(0, 'rgba(255,255,220,0.95)');
    grad.addColorStop(0.4, 'rgba(255,190,60,0.8)');
    grad.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const r = i % 2 ? 20 : 46;
      g.lineTo(48 + Math.cos(a) * r, 48 + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    return c;
  }

  return {
    walls, wallsDark, portrait, enemySprites, enemySpritesPain, pickups, viewmodels,
    muzzle: muzzleFlash(),
  };
})();
