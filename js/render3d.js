import * as THREE from 'three';
import {
  EffectComposer, RenderPass, NormalPass, DepthDownsamplingPass, EffectPass,
  SSAOEffect, BloomEffect, ToneMappingEffect, ToneMappingMode,
  HueSaturationEffect, BrightnessContrastEffect, VignetteEffect, NoiseEffect,
  SMAAEffect, GodRaysEffect, BlendFunction, KernelSize,
} from 'postprocessing';
import { CONFIG, WEAPONS, SLOT_ORDER, CHARACTERS } from './config.js';
import { GameMap } from './map.js';
import { Textures } from './textures.js';
import { Fx } from './fx.js';
import { Game } from './game.js';   // runtime-only (circular is fine)
import { Hud } from './hud.js';     // runtime-only (circular is fine)

// The 3D engine: modern-shooter WebGL rendering (three.js).
// PBR materials with procedural normal maps, realistic character rigs,
// true 3D first-person weapons, dynamic sun + shadows, SSAO, bloom,
// film grading, and FXAA. Gameplay stays on the 2D grid in game.js.
export const Renderer = (() => {
  const canvas = document.getElementById('game');
  const DW = 1280, DH = 720;
  const WALL_H = CONFIG.WALL_H;              // meters
  const EYE = h => h * CONFIG.EYE_SCALE;     // gameplay eye units -> meters

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Tone mapping happens in post (AGX) so bloom operates on linear HDR values.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.04, 120);
  camera.rotation.order = 'YXZ';
  scene.add(camera);                          // so the weapon can ride on it

  // ------------------------------------------------------------ helpers
  const texCache = new Map();
  function canvasTex(c, repeatX = 1, repeatY = 1, srgb = true) {
    const key = c;
    let t = texCache.get(key);
    if (!t) {
      t = new THREE.CanvasTexture(c);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.anisotropy = 8;
      texCache.set(key, t);
    }
    return t;
  }

  // procedural normal map: Sobel over the albedo's luminance
  function normalFromCanvas(src, strength = 1.4) {
    const w = src.width, h = src.height;
    const sctx = src.getContext('2d');
    const img = sctx.getImageData(0, 0, w, h).data;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++)
      lum[i] = (img[i * 4] * 0.299 + img[i * 4 + 1] * 0.587 + img[i * 4 + 2] * 0.114) / 255;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d');
    const oimg = octx.createImageData(w, h);
    const od = oimg.data;
    const at = (x, y) => lum[((y + h) % h) * w + ((x + w) % w)];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
        const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
        const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
        const i = (y * w + x) * 4;
        od[i] = (-dx * inv * 0.5 + 0.5) * 255;
        od[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
        od[i + 2] = inv * 255;
        od[i + 3] = 255;
      }
    octx.putImageData(oimg, 0, 0);
    const t = new THREE.CanvasTexture(out);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // modern three's ColorManagement linearizes hex/CSS colors automatically
  const std = opts => new THREE.MeshStandardMaterial(opts);
  function surface(albedoCanvas, { rough = 0.85, metal = 0, nStrength = 1.4,
    repeatX = 1, repeatY = 1 } = {}) {
    const nm = normalFromCanvas(albedoCanvas, nStrength);
    nm.repeat.set(repeatX, repeatY);
    return std({
      map: canvasTex(albedoCanvas, repeatX, repeatY),
      normalMap: nm,
      roughness: rough, metalness: metal,
    });
  }

  // ------------------------------------------------------------- sizing
  let W = 1280, H = 720, renderScale = 1;
  let composer = null, ssaoPass = null, smaaPass = null;
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
    if (composer) composer.setSize(W, H);
    if (typeof Hud !== 'undefined') Hud.setSize();
  }
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setSize, 150);
  });

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

  // ------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0xbdd7f2, 0x7a6f58, 0.34);
  scene.add(hemi);
  // golden-hour sun: low enough to appear on screen (god rays, long shadows)
  const sunDir = new THREE.Vector3(24, 11, -20);
  const sun = new THREE.DirectionalLight(0xffdcaa, 1.7);
  sun.position.copy(sunDir).add(new THREE.Vector3(GameMap.W / 2, 0, GameMap.H / 2));
  sun.target.position.set(GameMap.W / 2, 0, GameMap.H / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(3072, 3072);
  const span = Math.max(GameMap.W, GameMap.H) * 0.72;
  sun.shadow.camera.left = -span; sun.shadow.camera.right = span;
  sun.shadow.camera.top = span; sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 4; sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);

  const muzzleLight = new THREE.PointLight(0xffc866, 0, 8, 2);
  scene.add(muzzleLight);

  // ---------------------------------------------------------------- sky
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4; skyCanvas.height = 512;
  {
    const sg = skyCanvas.getContext('2d');
    const grad = sg.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#1e56ae');
    grad.addColorStop(0.38, '#4c8ed6');
    grad.addColorStop(0.62, '#8fbce8');
    grad.addColorStop(0.78, '#cadff2');
    grad.addColorStop(0.88, '#f2e8ce');    // warm horizon haze
    grad.addColorStop(1, '#e8dfc4');
    sg.fillStyle = grad; sg.fillRect(0, 0, 4, 512);
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(95, 24, 16),
    new THREE.MeshBasicMaterial({
      map: canvasTex(skyCanvas, 1, 1), side: THREE.BackSide, fog: false,
    })
  );
  sky.position.set(GameMap.W / 2, 0, GameMap.H / 2);
  scene.add(sky);
  scene.fog = new THREE.Fog(0xb3c6d8, 32, 88);

  // the sun itself + glow (bloom picks these up)
  function glowSprite(size, inner, outer) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const cg = c.getContext('2d');
    const rad = cg.createRadialGradient(64, 64, 4, 64, 64, 62);
    rad.addColorStop(0, inner);
    rad.addColorStop(1, outer);
    cg.fillStyle = rad;
    cg.beginPath(); cg.arc(64, 64, 62, 0, 7); cg.fill();
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), transparent: true, fog: false,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.set(size, size, 1);
    return sp;
  }
  const sunDisc = glowSprite(10, 'rgba(255,252,240,1)', 'rgba(255,235,180,0)');
  const sunGlow = glowSprite(30, 'rgba(255,240,200,0.5)', 'rgba(255,230,170,0)');
  // solid disc mesh: the occludable light source the god-rays effect samples
  const sunMesh = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff4d8, fog: false })
  );
  {
    const sp = sunDir.clone().normalize().multiplyScalar(88)
      .add(new THREE.Vector3(GameMap.W / 2, 0, GameMap.H / 2));
    sunDisc.position.copy(sp);
    sunGlow.position.copy(sp);
    sunMesh.position.copy(sp);
    sunMesh.lookAt(GameMap.W / 2, 0, GameMap.H / 2);
    scene.add(sunGlow, sunMesh, sunDisc);
  }

  // ---- image-based lighting: PMREM of a tiny sky scene.
  // Gives every PBR material real reflections (gun metal, armor, lockers).
  {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(
      new THREE.SphereGeometry(50, 24, 16),
      new THREE.MeshBasicMaterial({ map: canvasTex(skyCanvas, 1, 1), side: THREE.BackSide })
    );
    envScene.add(envSky);
    const envGround = new THREE.Mesh(
      new THREE.CircleGeometry(49, 24),
      new THREE.MeshBasicMaterial({ color: 0x8a7d62 })
    );
    envGround.rotation.x = -Math.PI / 2;
    envGround.position.y = -2;
    envScene.add(envGround);
    const envSun = new THREE.Mesh(
      new THREE.SphereGeometry(3, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc })
    );
    envSun.position.copy(sunDir).normalize().multiplyScalar(44);
    envScene.add(envSun);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.05).texture;
    scene.environmentIntensity = 0.62;
    pmrem.dispose();
  }

  // clouds
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = cloudCanvas.height = 128;
  {
    const cg = cloudCanvas.getContext('2d');
    for (const [x, y, r] of [[40, 70, 26], [64, 58, 30], [90, 70, 24], [64, 76, 28]]) {
      const rad = cg.createRadialGradient(x, y, 2, x, y, r);
      rad.addColorStop(0, 'rgba(255,255,255,0.92)');
      rad.addColorStop(1, 'rgba(255,255,255,0)');
      cg.fillStyle = rad;
      cg.beginPath(); cg.arc(x, y, r, 0, 7); cg.fill();
    }
  }
  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.8, fog: false, depthWrite: false,
    }));
    const scale = 10 + Math.random() * 12;
    s.scale.set(scale, scale * 0.45, 1);
    s.position.set(Math.random() * 100 - 30, 20 + Math.random() * 14, Math.random() * 90 - 28);
    s.userData.drift = 0.14 + Math.random() * 0.22;
    scene.add(s);
    clouds.push(s);
  }

  // distant skyline: window-gridded towers beyond the walls
  {
    const cx = GameMap.W / 2, cz = GameMap.H / 2;
    const winCanvas = document.createElement('canvas');
    winCanvas.width = 64; winCanvas.height = 96;
    const wg = winCanvas.getContext('2d');
    wg.fillStyle = '#39414e'; wg.fillRect(0, 0, 64, 96);
    let ws = 5;
    for (let wy = 4; wy < 92; wy += 9)
      for (let wx = 4; wx < 60; wx += 8) {
        ws = (ws * 16807) % 2147483647;
        const lit = (ws / 2147483647) < 0.22;
        wg.fillStyle = lit ? '#ffd98a' : ((ws >> 3) % 2 ? '#242b36' : '#586474');
        wg.fillRect(wx, wy, 5, 6);
      }
    const winTex = new THREE.CanvasTexture(winCanvas);
    winTex.colorSpace = THREE.SRGBColorSpace;
    const bmat = std({ color: 0xffffff, map: winTex, roughness: 0.9 });
    const bmat2 = std({ color: 0x8a929e, map: winTex, roughness: 0.9 });
    const capMat2 = std({ color: 0x2e343e, roughness: 0.95 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      const r = 46 + (i % 4) * 8;
      const bw = 6 + (i * 7) % 9, bh = 10 + (i * 13) % 19, bd = 6 + (i * 5) % 8;
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), i % 2 ? bmat : bmat2);
      b.position.set(cx + Math.cos(a) * r, bh / 2 - 0.5, cz + Math.sin(a) * r);
      b.rotation.y = a;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.5, 0.8, bd * 0.5), capMat2);
      roof.position.y = bh / 2 + 0.4;
      b.add(roof);
      scene.add(b);
    }
  }

  // dust motes drifting in the sunlight
  const DUST = 70;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST * 2);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = 3 + Math.random() * (GameMap.W - 6);
    dustPos[i * 3 + 1] = 0.3 + Math.random() * 2.2;
    dustPos[i * 3 + 2] = 3 + Math.random() * (GameMap.H - 6);
    dustSeed[i * 2] = Math.random() * 10;
    dustSeed[i * 2 + 1] = 0.2 + Math.random() * 0.5;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3).setUsage(THREE.DynamicDrawUsage));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xfff2cc, size: 0.025, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // --------------------------------------------------------------- level
  const solidMeshes = [];    // hitscan targets (walls, floor, props)
  {
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
    const wallCells = [];
    for (const [t, cells] of byType) {
      if (t >= 8) continue;                     // props handled below
      wallCells.push(...cells);
      const mat = surface(Textures.walls[t], {
        rough: t === 2 ? 0.55 : 0.9,
        metal: t === 2 || t === 4 ? 0.35 : 0,
        nStrength: 1.6,
      });
      const inst = new THREE.InstancedMesh(box, mat, cells.length);
      cells.forEach(([x, y], i) => {
        m4.makeTranslation(x + 0.5, WALL_H / 2, y + 0.5);
        inst.setMatrixAt(i, m4);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = true;
      inst.receiveShadow = true;
      scene.add(inst);
      solidMeshes.push(inst);
    }
    // concrete trim cap along every wall top — breaks the flat silhouette
    const capGeo = new THREE.BoxGeometry(1.06, 0.12, 1.06);
    const capMat = std({ color: 0xb5ad9c, roughness: 0.9 });
    const caps = new THREE.InstancedMesh(capGeo, capMat, wallCells.length);
    wallCells.forEach(([x, y], i) => {
      m4.makeTranslation(x + 0.5, WALL_H + 0.06, y + 0.5);
      caps.setMatrixAt(i, m4);
    });
    caps.instanceMatrix.needsUpdate = true;
    caps.castShadow = true;
    caps.receiveShadow = true;
    scene.add(caps);

    // dark baseboard skirting grounds every wall against the floor
    const baseGeo = new THREE.BoxGeometry(1.045, 0.16, 1.045);
    const baseMat = std({ color: 0x4c443a, roughness: 0.85 });
    const bases = new THREE.InstancedMesh(baseGeo, baseMat, wallCells.length);
    wallCells.forEach(([x, y], i) => {
      m4.makeTranslation(x + 0.5, 0.08, y + 0.5);
      bases.setMatrixAt(i, m4);
    });
    bases.instanceMatrix.needsUpdate = true;
    bases.receiveShadow = true;
    scene.add(bases);

    // ---- cover props
    const woodCanvas = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const gg = c.getContext('2d');
      gg.fillStyle = '#8a6435'; gg.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 4; i++) {
        gg.fillStyle = i % 2 ? '#936d3c' : '#7d5a2e';
        gg.fillRect(0, i * 16 + 1, 64, 14);
        gg.fillStyle = 'rgba(0,0,0,0.25)';
        gg.fillRect(0, i * 16, 64, 2);
      }
      gg.fillStyle = 'rgba(0,0,0,0.3)';
      for (let i = 0; i < 10; i++) gg.fillRect((i * 23) % 64, (i * 17) % 64, 2, 5);
      return c;
    })();
    const woodMat = surface(woodCanvas, { rough: 0.8, nStrength: 2 });
    const bagMat = std({ color: 0x6b6f4a, roughness: 0.95 });
    for (const [t, cells] of byType) {
      if (t === 8) {
        // crate stacks
        for (const [x, y] of cells) {
          const gp = new THREE.Group();
          const big = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.52, 0.78), woodMat);
          big.position.y = 0.26;
          const small = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.52), woodMat);
          small.position.set(0.1, 0.72, -0.08);
          small.rotation.y = 0.4;
          gp.add(big, small);
          gp.position.set(x + 0.5, 0, y + 0.5);
          gp.rotation.y = (x * 7 + y * 13) % 6 * 0.3;
          gp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          scene.add(gp);
          solidMeshes.push(gp);
        }
      } else if (t === 9) {
        // sandbag barriers
        for (const [x, y] of cells) {
          const gp = new THREE.Group();
          for (let row = 0; row < 2; row++)
            for (let i = 0; i < 3 - row; i++) {
              const bag = new THREE.Mesh(
                new THREE.BoxGeometry(0.34, 0.22, 0.55), bagMat);
              bag.position.set(-0.3 + i * 0.32 + row * 0.16, 0.12 + row * 0.22, 0);
              bag.rotation.y = ((x + y + i) % 3 - 1) * 0.12;
              gp.add(bag);
            }
          gp.position.set(x + 0.5, 0, y + 0.5);
          gp.rotation.y = ((x * 5 + y * 3) % 4) * 0.75;
          gp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          scene.add(gp);
          solidMeshes.push(gp);
        }
      }
    }

    // ---- scattered ground clutter (papers, cans, leaves) sells "lived in"
    {
      const rand = (() => { let s = 1234; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      const paperGeo = new THREE.PlaneGeometry(0.16, 0.22);
      const paperMat = std({ color: 0xe6e2d4, roughness: 0.9, side: THREE.DoubleSide });
      const paper2Mat = std({ color: 0xd8cfae, roughness: 0.9, side: THREE.DoubleSide });
      const canGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.115, 10);
      const canMats = [
        std({ color: 0xb5312a, roughness: 0.3, metalness: 0.7 }),
        std({ color: 0x2a66b5, roughness: 0.3, metalness: 0.7 }),
      ];
      const leafGeo = new THREE.CircleGeometry(0.05, 5);
      const leafMat = std({ color: 0x7d6a2e, roughness: 0.95, side: THREE.DoubleSide });
      let placed = 0, tries = 0;
      while (placed < 70 && tries < 600) {
        tries++;
        const x = 1.5 + rand() * (GameMap.W - 3), y = 1.5 + rand() * (GameMap.H - 3);
        if (GameMap.solidAt(x, y)) continue;
        const kind = rand();
        let m;
        if (kind < 0.45) {
          m = new THREE.Mesh(paperGeo, rand() < 0.5 ? paperMat : paper2Mat);
          m.rotation.set(-Math.PI / 2 + (rand() - 0.5) * 0.14, 0, rand() * Math.PI * 2);
          m.position.set(x, 0.008, y);
        } else if (kind < 0.7) {
          m = new THREE.Mesh(canGeo, canMats[(placed % 2)]);
          m.rotation.set(Math.PI / 2, 0, rand() * Math.PI * 2);
          m.position.set(x, 0.034, y);
          m.castShadow = true;
        } else {
          m = new THREE.Mesh(leafGeo, leafMat);
          m.rotation.set(-Math.PI / 2, 0, rand() * Math.PI * 2);
          m.position.set(x, 0.006, y);
        }
        scene.add(m);
        placed++;
      }
    }
  }

  let floor = null;
  {
    // worn terrazzo-style school tiles: color variance, grout, scuffs, cracks
    const R = 256, T = R / 2;                        // 2x2 tiles per canvas
    const c = document.createElement('canvas');
    c.width = c.height = R;
    const fg = c.getContext('2d');
    const rough = document.createElement('canvas');  // per-texel roughness
    rough.width = rough.height = R;
    const rg = rough.getContext('2d');
    rg.fillStyle = '#9a9a9a'; rg.fillRect(0, 0, R, R);
    const rand = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        const warm = (tx + ty) % 2;
        fg.fillStyle = warm ? '#b3a17e' : '#a89673';
        fg.fillRect(tx * T, ty * T, T, T);
        // terrazzo speckle
        for (let i = 0; i < 220; i++) {
          const sx = tx * T + rand() * T, sy = ty * T + rand() * T;
          const v = rand();
          fg.fillStyle = v < 0.4 ? 'rgba(255,250,235,0.16)'
            : v < 0.7 ? 'rgba(90,70,45,0.14)' : 'rgba(140,120,90,0.18)';
          fg.fillRect(sx, sy, 1 + rand() * 2, 1 + rand() * 2);
        }
        // polished sheen streak: darker roughness = shinier
        const shx = tx * T + T * (0.2 + rand() * 0.5);
        const rgrad = rg.createLinearGradient(shx - 26, 0, shx + 26, 0);
        rgrad.addColorStop(0, 'rgba(0,0,0,0)');
        rgrad.addColorStop(0.5, 'rgba(60,60,60,0.55)');
        rgrad.addColorStop(1, 'rgba(0,0,0,0)');
        rg.fillStyle = rgrad; rg.fillRect(tx * T, ty * T, T, T);
      }
    // grout lines
    fg.fillStyle = 'rgba(40,30,20,0.4)';
    fg.fillRect(0, 0, R, 3); fg.fillRect(0, T, R, 3);
    fg.fillRect(0, 0, 3, R); fg.fillRect(T, 0, 3, R);
    rg.fillStyle = 'rgba(230,230,230,0.9)';
    rg.fillRect(0, 0, R, 3); rg.fillRect(0, T, R, 3);
    rg.fillRect(0, 0, 3, R); rg.fillRect(T, 0, 3, R);
    // scuffs + hairline cracks
    fg.strokeStyle = 'rgba(30,22,14,0.2)'; fg.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      fg.beginPath();
      let x = rand() * R, y = rand() * R;
      fg.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += (rand() - 0.5) * 40; y += (rand() - 0.5) * 40; fg.lineTo(x, y); }
      fg.stroke();
    }
    const roughTex = new THREE.CanvasTexture(rough);
    roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
    roughTex.repeat.set(GameMap.W / 2, GameMap.H / 2);
    const floorMat = surface(c, { rough: 1, nStrength: 1.1, repeatX: GameMap.W / 2, repeatY: GameMap.H / 2 });
    floorMat.roughnessMap = roughTex;
    floor = new THREE.Mesh(new THREE.PlaneGeometry(GameMap.W, GameMap.H), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(GameMap.W / 2, 0, GameMap.H / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    solidMeshes.push(floor);
  }

  // ------------------------------------------------------------ goons 3D
  const FACE_LOOKS = {
    poser: { skin: '#e8bd85', brow: '#2a4d20' },
    skater: { skin: '#e5c08e', brow: '#5a2020' },
    jock: { skin: '#e0b184', brow: '#3a2a14' },
    monitor: { skin: '#e8c090', brow: '#31517a' },
    coach: { skin: '#e0a684', brow: '#555', red: true },
    principal: { skin: '#dfc09a', brow: '#666' },
  };
  const BODY_LOOKS = {
    poser: { shirt: 0x1e2026, pants: 0x2e333c, hair: 0x2ecc40, hairStyle: 'mohawk', weapon: null },
    skater: { shirt: 0x5e2f70, pants: 0x3c342c, hair: 0xa83226, hairStyle: 'backcap', weapon: null, board: true },
    jock: { shirt: 0xd8d2c0, pants: 0x26365e, hair: 0x3a2a14, hairStyle: 'flat', weapon: 0x1c1e24, jacket: 0x8f2830 },
    monitor: { shirt: 0x8f8464, pants: 0x4a4028, hair: 0x31517a, hairStyle: 'cap', weapon: 0x1c1e24, sash: 0xc08a1e },
    coach: { shirt: 0x70747c, pants: 0x585c64, hair: 0xd8d3c8, hairStyle: 'buzz', weapon: null },
    principal: { shirt: 0x30303a, pants: 0x1e1e26, hair: 0x9a9a9a, hairStyle: 'combover', weapon: 0x1c1e24, tie: 0x6a1c1c },
  };

  const faceTexOf = new Map();
  function faceTexture(typeName) {
    if (faceTexOf.has(typeName)) return faceTexOf.get(typeName);
    const look = FACE_LOOKS[typeName];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const fg = c.getContext('2d');
    fg.fillStyle = look.skin; fg.fillRect(0, 0, 128, 128);
    if (look.red) { fg.fillStyle = 'rgba(220,70,40,0.28)'; fg.fillRect(0, 40, 128, 88); }
    fg.fillStyle = '#fff';
    fg.beginPath(); fg.ellipse(44, 56, 13, 10, 0, 0, 7); fg.ellipse(84, 56, 13, 10, 0, 0, 7); fg.fill();
    fg.fillStyle = '#151515';
    fg.beginPath(); fg.arc(46, 58, 5.5, 0, 7); fg.arc(82, 58, 5.5, 0, 7); fg.fill();
    fg.strokeStyle = look.brow; fg.lineWidth = 7; fg.lineCap = 'round';
    fg.beginPath();
    fg.moveTo(28, 38); fg.lineTo(56, 45);
    fg.moveTo(100, 38); fg.lineTo(72, 45);
    fg.stroke();
    fg.fillStyle = 'rgba(150,100,60,0.5)';
    fg.beginPath(); fg.ellipse(64, 74, 7, 9, 0, 0, 7); fg.fill();
    fg.strokeStyle = 'rgba(60,30,10,0.85)'; fg.lineWidth = 5;
    fg.beginPath(); fg.moveTo(46, 100); fg.quadraticCurveTo(64, 90, 82, 100); fg.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    faceTexOf.set(typeName, t);
    return t;
  }

  // sculpted stylized proportions, base height ~1.8m — capsule limbs,
  // sphere joints, real 3D facial features instead of textures on boxes
  const G = {
    leg: new THREE.CapsuleGeometry(0.085, 0.62, 4, 10).translate(0, -0.4, 0),
    boot: new THREE.CapsuleGeometry(0.075, 0.13, 4, 10)
      .rotateX(Math.PI / 2).scale(1, 0.72, 1),
    torso: new THREE.CapsuleGeometry(0.205, 0.3, 6, 14).scale(1.06, 1, 0.66),
    belt: new THREE.CylinderGeometry(0.215, 0.225, 0.09, 14).scale(1, 1, 0.64),
    shoulder: new THREE.SphereGeometry(0.083, 12, 10),
    arm: new THREE.CapsuleGeometry(0.056, 0.44, 4, 10).translate(0, -0.26, 0),
    hand: new THREE.SphereGeometry(0.062, 10, 8).scale(0.9, 1.05, 0.9),
    neck: new THREE.CylinderGeometry(0.052, 0.062, 0.08, 10),
    skull: new THREE.SphereGeometry(0.16, 22, 18).scale(0.88, 1.04, 0.92),
    jaw: new THREE.SphereGeometry(0.115, 16, 12).scale(1.02, 0.72, 0.94),
    eye: new THREE.SphereGeometry(0.033, 12, 10),
    pupil: new THREE.SphereGeometry(0.0135, 8, 8),
    brow: new THREE.BoxGeometry(0.062, 0.016, 0.024),
    nose: new THREE.SphereGeometry(0.032, 10, 8).scale(0.85, 1.2, 1.05),
    ear: new THREE.SphereGeometry(0.03, 10, 8).scale(0.45, 1, 0.75),
    mouth: new THREE.BoxGeometry(0.075, 0.016, 0.012),
    hairCap: new THREE.SphereGeometry(0.168, 22, 12, 0, Math.PI * 2, 0, 1.25),
    buzzCap: new THREE.SphereGeometry(0.163, 22, 12, 0, Math.PI * 2, 0, 1.15),
    mohawkFin: new THREE.BoxGeometry(0.034, 0.13, 0.05),
    hatCap: new THREE.SphereGeometry(0.17, 22, 12, 0, Math.PI * 2, 0, 1.05),
    hatBrim: new THREE.CylinderGeometry(0.105, 0.115, 0.018, 14, 1, false, -1.1, 2.2)
      .scale(1.25, 1, 1.5),
    gunBody: new THREE.BoxGeometry(0.06, 0.09, 0.34),
    gunBarrel: new THREE.CylinderGeometry(0.016, 0.016, 0.22, 8).rotateX(Math.PI / 2),
    board: new THREE.BoxGeometry(0.17, 0.028, 0.66),
    wheel: new THREE.CylinderGeometry(0.026, 0.026, 0.03, 10).rotateZ(Math.PI / 2),
    armor: new THREE.CapsuleGeometry(0.235, 0.26, 6, 14).scale(1.12, 1, 0.78),
    helmet: new THREE.SphereGeometry(0.178, 20, 12, 0, Math.PI * 2, 0, 1.45),
    tie: new THREE.BoxGeometry(0.07, 0.24, 0.016),
    sash: new THREE.BoxGeometry(0.5, 0.11, 0.3),
    jacketPanel: new THREE.CapsuleGeometry(0.075, 0.34, 4, 10).scale(1, 1, 1.6),
  };

  // shared material cache — rigs reuse programs instead of minting per-mesh
  const rigMatCache = new Map();
  function rigMat(color, rough = 0.85, metal = 0) {
    const key = `${color}|${rough}|${metal}`;
    let m = rigMatCache.get(key);
    if (!m) {
      m = std({ color, roughness: rough, metalness: metal, side: THREE.DoubleSide });
      rigMatCache.set(key, m);
    }
    return m;
  }

  function makeRig(e) {
    const look = BODY_LOOKS[e.typeName];
    const face = FACE_LOOKS[e.typeName];
    const rig = new THREE.Group();
    const parts = {};
    const mat = c => rigMat(c);
    const skinMat = rigMat(face.skin, 0.62);

    const hips = new THREE.Group();
    hips.position.y = 0.88;
    rig.add(hips);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(G.leg, mat(look.pants));
      leg.position.set(side * 0.112, 0, 0);
      const boot = new THREE.Mesh(G.boot, rigMat(0x1c1c20, 0.55));
      boot.position.set(0, -0.84, 0.05);
      leg.add(boot);
      hips.add(leg);
      parts[side < 0 ? 'legL' : 'legR'] = leg;
    }

    const upper = new THREE.Group();
    upper.position.y = 0.88;
    rig.add(upper);
    parts.upper = upper;
    const shirtMat = mat(look.shirt);
    parts.torso = new THREE.Mesh(G.torso, shirtMat);
    parts.torso.position.y = 0.3;
    upper.add(parts.torso);
    const belt = new THREE.Mesh(G.belt, rigMat(0x24242a, 0.7));
    belt.position.y = 0.05;
    upper.add(belt);
    if (look.jacket) {
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(G.jacketPanel, mat(look.jacket));
        panel.position.set(side * 0.15, 0.3, 0.015);
        upper.add(panel);
      }
    }
    if (look.sash) {
      const sash = new THREE.Mesh(G.sash, mat(look.sash));
      sash.position.y = 0.33; sash.rotation.z = 0.5;
      upper.add(sash);
    }
    if (look.tie) {
      const tie = new THREE.Mesh(G.tie, mat(look.tie));
      tie.position.set(0, 0.3, 0.145); tie.rotation.x = 0.06;
      upper.add(tie);
    }
    const armMat = mat(look.jacket || look.shirt);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(G.arm, armMat);
      arm.position.set(side * 0.245, 0.495, 0);
      const shoulder = new THREE.Mesh(G.shoulder, armMat);
      shoulder.position.set(side * -0.012, 0.01, 0);
      shoulder.scale.setScalar(0.92);
      const hand = new THREE.Mesh(G.hand, skinMat);
      hand.position.set(0, -0.578, 0);
      arm.add(shoulder, hand);
      upper.add(arm);
      parts[side < 0 ? 'armL' : 'armR'] = arm;
    }

    // ------------------------------------------------ sculpted head
    const head = new THREE.Group();
    head.position.y = 0.585;
    upper.add(head);
    parts.head = head;
    const neck = new THREE.Mesh(G.neck, skinMat);
    neck.position.y = 0.02;
    const skull = new THREE.Mesh(G.skull, skinMat);
    skull.position.y = 0.195;
    const jaw = new THREE.Mesh(G.jaw, skinMat);
    jaw.position.set(0, 0.085, 0.018);
    head.add(neck, skull, jaw);
    const whiteMat = rigMat(0xf4f2ea, 0.35);
    const blackMat = rigMat(0x141414, 0.3);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(G.eye, whiteMat);
      eye.position.set(side * 0.058, 0.215, 0.115);
      const pupil = new THREE.Mesh(G.pupil, blackMat);
      pupil.position.set(0, 0, 0.026);
      eye.add(pupil);
      const brow = new THREE.Mesh(G.brow, rigMat(face.brow, 0.8));
      brow.position.set(side * 0.06, 0.262, 0.126);
      brow.rotation.set(-0.12, 0, side * -0.4);       // permanent scowl
      head.add(eye, brow);
      const ear = new THREE.Mesh(G.ear, skinMat);
      ear.position.set(side * 0.142, 0.185, -0.005);
      head.add(ear);
    }
    const nose = new THREE.Mesh(G.nose, skinMat);
    nose.position.set(0, 0.16, 0.145);
    const mouth = new THREE.Mesh(G.mouth, rigMat(0x4a2018, 0.6));
    mouth.position.set(0, 0.068, 0.134);
    mouth.rotation.x = -0.15;
    head.add(nose, mouth);

    const hairMat = rigMat(look.hair, 0.9);
    if (look.hairStyle === 'mohawk') {
      for (let i = 0; i < 5; i++) {
        const fin = new THREE.Mesh(G.mohawkFin, hairMat);
        const t = (i - 2) / 2;
        fin.position.set(0, 0.335 - Math.abs(t) * 0.05, t * -0.1);
        fin.rotation.x = t * 0.55;
        head.add(fin);
      }
    } else if (look.hairStyle === 'flat' || look.hairStyle === 'combover') {
      const hair = new THREE.Mesh(G.hairCap, hairMat);
      hair.position.set(0, 0.195, -0.008);
      hair.rotation.z = look.hairStyle === 'combover' ? 0.1 : 0;
      head.add(hair);
    } else if (look.hairStyle === 'buzz') {
      const hair = new THREE.Mesh(G.buzzCap, hairMat);
      hair.position.set(0, 0.2, -0.005);
      head.add(hair);
    } else if (look.hairStyle === 'cap' || look.hairStyle === 'backcap') {
      const top = new THREE.Mesh(G.hatCap, hairMat);
      top.position.set(0, 0.2, 0);
      const brim = new THREE.Mesh(G.hatBrim, hairMat);
      const fwd = look.hairStyle === 'cap' ? 1 : -1;
      brim.position.set(0, 0.245, fwd * 0.16);
      brim.rotation.y = fwd < 0 ? Math.PI : 0;
      brim.rotation.x = fwd * -0.1;
      head.add(top, brim);
    }
    if (e.elite) {
      const armor = new THREE.Mesh(G.armor, rigMat(0x3f4a5a, 0.45, 0.5));
      armor.position.y = 0.3;
      upper.add(armor);
      const helm = new THREE.Mesh(G.helmet, rigMat(0x39424e, 0.4, 0.5));
      helm.position.set(0, 0.19, 0);
      head.add(helm);
    }
    if (look.weapon) {
      parts.gun = new THREE.Group();
      const body = new THREE.Mesh(G.gunBody, rigMat(look.weapon, 0.4, 0.7));
      const barrel = new THREE.Mesh(G.gunBarrel, rigMat(0x101216, 0.35, 0.8));
      barrel.position.set(0, 0.02, -0.26);
      parts.gun.add(body, barrel);
      parts.gun.position.set(0.04, -0.56, 0.14);
      parts.armR.add(parts.gun);
    }
    if (look.board) {
      parts.gun = new THREE.Group();
      const deck = new THREE.Mesh(G.board, rigMat(0xc8583a, 0.7));
      parts.gun.add(deck);
      const wheelMat = rigMat(0xe8e0c8, 0.5);
      for (const [wx, wz] of [[-0.06, -0.24], [0.06, -0.24], [-0.06, 0.24], [0.06, 0.24]]) {
        const w = new THREE.Mesh(G.wheel, wheelMat);
        w.position.set(wx, 0.035, wz);
        parts.gun.add(w);
      }
      parts.gun.position.set(0.02, -0.58, 0.12);
      parts.gun.rotation.x = 0.5;
      parts.armR.add(parts.gun);
    }

    rig.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.enemy = e;
        o.userData.part = 'body';
      }
    });
    parts.head.traverse(o => { if (o.isMesh) o.userData.part = 'head'; });
    const s = e.type.scale;
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
        if (e.deadT > 0.6) rig.position.y = -(e.deadT - 0.6) * 2.2;
        continue;
      }

      const p = Game.S.player;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      rig.rotation.y = Math.PI / 2 - a;
      rig.rotation.x = e.pain > 0 ? -0.14 : (e.charging > 0 ? 0.22 : 0);

      const walk = Math.sin(e.animT * e.type.speed * 3.2) * 0.55;
      if (e.windupT > 0) {
        P.legL.rotation.x = walk * 0.25; P.legR.rotation.x = -walk * 0.25;
        P.armL.rotation.x = e.type.melee ? -2.7 : -1.5;
        P.armR.rotation.x = e.type.melee ? -2.7 : -1.5;
      } else if (e.flash > 0) {
        P.armL.rotation.x = e.type.melee ? -0.4 : -1.5;
        P.armR.rotation.x = e.type.melee ? -0.4 : -1.5;
      } else {
        P.legL.rotation.x = walk; P.legR.rotation.x = -walk;
        P.armL.rotation.x = -walk * 0.6; P.armR.rotation.x = walk * 0.6;
        P.upper.rotation.y = walk * 0.1;              // shoulder counter-sway
        P.upper.position.y = 0.88 + Math.abs(walk) * 0.018;
      }
    }
    for (const [e, rig] of rigs) {
      if (!seen.has(e)) {
        scene.remove(rig);
        rigs.delete(e);
      }
    }
  }

  // ------------------------------------------------------------- pickups
  const pickupProtos = {
    ammo: () => new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.26),
      std({ color: 0x5a6a38, roughness: 0.7, metalness: 0.2 })),
    nachos: () => {
      const gp = new THREE.Group();
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.24),
        std({ color: 0xc0392b, roughness: 0.7 }));
      const chips = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.2, 6),
        std({ color: 0xf6c945, roughness: 0.8 }));
      chips.position.y = 0.14;
      gp.add(basket, chips);
      return gp;
    },
    grenade: () => new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
      std({ color: 0x3f5f3f, roughness: 0.5, metalness: 0.3 })),
    armor: () => new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.09),
      std({ color: 0x4a70a8, roughness: 0.4, metalness: 0.5 })),
  };
  const pickupMeshes = new Map();
  function syncPickups(time) {
    const seen = new Set();
    for (const pk of Game.S.pickups) {
      seen.add(pk);
      let m = pickupMeshes.get(pk);
      if (!m) {
        m = pickupProtos[pk.kind]();
        m.traverse(o => { if (o.isMesh) o.castShadow = true; });
        scene.add(m);
        pickupMeshes.set(pk, m);
      }
      m.position.set(pk.x, 0.4 + Math.sin(time * 3 + pk.bob) * 0.07, pk.y);
      m.rotation.y = time * 1.6 + pk.bob;
    }
    for (const [pk, m] of pickupMeshes)
      if (!seen.has(pk)) { scene.remove(m); pickupMeshes.delete(pk); }
  }

  const grenadeMeshes = new Map();
  const grenadeGeo = new THREE.SphereGeometry(0.08, 8, 6);
  const grenadeMat = std({ color: 0x2e4a2e, roughness: 0.5, metalness: 0.3 });
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
    size: 0.08, vertexColors: true, sizeAttenuation: true,
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
      tPos[i * 6] = t.x0; tPos[i * 6 + 1] = t.z0 ?? 1.4; tPos[i * 6 + 2] = t.y0;
      tPos[i * 6 + 3] = t.x1; tPos[i * 6 + 4] = t.z1 ?? 1.4; tPos[i * 6 + 5] = t.y1;
    }
    tGeo.setDrawRange(0, n * 2);
    tGeo.attributes.position.needsUpdate = true;
  }

  // ------------------------------------------------------------- decals
  const decalTex = new THREE.CanvasTexture(Textures.bulletHole);
  const decals = [];
  const decalGeo = new THREE.PlaneGeometry(0.1, 0.1);
  function addDecal(point, normal) {
    const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
      map: decalTex, transparent: true, depthWrite: false, opacity: 0.95,
    }));
    m.position.copy(point).addScaledVector(normal, 0.014);
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

  // ----------------------------------------------------- 3D weapon rigs
  const gunMetal = std({ color: 0x17191d, roughness: 0.34, metalness: 0.85, envMapIntensity: 1.2 });
  const gunMetal2 = std({ color: 0x2c3038, roughness: 0.42, metalness: 0.75, envMapIntensity: 1.1 });
  const gunSteel = std({ color: 0x6a7078, roughness: 0.25, metalness: 0.95, envMapIntensity: 1.4 });
  const gunWood = std({ color: 0x4a2f14, roughness: 0.55, metalness: 0 });
  const gunGrip = std({ color: 0x202226, roughness: 0.72, metalness: 0.15 });
  const gunOlive = std({ color: 0x37412e, roughness: 0.6, metalness: 0.1 });
  const gunGlass = std({
    color: 0x9fd0e8, roughness: 0.06, metalness: 0.9,
    envMapIntensity: 2, transparent: true, opacity: 0.85,
  });

  function cyl(r, l, mat, alongZ = true) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 12), mat);
    if (alongZ) m.rotation.x = Math.PI / 2;
    return m;
  }
  function bx(w, h, d, mat) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }
  function sights(gp, y, zr, zf) {
    const rear = bx(0.026, 0.014, 0.012, gunMetal);
    rear.position.set(0, y, zr);
    const rearL = bx(0.007, 0.016, 0.012, gunMetal);
    rearL.position.set(-0.012, y + 0.008, zr);
    const rearR = rearL.clone();
    rearR.position.x = 0.012;
    const front = bx(0.006, 0.02, 0.01, gunMetal);
    front.position.set(0, y + 0.004, zf);
    gp.add(rear, rearL, rearR, front);
  }

  function buildGun(key) {
    const gp = new THREE.Group();
    let sightY = 0.05, muzzleZ = -0.3, trigZ = 0.02;
    if (key === 'pistol') {
      const slide = bx(0.05, 0.05, 0.2, gunMetal2); slide.position.set(0, 0.03, -0.04);
      const frame = bx(0.046, 0.036, 0.17, gunMetal); frame.position.set(0, -0.008, -0.03);
      const grip = bx(0.044, 0.12, 0.06, gunGrip);
      grip.position.set(0, -0.07, 0.045); grip.rotation.x = 0.22;
      gp.add(slide, frame, grip);
      // slide serrations + hammer + exposed barrel muzzle
      for (let i = 0; i < 4; i++) {
        const ser = bx(0.052, 0.036, 0.006, gunMetal);
        ser.position.set(0, 0.032, 0.038 + i * 0.012);
        gp.add(ser);
      }
      const hammer = bx(0.016, 0.026, 0.014, gunSteel);
      hammer.position.set(0, 0.05, 0.062); hammer.rotation.x = -0.5;
      const bore = cyl(0.011, 0.02, gunSteel); bore.position.set(0, 0.03, -0.145);
      gp.add(hammer, bore);
      sights(gp, 0.062, 0.05, -0.13);
      sightY = 0.062; muzzleZ = -0.15; trigZ = 0.005;
    } else if (key === 'smg') {
      const recv = bx(0.055, 0.07, 0.3, gunMetal); recv.position.set(0, 0, -0.05);
      const shroud = cyl(0.021, 0.16, gunMetal2); shroud.position.set(0, 0.01, -0.27);
      const mag = bx(0.036, 0.17, 0.05, gunMetal2);
      mag.position.set(0, -0.11, -0.06); mag.rotation.x = 0.12;
      const grip = bx(0.04, 0.1, 0.05, gunGrip);
      grip.position.set(0, -0.08, 0.06); grip.rotation.x = 0.25;
      const stock = bx(0.02, 0.03, 0.16, gunMetal); stock.position.set(0, 0.01, 0.16);
      const pad = bx(0.03, 0.08, 0.03, gunMetal); pad.position.set(0, -0.01, 0.24);
      // shroud cooling rings + mag baseplate + charging handle
      for (let i = 0; i < 3; i++) {
        const ring = cyl(0.024, 0.008, gunMetal); ring.position.set(0, 0.01, -0.21 - i * 0.05);
        gp.add(ring);
      }
      const plate = bx(0.04, 0.014, 0.056, gunSteel);
      plate.position.set(0, -0.195, -0.048); plate.rotation.x = 0.12;
      const chandle = bx(0.03, 0.012, 0.02, gunSteel);
      chandle.position.set(0.035, 0.02, 0.02);
      gp.add(plate, chandle);
      gp.add(recv, shroud, mag, grip, stock, pad);
      sights(gp, 0.055, 0.06, -0.3);
      sightY = 0.055; muzzleZ = -0.36; trigZ = 0.025;
    } else if (key === 'rifle') {
      const recv = bx(0.056, 0.07, 0.3, gunMetal); recv.position.set(0, 0, 0.0);
      const guard = bx(0.052, 0.055, 0.16, gunWood); guard.position.set(0, 0.002, -0.21);
      const gas = cyl(0.01, 0.14, gunMetal2); gas.position.set(0, 0.032, -0.24);
      const barrel = cyl(0.012, 0.16, gunMetal); barrel.position.set(0, 0.008, -0.37);
      const mag1 = bx(0.038, 0.1, 0.055, gunMetal2);
      mag1.position.set(0, -0.085, -0.03); mag1.rotation.x = 0.3;
      const mag2 = bx(0.038, 0.09, 0.05, gunMetal2);
      mag2.position.set(0, -0.15, 0.008); mag2.rotation.x = 0.62;
      const grip = bx(0.042, 0.1, 0.055, gunGrip);
      grip.position.set(0, -0.075, 0.1); grip.rotation.x = 0.3;
      const stock = bx(0.045, 0.085, 0.2, gunWood);
      stock.position.set(0, -0.015, 0.24); stock.rotation.x = -0.08;
      // slant muzzle brake, front-sight wings, charging handle, dust cover rib
      const brake = cyl(0.017, 0.045, gunMetal2); brake.position.set(0, 0.008, -0.465);
      brake.rotation.z = 0.3;
      for (const side of [-1, 1]) {
        const wing = bx(0.008, 0.03, 0.014, gunMetal);
        wing.position.set(side * 0.014, 0.108, -0.42); wing.rotation.z = side * -0.35;
        gp.add(wing);
      }
      const chandle = bx(0.034, 0.014, 0.026, gunSteel);
      chandle.position.set(0.04, 0.022, 0.06);
      const rib = bx(0.058, 0.012, 0.22, gunMetal2); rib.position.set(0, 0.042, 0.02);
      gp.add(brake, chandle, rib);
      gp.add(recv, guard, gas, barrel, mag1, mag2, grip, stock);
      sights(gp, 0.062, 0.1, -0.42);
      sightY = 0.062; muzzleZ = -0.46; trigZ = 0.055;
    } else if (key === 'shotgun') {
      const bl = cyl(0.014, 0.44, gunMetal); bl.position.set(-0.016, 0.015, -0.22);
      const br = cyl(0.014, 0.44, gunMetal); br.position.set(0.016, 0.015, -0.22);
      const under = cyl(0.013, 0.3, gunMetal2); under.position.set(0, -0.018, -0.2);
      const pump = bx(0.056, 0.05, 0.15, gunWood); pump.position.set(0, -0.02, -0.22);
      const recv = bx(0.06, 0.075, 0.2, gunMetal2); recv.position.set(0, 0, 0.02);
      const stock = bx(0.05, 0.095, 0.24, gunWood);
      stock.position.set(0, -0.02, 0.22); stock.rotation.x = -0.1;
      const bead = bx(0.008, 0.012, 0.008, std({ color: 0xd8c15a, roughness: 0.3, metalness: 0.8 }));
      bead.position.set(0, 0.036, -0.43);
      // pump ribs + barrel band + ejection port
      for (let i = 0; i < 4; i++) {
        const ribb = bx(0.06, 0.008, 0.012, gunMetal);
        ribb.position.set(0, -0.043, -0.17 - i * 0.032);
        gp.add(ribb);
      }
      const band = bx(0.062, 0.02, 0.02, gunSteel); band.position.set(0, 0.008, -0.4);
      const port = bx(0.004, 0.028, 0.07, gunSteel); port.position.set(0.031, 0.005, 0.0);
      gp.add(band, port);
      gp.add(bl, br, under, pump, recv, stock, bead);
      sightY = 0.034; muzzleZ = -0.46; trigZ = 0.09;
    } else if (key === 'sniper') {
      const recv = bx(0.06, 0.08, 0.32, gunOlive); recv.position.set(0, 0, 0.02);
      const barrel = cyl(0.017, 0.46, gunMetal); barrel.position.set(0, 0.012, -0.38);
      const brake = bx(0.05, 0.05, 0.07, gunMetal2); brake.position.set(0, 0.012, -0.62);
      const scopeTube = cyl(0.027, 0.18, gunMetal2); scopeTube.position.set(0, 0.078, -0.03);
      const objective = cyl(0.034, 0.05, gunMetal); objective.position.set(0, 0.078, -0.14);
      const ocular = cyl(0.03, 0.04, gunMetal); ocular.position.set(0, 0.078, 0.07);
      const bolt = cyl(0.01, 0.06, gunMetal2, false);
      bolt.position.set(0.05, 0.02, 0.08); bolt.rotation.z = -0.9;
      const stock = bx(0.05, 0.1, 0.26, gunOlive);
      stock.position.set(0, -0.02, 0.26); stock.rotation.x = -0.08;
      const grip = bx(0.042, 0.1, 0.05, gunGrip);
      grip.position.set(0, -0.08, 0.12); grip.rotation.x = 0.35;
      const bipod1 = bx(0.012, 0.012, 0.12, gunMetal2);
      bipod1.position.set(-0.02, -0.03, -0.5); bipod1.rotation.x = 1.2;
      const bipod2 = bipod1.clone(); bipod2.position.x = 0.02;
      // scope glass, windage/elevation turrets, cheek riser, fluted barrel rings
      const lens1 = cyl(0.031, 0.006, gunGlass); lens1.position.set(0, 0.078, -0.166);
      const lens2 = cyl(0.027, 0.006, gunGlass); lens2.position.set(0, 0.078, 0.092);
      const turret1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10), gunMetal);
      turret1.position.set(0, 0.115, -0.03);
      const turret2 = turret1.clone(); turret2.rotation.z = Math.PI / 2;
      turret2.position.set(0.037, 0.078, -0.03);
      const cheek = bx(0.046, 0.03, 0.14, gunGrip); cheek.position.set(0, 0.045, 0.24);
      for (let i = 0; i < 3; i++) {
        const fl = cyl(0.019, 0.008, gunMetal2); fl.position.set(0, 0.012, -0.3 - i * 0.09);
        gp.add(fl);
      }
      gp.add(lens1, lens2, turret1, turret2, cheek);
      gp.add(recv, barrel, brake, scopeTube, objective, ocular, bolt, stock, grip, bipod1, bipod2);
      sightY = 0.078; muzzleZ = -0.66; trigZ = 0.075;
    }
    // notched top rail on the automatics
    if (key === 'rifle' || key === 'smg') {
      const railZ = key === 'rifle' ? -0.05 : -0.1;
      for (let i = 0; i < 6; i++) {
        const notch = bx(0.03, 0.01, 0.012, gunMetal2);
        notch.position.set(0, key === 'rifle' ? 0.052 : 0.04, railZ + i * 0.024);
        gp.add(notch);
      }
    }
    // shared detailing: trigger guard + trigger blade
    {
      const gF = bx(0.01, 0.006, 0.05, gunMetal); gF.position.set(0, -0.052, trigZ);
      const gB = bx(0.01, 0.02, 0.006, gunMetal); gB.position.set(0, -0.042, trigZ + 0.025);
      const gFr = bx(0.01, 0.02, 0.006, gunMetal); gFr.position.set(0, -0.042, trigZ - 0.025);
      const trig = bx(0.008, 0.024, 0.007, gunSteel);
      trig.position.set(0, -0.04, trigZ + 0.008); trig.rotation.x = 0.25;
      gp.add(gF, gB, gFr, trig);
    }
    // the player's arms: sleeves + hands so the gun isn't floating
    const handMat = std({ color: 0xe8bd85, roughness: 0.8 });
    const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.34), sleeveMat);
    rSleeve.position.set(0.045, -0.13, 0.22); rSleeve.rotation.set(0.5, -0.12, 0);
    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.1), handMat);
    rHand.position.set(0.004, -0.075, 0.1);
    const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.3), sleeveMat);
    lSleeve.position.set(-0.12, -0.14, -0.08); lSleeve.rotation.set(0.45, -0.55, 0.1);
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.1), handMat);
    lHand.position.set(-0.005, -0.045, key === 'pistol' ? -0.02 : -0.2);
    gp.add(rSleeve, rHand, lSleeve, lHand);

    // muzzle flash sprite at the tip
    const flash = glowSprite(0.24, 'rgba(255,240,180,1)', 'rgba(255,140,20,0)');
    flash.position.set(0, key === 'sniper' ? 0.012 : sightY - 0.02, muzzleZ);
    flash.visible = false;
    gp.add(flash);
    gp.traverse(o => { o.frustumCulled = false; });
    gp.scale.set(GUN_SCALE, GUN_SCALE, GUN_SCALE);
    gp.userData = { sightY, muzzleZ, flash };
    gp.visible = false;
    camera.add(gp);
    return gp;
  }
  const GUN_SCALE = 0.72;
  const sleeveMat = std({ color: 0x57575c, roughness: 0.85 });
  const guns = {};
  for (const key of SLOT_ORDER) guns[key] = buildGun(key);

  let swayA = 0, swayP = 0, prevA = null, prevPitch = 0;
  function updateWeapon(dt) {
    const S = Game.S, p = S.player;
    for (const key of SLOT_ORDER) guns[key].visible = false;
    if (!p || S.mode === 'menu') return;
    const sp = WEAPONS[p.weapon];
    const gun = guns[p.weapon];
    const ud = gun.userData;
    const scoped = sp.scope && p.adsT > 0.92;
    if (scoped) return;                       // the 2D scope overlay takes over
    gun.visible = true;

    if (prevA === null) { prevA = p.a; prevPitch = p.pitch; }
    let dA = p.a - prevA;
    if (dA > Math.PI) dA -= Math.PI * 2; if (dA < -Math.PI) dA += Math.PI * 2;
    const dP = p.pitch - prevPitch;
    prevA = p.a; prevPitch = p.pitch;
    swayA += (dA - swayA) * Math.min(1, dt * 10);
    swayP += (dP - swayP) * Math.min(1, dt * 10);

    const ads = p.adsT * p.adsT * (3 - 2 * p.adsT);
    const bobX = Math.sin(p.bobPhase) * 0.012 * p.bobMag * (1 - ads * 0.9);
    const bobY = Math.abs(Math.cos(p.bobPhase)) * 0.008 * p.bobMag * (1 - ads * 0.9);
    const idle = Math.sin(S.time * 1.7) * 0.0022 * (1 - ads);
    const reloadT = p.reloading > 0
      ? Math.sin(Math.min(1, 1 - p.reloading / (p.reloadTotal || sp.reload)) * Math.PI) : 0;
    const swapDip = p.swapT > 0 ? p.swapT : 0;

    // hip vs ADS anchors (ADS puts the sight line on the camera axis)
    const hip = { x: 0.19, y: -0.175, z: -0.48 };
    const adsP = { x: 0, y: -ud.sightY * GUN_SCALE, z: -0.36 };
    gun.position.set(
      hip.x + (adsP.x - hip.x) * ads - swayA * 0.06 * (1 - ads * 0.7) + bobX,
      hip.y + (adsP.y - hip.y) * ads + swayP * 0.0004 * (1 - ads * 0.7) + bobY + idle
        - reloadT * 0.13 - swapDip * 0.4
        - (p.sprinting ? 0.07 : 0) - (p.slideT > 0 ? 0.05 : 0),
      hip.z + (adsP.z - hip.z) * ads + p.recoil * 0.055
    );
    gun.rotation.set(
      -swayP * 0.0016 - p.recoil * 0.09 - reloadT * 0.7
        + (p.sprinting ? 0.55 : 0) + (p.slideT > 0 ? 0.3 : 0),
      -swayA * 0.35 * (1 - ads * 0.7) + (p.sprinting ? 0.35 : 0),
      (p.sprinting ? 0.25 : 0) + (p.slideT > 0 ? 0.18 : 0)
    );

    // muzzle flash
    const f = ud.flash;
    f.visible = p.recoil > 0.55;
    if (f.visible) {
      const s = 0.16 + Math.random() * 0.14;
      f.scale.set(s, s, 1);
      f.material.rotation = Math.random() * Math.PI;
    }
  }

  // ------------------------------------------------------------- hitscan
  const raycaster = new THREE.Raycaster();
  raycaster.far = 80;
  const _dir = new THREE.Vector3();
  function hitscan(yawOff, pitchOff) {
    _dir.set(yawOff, pitchOff, -1).normalize().applyQuaternion(camera.quaternion);
    raycaster.set(camera.position, _dir);
    const targets = [...solidMeshes];
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
      let normal = h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0);
      if (h.object === floor) normal.set(0, 1, 0);
      else if (!h.object.isInstancedMesh) {
        // props may be rotated: bring the normal to world space
        normal.transformDirection(h.object.matrixWorld);
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

  // ------------------------------------------------------------ post fx
  composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  const normalPass = new NormalPass(scene, camera);
  composer.addPass(normalPass);
  const depthDownsample = new DepthDownsamplingPass({
    normalBuffer: normalPass.texture,
    resolutionScale: 0.5,
  });
  composer.addPass(depthDownsample);
  const ssaoEffect = new SSAOEffect(camera, normalPass.texture, {
    blendFunction: BlendFunction.MULTIPLY,
    distanceScaling: true,
    depthAwareUpsampling: true,
    normalDepthBuffer: depthDownsample.texture,
    samples: 14, rings: 5,
    luminanceInfluence: 0.65,
    radius: 0.09, intensity: 2.2, bias: 0.028, fade: 0.02,
    resolutionScale: 0.5,
    color: new THREE.Color(0x0a0704),
    worldDistanceThreshold: 22, worldDistanceFalloff: 6,
    worldProximityThreshold: 0.5, worldProximityFalloff: 0.2,
  });
  ssaoPass = new EffectPass(camera, ssaoEffect);
  composer.addPass(ssaoPass);

  // volumetric light shafts from the sun, occluded by walls/skyline
  const godRaysEffect = new GodRaysEffect(camera, sunMesh, {
    blendFunction: BlendFunction.SCREEN,
    kernelSize: KernelSize.SMALL,
    density: 0.94, decay: 0.93, weight: 0.35, exposure: 0.32,
    samples: 42, clampMax: 1,
    resolutionScale: 0.5,
  });
  const godRaysPass = new EffectPass(camera, godRaysEffect);
  composer.addPass(godRaysPass);

  const bloomEffect = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    mipmapBlur: true,
    luminanceThreshold: 0.72, luminanceSmoothing: 0.34,
    intensity: 1.1, radius: 0.7, levels: 8,
    kernelSize: KernelSize.MEDIUM,
  });
  const toneEffect = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const gradeEffect = new HueSaturationEffect({ hue: 0, saturation: 0.14 });
  const contrastEffect = new BrightnessContrastEffect({ brightness: 0.012, contrast: 0.1 });
  const vignetteEffect = new VignetteEffect({ offset: 0.28, darkness: 0.55 });
  const noiseEffect = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
  noiseEffect.blendMode.opacity.value = 0.05;
  composer.addPass(new EffectPass(camera,
    bloomEffect, toneEffect, gradeEffect, contrastEffect, vignetteEffect, noiseEffect));

  smaaPass = new EffectPass(camera, new SMAAEffect());
  composer.addPass(smaaPass);
  setSize();

  function applyQuality() {
    const on = Game.settings.postfx !== false;
    ssaoPass.enabled = on;
    smaaPass.enabled = on;
    godRaysPass.enabled = on;
  }

  // ------------------------------------------------------------- camera
  function applyCamera(dt) {
    const S = Game.S;
    if (S.mode === 'menu') {
      const at = S.attract;
      camera.position.set(at.x, EYE(0.52), at.y);
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

    const shakeAmp = (Game.settings.shake ? S.shake : 0) * 0.005;
    const bobY = Math.sin(p.bobPhase * 2) * 0.028 * p.bobMag;
    camera.position.set(
      p.x + (Math.random() - 0.5) * shakeAmp,
      EYE(p.eye) + bobY + (Math.random() - 0.5) * shakeAmp,
      p.y + (Math.random() - 0.5) * shakeAmp
    );
    camera.rotation.y = -p.a - Math.PI / 2;
    camera.rotation.x = (p.pitch + p.recoilPitch) / 170 * 0.72;
    camera.rotation.z = p.roll;

    muzzleLight.intensity = S.flash > 0 ? 3.2 : 0;
    if (S.flash > 0) {
      _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      muzzleLight.position.copy(camera.position).addScaledVector(_dir, 0.7);
    }
  }

  // ------------------------------------------------------------- frame
  function render(dt) {
    const S = Game.S;
    if (S.mode === 'playing') tuneResolution(dt);
    applyCamera(dt);
    updateWeapon(dt);
    applyQuality();

    for (const c of clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 80) c.position.x = -30;
    }
    const t = S.time || performance.now() / 1000;
    for (let i = 0; i < DUST; i++) {
      dustPos[i * 3 + 1] = 0.3 + (Math.sin(t * dustSeed[i * 2 + 1] + dustSeed[i * 2]) * 0.5 + 0.5) * 2.2;
      dustPos[i * 3] += Math.sin(t * 0.13 + dustSeed[i * 2]) * 0.0012;
    }
    dustGeo.attributes.position.needsUpdate = true;

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
    sleeveMat.color.set(CHARACTERS[character].sleeve);
    swayA = 0; swayP = 0; prevA = null; prevPitch = 0;
  }

  return {
    render, onRunStart, hitscan, addDecal, worldToScreen, setSize,
    stats: () => ({ W, H, renderScale }),
    _debug: { camera, raycaster, scene, solidMeshes, rigs },
  };
})();
