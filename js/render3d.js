// The 3D engine: bright stylized WebGL rendering (three.js) — real geometry,
// chunky characters, sun + shadows, sky, fog, and bloom. Gameplay stays on
// the 2D grid in game.js; this module visualizes Game.S and answers hitscans.
const Renderer = (() => {
  const canvas = document.getElementById('game');
  const DW = 1280, DH = 720;
  const WALL_H = 1.3;              // world meters per wall tile height
  const EYE = h => h * WALL_H;     // gameplay eye units (0..1) -> meters

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance',
  });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.05, 90);
  camera.rotation.order = 'YXZ';

  // ------------------------------------------------------------- sizing
  let W = 1280, H = 720, renderScale = 1;
  let composer = null, bloomPass = null;
  function setSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth || DW, cssH = window.innerHeight || DH;
    const fitH = Math.min(cssH, cssW * 9 / 16);
    H = Math.max(540, Math.min(1440, Math.round(fitH * dpr * renderScale)));
    W = Math.round(H * 16 / 9);
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    camera.aspect = 16 / 9;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setSize(W, H);
      bloomPass.setSize(W / 2, H / 2);
    }
    if (typeof Hud !== 'undefined') Hud.setSize();
  }
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setSize, 150);
  });

  // dynamic resolution: drop internal res if the GPU can't hold frame rate
  let frameAcc = 0, frameN = 0, resTimer = 0;
  function tuneResolution(dt) {
    frameAcc += dt; frameN++; resTimer += dt;
    if (resTimer < 2.5) return;
    const avg = frameAcc / Math.max(1, frameN);
    frameAcc = 0; frameN = 0; resTimer = 0;
    if (avg > 0.022 && renderScale > 0.5) {
      renderScale = Math.max(0.5, renderScale - 0.15);
      setSize();
    } else if (avg < 0.014 && renderScale < 1) {
      renderScale = Math.min(1, renderScale + 0.15);
      setSize();
    }
  }

  // ------------------------------------------------------------ helpers
  const texCache = new Map();
  function canvasTex(c, repeatX = 1, repeatY = 1) {
    let t = texCache.get(c);
    if (!t) {
      t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.anisotropy = 4;
      texCache.set(c, t);
    }
    return t;
  }
  // solid colors are authored in sRGB; convert so they stay punchy through
  // the linear pipeline + sRGB output
  const lambert = opts => {
    const m = new THREE.MeshLambertMaterial(opts);
    if (opts && opts.color !== undefined) m.color.convertSRGBToLinear();
    return m;
  };

  // ------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x9a8a6a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.25);
  sun.position.set(GameMap.W / 2 + 14, 26, GameMap.H / 2 - 18);
  sun.target.position.set(GameMap.W / 2, 0, GameMap.H / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const span = Math.max(GameMap.W, GameMap.H) * 0.72;
  sun.shadow.camera.left = -span; sun.shadow.camera.right = span;
  sun.shadow.camera.top = span; sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 4; sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0004;
  scene.add(sun); scene.add(sun.target);

  // muzzle flash light rides with the camera
  const muzzleLight = new THREE.PointLight(0xffc866, 0, 7, 2);
  scene.add(muzzleLight);

  // ---------------------------------------------------------------- sky
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4; skyCanvas.height = 128;
  {
    const sg = skyCanvas.getContext('2d');
    const grad = sg.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#3f8fe0');
    grad.addColorStop(0.55, '#8ec8f2');
    grad.addColorStop(0.78, '#cfe8f8');
    grad.addColorStop(1, '#e8f2e2');
    sg.fillStyle = grad; sg.fillRect(0, 0, 4, 128);
  }
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.encoding = THREE.sRGBEncoding;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(70, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  sky.position.set(GameMap.W / 2, 0, GameMap.H / 2);
  scene.add(sky);
  scene.fog = new THREE.Fog(0xcfe4f2, 26, 60);

  // puffy billboard clouds
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = cloudCanvas.height = 128;
  {
    const cg = cloudCanvas.getContext('2d');
    for (const [x, y, r] of [[40, 70, 26], [64, 58, 30], [90, 70, 24], [64, 76, 28]]) {
      const rad = cg.createRadialGradient(x, y, 2, x, y, r);
      rad.addColorStop(0, 'rgba(255,255,255,0.95)');
      rad.addColorStop(1, 'rgba(255,255,255,0)');
      cg.fillStyle = rad;
      cg.beginPath(); cg.arc(x, y, r, 0, 7); cg.fill();
    }
  }
  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.85, fog: false, depthWrite: false,
    }));
    const scale = 7 + Math.random() * 8;
    s.scale.set(scale, scale * 0.5, 1);
    s.position.set(Math.random() * 80 - 20, 13 + Math.random() * 8, Math.random() * 70 - 18);
    s.userData.drift = 0.12 + Math.random() * 0.2;
    scene.add(s);
    clouds.push(s);
  }

  // --------------------------------------------------------------- level
  const wallMeshes = [];    // for hitscan
  {
    // count tiles per texture id, then one instanced mesh per wall type
    const byType = new Map();
    for (let y = 0; y < GameMap.H; y++)
      for (let x = 0; x < GameMap.W; x++) {
        const t = GameMap.grid[y][x];
        if (t > 0) {
          if (!byType.has(t)) byType.set(t, []);
          byType.get(t).push([x, y]);
        }
      }
    const box = new THREE.BoxGeometry(1, WALL_H, 1);
    const m4 = new THREE.Matrix4();
    for (const [t, cells] of byType) {
      const mat = lambert({ map: canvasTex(Textures.walls[t]) });
      const inst = new THREE.InstancedMesh(box, mat, cells.length);
      cells.forEach(([x, y], i) => {
        m4.makeTranslation(x + 0.5, WALL_H / 2, y + 0.5);
        inst.setMatrixAt(i, m4);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = true;
      inst.receiveShadow = true;
      scene.add(inst);
      wallMeshes.push(inst);
    }
  }
  let floor = null;
  function floorTexture() {
    // brighter, cleaner tile floor for the sunlit look
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const fg = c.getContext('2d');
    fg.fillStyle = '#cdb98f'; fg.fillRect(0, 0, 128, 128);
    fg.fillStyle = '#c0ab80'; fg.fillRect(0, 0, 64, 64); fg.fillRect(64, 64, 64, 64);
    fg.fillStyle = 'rgba(0,0,0,0.16)';
    fg.fillRect(0, 0, 128, 3); fg.fillRect(0, 64, 128, 3);
    fg.fillRect(0, 0, 3, 128); fg.fillRect(64, 0, 3, 128);
    fg.fillStyle = 'rgba(255,255,255,0.1)';
    fg.fillRect(4, 4, 56, 4); fg.fillRect(68, 68, 56, 4);
    for (let i = 0; i < 30; i++) {
      fg.fillStyle = `rgba(0,0,0,${0.04 + (i % 4) * 0.02})`;
      fg.fillRect((i * 37) % 128, (i * 53) % 128, 3, 3);
    }
    return c;
  }
  {
    const t = canvasTex(floorTexture(), GameMap.W, GameMap.H);
    floor = new THREE.Mesh(new THREE.PlaneGeometry(GameMap.W, GameMap.H), lambert({ map: t }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(GameMap.W / 2, 0, GameMap.H / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    wallMeshes.push(floor);
  }

  // ------------------------------------------------------------- goons 3D
  const FACE_LOOKS = {
    poser: { skin: '#e8bd85', brow: '#2a4d20' },
    skater: { skin: '#e5c08e', brow: '#5a2020' },
    jock: { skin: '#e0b184', brow: '#3a2a14' },
    monitor: { skin: '#e8c090', brow: '#31517a' },
    coach: { skin: '#e0a684', brow: '#555', red: true },
    principal: { skin: '#dfc09a', brow: '#666' },
  };
  const BODY_LOOKS = {
    poser: { shirt: 0x23252c, pants: 0x3a4048, hair: 0x2ecc40, hairStyle: 'mohawk', weapon: null, board: false },
    skater: { shirt: 0x8a42a0, pants: 0x4a4038, hair: 0xc0392b, hairStyle: 'backcap', weapon: null, board: true },
    jock: { shirt: 0xf0ead8, pants: 0x2c3e6b, hair: 0x3a2a14, hairStyle: 'flat', weapon: 0x23262b, jacket: 0xb03030 },
    monitor: { shirt: 0xc4b489, pants: 0x54462c, hair: 0x31517a, hairStyle: 'cap', weapon: 0x23262b, sash: 0xe8a020 },
    coach: { shirt: 0x8b8f96, pants: 0x6b6f76, hair: 0xd8d3c8, hairStyle: 'buzz', weapon: null },
    principal: { shirt: 0x3c3c46, pants: 0x22222a, hair: 0x9a9a9a, hairStyle: 'combover', weapon: 0x23262b, tie: 0x7a2020 },
  };

  const faceTexOf = new Map();
  function faceTexture(typeName) {
    if (faceTexOf.has(typeName)) return faceTexOf.get(typeName);
    const look = FACE_LOOKS[typeName];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const fg = c.getContext('2d');
    fg.fillStyle = look.skin; fg.fillRect(0, 0, 128, 128);
    if (look.red) {
      fg.fillStyle = 'rgba(220,70,40,0.3)'; fg.fillRect(0, 40, 128, 88);
    }
    fg.fillStyle = '#fff';
    fg.beginPath(); fg.arc(42, 58, 15, 0, 7); fg.arc(86, 58, 15, 0, 7); fg.fill();
    fg.fillStyle = '#151515';
    fg.beginPath(); fg.arc(45, 61, 6.5, 0, 7); fg.arc(83, 61, 6.5, 0, 7); fg.fill();
    fg.strokeStyle = look.brow; fg.lineWidth = 8; fg.lineCap = 'round';
    fg.beginPath();
    fg.moveTo(26, 38); fg.lineTo(54, 46);
    fg.moveTo(102, 38); fg.lineTo(74, 46);
    fg.stroke();
    fg.strokeStyle = 'rgba(60,30,10,0.85)'; fg.lineWidth = 6;
    fg.beginPath(); fg.moveTo(46, 98); fg.quadraticCurveTo(64, 86, 82, 98); fg.stroke();
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    faceTexOf.set(typeName, t);
    return t;
  }

  // shared geometries
  const G = {
    leg: new THREE.BoxGeometry(0.15, 0.42, 0.15).translate(0, -0.21, 0),
    torso: new THREE.BoxGeometry(0.36, 0.36, 0.22),
    arm: new THREE.BoxGeometry(0.1, 0.38, 0.1).translate(0, -0.17, 0),
    head: new THREE.BoxGeometry(0.3, 0.3, 0.28).translate(0, 0.15, 0),
    hairFlat: new THREE.BoxGeometry(0.32, 0.08, 0.3),
    mohawk: new THREE.BoxGeometry(0.05, 0.2, 0.3),
    capTop: new THREE.BoxGeometry(0.32, 0.09, 0.3),
    capBrim: new THREE.BoxGeometry(0.3, 0.03, 0.14),
    gun: new THREE.BoxGeometry(0.07, 0.09, 0.34),
    board: new THREE.BoxGeometry(0.16, 0.05, 0.56),
    armor: new THREE.BoxGeometry(0.4, 0.3, 0.26),
    helmet: new THREE.BoxGeometry(0.34, 0.14, 0.32),
    tie: new THREE.BoxGeometry(0.07, 0.22, 0.02),
    sash: new THREE.BoxGeometry(0.42, 0.1, 0.24),
  };

  function makeRig(e) {
    const look = BODY_LOOKS[e.typeName];
    const rig = new THREE.Group();
    const parts = {};
    // DoubleSide so point-blank shots (ray origin inside the box) still hit
    const mat = c => lambert({ color: c, side: THREE.DoubleSide });

    const hips = new THREE.Group();
    hips.position.y = 0.42;
    rig.add(hips);
    parts.legL = new THREE.Mesh(G.leg, mat(look.pants));
    parts.legL.position.set(-0.1, 0, 0);
    parts.legR = new THREE.Mesh(G.leg, mat(look.pants));
    parts.legR.position.set(0.1, 0, 0);
    hips.add(parts.legL, parts.legR);

    const upper = new THREE.Group();
    upper.position.y = 0.42;
    rig.add(upper);
    parts.upper = upper;
    parts.torso = new THREE.Mesh(G.torso, mat(look.jacket || look.shirt));
    parts.torso.position.y = 0.2;
    upper.add(parts.torso);
    if (look.jacket) {
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.24), mat(look.shirt));
      chest.position.y = 0.2;
      upper.add(chest);
    }
    if (look.sash) {
      const sash = new THREE.Mesh(G.sash, mat(look.sash));
      sash.position.y = 0.22; sash.rotation.z = 0.5;
      upper.add(sash);
    }
    if (look.tie) {
      const tie = new THREE.Mesh(G.tie, mat(look.tie));
      tie.position.set(0, 0.18, 0.12);
      upper.add(tie);
    }
    parts.armL = new THREE.Mesh(G.arm, mat(look.shirt));
    parts.armL.position.set(-0.24, 0.36, 0);
    parts.armR = new THREE.Mesh(G.arm, mat(look.shirt));
    parts.armR.position.set(0.24, 0.36, 0);
    upper.add(parts.armL, parts.armR);

    const faceMat = lambert({ map: faceTexture(e.typeName), side: THREE.DoubleSide });
    const skinMat = lambert({ color: FACE_LOOKS[e.typeName].skin, side: THREE.DoubleSide });
    parts.head = new THREE.Mesh(G.head,
      [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat]);
    parts.head.position.y = 0.38;
    upper.add(parts.head);

    const hairMat = mat(look.hair);
    if (look.hairStyle === 'mohawk') {
      const hair = new THREE.Mesh(G.mohawk, hairMat);
      hair.position.set(0, 0.36, 0);
      parts.head.add(hair);
    } else if (look.hairStyle === 'flat' || look.hairStyle === 'buzz' || look.hairStyle === 'combover') {
      const hair = new THREE.Mesh(G.hairFlat, hairMat);
      hair.position.set(0, 0.32, -0.01);
      parts.head.add(hair);
    } else if (look.hairStyle === 'cap' || look.hairStyle === 'backcap') {
      const top = new THREE.Mesh(G.capTop, hairMat);
      top.position.set(0, 0.32, 0);
      const brim = new THREE.Mesh(G.capBrim, hairMat);
      brim.position.set(0, 0.29, look.hairStyle === 'cap' ? 0.2 : -0.2);
      parts.head.add(top, brim);
    }
    if (e.elite) {
      const armor = new THREE.Mesh(G.armor, mat(0x3f4a5a));
      armor.position.y = 0.2;
      upper.add(armor);
      const helm = new THREE.Mesh(G.helmet, mat(0x39424e));
      helm.position.set(0, 0.34, 0);
      parts.head.add(helm);
    }
    if (look.weapon) {
      parts.gun = new THREE.Mesh(G.gun, mat(look.weapon));
      parts.gun.position.set(0.05, -0.32, 0.14);
      parts.armR.add(parts.gun);
    }
    if (look.board) {
      parts.gun = new THREE.Mesh(G.board, mat(0xc8583a));
      parts.gun.position.set(0.02, -0.36, 0.1);
      parts.gun.rotation.x = 0.5;
      parts.armR.add(parts.gun);
    }

    rig.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.enemy = e;
        o.userData.part = o === parts.head || o.parent === parts.head ? 'head' : 'body';
      }
    });
    const s = e.type.scale * 1.02;
    rig.scale.set(s, s, s);
    rig.userData = { parts, e };
    scene.add(rig);
    return rig;
  }

  const rigs = new Map();
  function syncEnemies(dt, time) {
    const seen = new Set();
    for (const e of Game.S.enemies) {
      seen.add(e);
      let rig = rigs.get(e);
      if (!rig) { rig = makeRig(e); rigs.set(e, rig); }
      const P = rig.userData.parts;
      rig.position.set(e.x, 0, e.y);

      if (e.dead) {
        const t = Math.min(1, e.deadT / 0.3);
        rig.rotation.x = -t * Math.PI / 2 * 0.96;
        if (e.deadT > 0.6) rig.position.y = -(e.deadT - 0.6) * 1.4;
        continue;
      }

      // face the player
      const p = Game.S.player;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      rig.rotation.y = Math.PI / 2 - a;
      rig.rotation.x = e.pain > 0 ? -0.16 : 0;

      const speed = e.type.speed;
      const walk = Math.sin(e.animT * speed * 3.4) * 0.55;
      if (e.windupT > 0 || e.charging > 0) {
        P.legL.rotation.x = walk * 0.3; P.legR.rotation.x = -walk * 0.3;
        P.armL.rotation.x = e.type.melee ? -2.6 : -1.5;
        P.armR.rotation.x = e.type.melee ? -2.6 : -1.5;
      } else if (e.flash > 0) {
        P.armL.rotation.x = e.type.melee ? -0.5 : -1.5;
        P.armR.rotation.x = e.type.melee ? -0.5 : -1.5;
      } else {
        P.legL.rotation.x = walk; P.legR.rotation.x = -walk;
        P.armL.rotation.x = -walk * 0.7; P.armR.rotation.x = walk * 0.7;
      }
    }
    for (const [e, rig] of rigs) {
      if (!seen.has(e)) {
        scene.remove(rig);
        rig.traverse(o => { if (o.isMesh && o.material && o.material.dispose && !o.material.map) o.material.dispose(); });
        rigs.delete(e);
      }
    }
  }

  // ------------------------------------------------------------- pickups
  const pickupProtos = {
    ammo: () => new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.22), lambert({ color: 0x5a6a38 })),
    nachos: () => {
      const gp = new THREE.Group();
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.22), lambert({ color: 0xc0392b }));
      const chips = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.18, 6), lambert({ color: 0xf6c945 }));
      chips.position.y = 0.13;
      gp.add(basket, chips);
      return gp;
    },
    grenade: () => new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lambert({ color: 0x3f5f3f })),
    armor: () => new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.08), lambert({ color: 0x4a70a8 })),
  };
  const pickupMeshes = new Map();
  function syncPickups(time) {
    const seen = new Set();
    for (const pk of Game.S.pickups) {
      seen.add(pk);
      let m = pickupMeshes.get(pk);
      if (!m) {
        m = pickupProtos[pk.kind]();
        m.traverse ? m.traverse(o => { if (o.isMesh) o.castShadow = true; }) : null;
        scene.add(m);
        pickupMeshes.set(pk, m);
      }
      m.position.set(pk.x, 0.22 + Math.sin(time * 3 + pk.bob) * 0.05, pk.y);
      m.rotation.y = time * 1.6 + pk.bob;
    }
    for (const [pk, m] of pickupMeshes)
      if (!seen.has(pk)) { scene.remove(m); pickupMeshes.delete(pk); }
  }

  const grenadeMeshes = new Map();
  const grenadeGeo = new THREE.SphereGeometry(0.07, 8, 6);
  const grenadeMat = lambert({ color: 0x2e4a2e });
  function syncGrenades() {
    const seen = new Set();
    for (const n of Game.S.grenades) {
      seen.add(n);
      let m = grenadeMeshes.get(n);
      if (!m) {
        m = new THREE.Mesh(grenadeGeo, grenadeMat);
        m.castShadow = true;
        scene.add(m);
        grenadeMeshes.set(n, m);
      }
      m.position.set(n.x, n.z * WALL_H, n.y);
    }
    for (const [n, m] of grenadeMeshes)
      if (!seen.has(n)) { scene.remove(m); grenadeMeshes.delete(n); }
  }

  // ----------------------------------------------------------- particles
  const MAXP = 500;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3);
  const pCol = new Float32Array(MAXP * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.07, vertexColors: true, sizeAttenuation: true,
    transparent: true, opacity: 0.95, depthWrite: false,
  }));
  points.frustumCulled = false;
  scene.add(points);
  const colorCache = new Map();
  function cssColor(str) {
    let c = colorCache.get(str);
    if (!c) { c = new THREE.Color(str); colorCache.set(str, c); }
    return c;
  }
  function syncParticles() {
    const list = Fx.particles;
    const n = Math.min(MAXP, list.length);
    for (let i = 0; i < n; i++) {
      const p = list[i];
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.z * WALL_H; pPos[i * 3 + 2] = p.y;
      const c = cssColor(p.color);
      pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    }
    pGeo.setDrawRange(0, n);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  // tracers: one dynamic LineSegments
  const MAXT = 40;
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(MAXT * 6);
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage));
  const tracerLines = new THREE.LineSegments(tGeo, new THREE.LineBasicMaterial({
    color: 0xffe08a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  tracerLines.frustumCulled = false;
  scene.add(tracerLines);
  function syncTracers() {
    const list = Fx.tracers;
    const n = Math.min(MAXT, list.length);
    for (let i = 0; i < n; i++) {
      const t = list[i];
      tPos[i * 6] = t.x0; tPos[i * 6 + 1] = t.z0 ?? 0.55; tPos[i * 6 + 2] = t.y0;
      tPos[i * 6 + 3] = t.x1; tPos[i * 6 + 4] = t.z1 ?? 0.55; tPos[i * 6 + 5] = t.y1;
    }
    tGeo.setDrawRange(0, n * 2);
    tGeo.attributes.position.needsUpdate = true;
  }

  // ------------------------------------------------------------- decals
  const decalTex = (() => {
    const t = new THREE.CanvasTexture(Textures.bulletHole);
    return t;
  })();
  const decals = [];
  const decalGeo = new THREE.PlaneGeometry(0.09, 0.09);
  function addDecal(point, normal) {
    const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
      map: decalTex, transparent: true, depthWrite: false, opacity: 0.95,
    }));
    m.position.copy(point).addScaledVector(normal, 0.012);
    m.lookAt(point.clone().add(normal));
    m.rotation.z = Math.random() * Math.PI;
    scene.add(m);
    decals.push({ m, t: 22 });
    if (decals.length > 70) {
      const old = decals.shift();
      scene.remove(old.m);
      old.m.material.dispose();
    }
  }
  function updateDecals(dt) {
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i];
      d.t -= dt;
      if (d.t < 2) d.m.material.opacity = Math.max(0, d.t / 2);
      if (d.t <= 0) {
        scene.remove(d.m);
        d.m.material.dispose();
        decals.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------- hitscan
  const raycaster = new THREE.Raycaster();
  raycaster.far = 60;
  const _dir = new THREE.Vector3();
  function hitscan(yawOff, pitchOff) {
    _dir.set(yawOff, pitchOff, -1).normalize().applyQuaternion(camera.quaternion);
    raycaster.set(camera.position, _dir);
    const targets = [...wallMeshes];
    for (const [e, rig] of rigs) if (!e.dead) targets.push(rig);
    const hits = raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      const ud = h.object.userData;
      if (ud && ud.enemy) {
        if (ud.enemy.dead) continue;
        return {
          enemy: ud.enemy, head: ud.part === 'head',
          dist: h.distance, point: h.point, normal: null,
        };
      }
      // wall or floor
      let normal = h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0);
      if (h.object.isInstancedMesh || h.object === floor) {
        if (h.object === floor) normal.set(0, 1, 0);
        // instanced boxes are axis-aligned: object-space normal == world
      }
      return { enemy: null, head: false, dist: h.distance, point: h.point, normal };
    }
    return null;
  }

  function worldToScreen(x, y, h) {
    const v = new THREE.Vector3(x, h, y).project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * DW,
      y: (-v.y * 0.5 + 0.5) * DH,
      visible: v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2,
    };
  }

  // ---------------------------------------------------------- composer
  composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.32, 0.7, 0.86);
  composer.addPass(bloomPass);
  composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
  setSize();

  // ------------------------------------------------------------- frame
  function applyCamera(dt) {
    const S = Game.S;
    if (S.mode === 'menu') {
      const at = S.attract;
      camera.position.set(at.x, EYE(0.55), at.y);
      camera.rotation.y = -at.a - Math.PI / 2;
      camera.rotation.x = Math.sin(at.a * 0.5) * 0.06;
      camera.rotation.z = 0;
      camera.fov = 72;
      camera.updateProjectionMatrix();
      return;
    }
    const p = S.player;
    const sp = WEAPONS[p.weapon];
    const baseFov = Game.settings.fov;
    const adsFov = sp.adsFov || 48;
    let fov = baseFov + (adsFov - baseFov) * p.adsT;
    if (p.sprinting) fov += 6;
    if (p.slideT > 0) fov += 9;
    camera.fov = fov;
    camera.updateProjectionMatrix();

    const shakeAmp = (Game.settings.shake ? S.shake : 0) * 0.004;
    const bobY = Math.sin(p.bobPhase * 2) * 0.02 * p.bobMag;
    camera.position.set(
      p.x + (Math.random() - 0.5) * shakeAmp,
      EYE(p.eye) + bobY + (Math.random() - 0.5) * shakeAmp,
      p.y + (Math.random() - 0.5) * shakeAmp
    );
    camera.rotation.y = -p.a - Math.PI / 2;
    camera.rotation.x = (p.pitch + p.recoilPitch) / 170 * 0.72;
    camera.rotation.z = p.roll;

    // muzzle light flash
    muzzleLight.intensity = S.flash > 0 ? 2.6 : 0;
    if (S.flash > 0) {
      _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      muzzleLight.position.copy(camera.position).addScaledVector(_dir, 0.6);
    }
  }

  function render(dt) {
    const S = Game.S;
    if (S.mode === 'playing') tuneResolution(dt);
    applyCamera(dt);
    for (const c of clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 62) c.position.x = -22;
    }
    if (S.mode !== 'menu') {
      syncEnemies(dt, S.time);
      syncPickups(S.time);
      syncGrenades();
      syncParticles();
      syncTracers();
      updateDecals(dt);
    } else {
      syncEnemies(dt, 0);
      pGeo.setDrawRange(0, 0);
      tGeo.setDrawRange(0, 0);
    }
    composer.render();
  }

  function onRunStart(character) {
    Hud.onRunStart(character);
  }

  return {
    render, onRunStart, hitscan, addDecal, worldToScreen, setSize,
    stats: () => ({ W, H, renderScale }),
    _debug: { camera, raycaster, scene, wallMeshes, rigs },
  };
})();
