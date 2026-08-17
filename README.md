# Beavis & Butt-Head Shooter — Huh-Huh Warfare

A modern, Call-of-Duty-flavored first-person wave shooter starring Beavis and
Butt-Head, rendered in clean stylized 3D (WebGL). Zero asset files — every
texture, character, portrait, and sound is generated in code at runtime.

Built on the same stack as a modern three.js production:
[three](https://threejs.org/) `0.185` + the pmndrs
[postprocessing](https://github.com/pmndrs/postprocessing) pipeline, bundled
with [Vite](https://vitejs.dev/).

## Play

**Online:** once GitHub Pages is enabled for this repo
(Settings → Pages → Source → *GitHub Actions*), every push to `main` deploys
automatically to:

> https://vharoutounian.github.io/beavisbuttheadshooter/

**Locally:**

```sh
npm install
npm run dev        # dev server at http://localhost:5173
```

```sh
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Pick your dumbass, click **DEPLOY**, and click the screen to grab mouse lock.

## Controls

| Input | Action |
| --- | --- |
| `WASD` | Move |
| Mouse | Aim / fire |
| Right mouse (hold) | Aim down sights (sniper scopes in) |
| `Shift` | Sprint |
| `C` / `Ctrl` | Crouch — press while sprinting to **slide** |
| `R` | Reload |
| `G` | Throw grenade (look up to throw farther) |
| `Tab` / `B` | Shop (between waves) |
| `1`–`5` / wheel | Switch weapon |
| `P` / `Esc` | Pause |
| Arrow keys | Turn / move (trackpad fallback) |
| `M` / `V` / `N` | Toggle SFX / voice / music |

## What's in it

- **Beavis or Butt-Head** — reference-accurate hand-drawn portraits
  (the towering blond pompadour, brow ridge, and underbite grin; the tall
  skull, hooded eyes, giant nostrils, and gums-and-braces smile),
  per-character traits (Beavis: faster fire and reloads; Butt-Head:
  +25 HP and faster regen), and their own speech-synthesis one-liners
  for kills, headshots, killstreaks, shopping, and dying.
- **Five guns + grenades** — BB-9 Blaster, Scorcher SMG, Thrasher AK, Nacho
  Boomstick, and the Dillweed .50 bolt sniper with a full scope overlay.
  Magazines, reserves, damage falloff, spread, recoil, tracers, shell
  casings, and bullet-hole decals.
- **Modern movement & gunfeel** — sprint, slide, crouch, ADS with true
  iron-sight alignment, weapon sway/inertia, camera roll on strafe and
  slide, real vertical aim with **headshots** (look up at heads — pitch
  matters), and lower profile means enemies miss more.
- **The economy** — kills pay cash; between waves hit `Tab` for the School
  Store: buy weapons, ammo, armor plates, grenades, and three perks
  (Winger Grip, Nacho Body, Fast Hands).
- **COD systems** — regenerating health + armor, hitmarkers (white/head/kill
  variants), dynamic crosshair, damage-direction arcs + compass pings,
  medals (HEADSHOT, LONGSHOT, POINT BLANK, ONE TAP, DOUBLE/TRIPLE/MEGA KILL,
  SLIDE KILL…), floating damage numbers, kill feed, rotating minimap,
  rank progression with an XP bar (PRIVATE BUTTMUNCH → THE GREAT CORNHOLIO,
  career XP persists), and killstreaks at 3/5/7 kills.
- **Waves at Highland High** — posers, skaters (fast, erratic, swing
  skateboards), jocks, hall monitors, charging Coach Buzzcut Jr., and
  Principal McDoom as the boss every 5th wave with a top-bar health meter.
  From wave 8, armored **elites** appear. Attack tokens keep the mob honest —
  only a few enemies engage at once while the rest flank and orbit.
- **Audio** — layered synthesized gunshots, positional stereo panning
  (footsteps and shots pan by direction), UI sounds, and a dynamic tension
  music bed that intensifies with the horde.
- **Settings** — sensitivity, FOV, SFX/music volume, voice, damage numbers,
  screen shake, rotating minimap; all persisted.

## Engine notes

- **Real-time 3D (WebGL / three.js `0.185`)**: corridor-height PBR walls
  with procedural normal maps, a sunlit floor, concrete wall trim, crate
  and sandbag cover you can actually fight around, a distant city
  skyline, drifting clouds, a visible sun with glow, floating dust
  motes, warm directional sun with soft dynamic shadows, and distance
  fog.
- **Cinematic post stack** (pmndrs `postprocessing`): SSAO ambient
  occlusion, HDR bloom, AGX filmic tone mapping, a color grade
  (saturation, contrast), vignette, film grain, and SMAA — toggleable in
  settings.
- **3D first-person weapons**: all five guns are real 3D models riding
  the camera — with your character's arms and hands on them — with hip
  and true iron-sight ADS positions, sway, recoil kick, reload and swap
  animation, sprint/slide poses, and a muzzle flash that lights the
  walls.
- **Human-proportioned 3D characters**: each enemy type is a
  procedurally-assembled rig (letterman jackets, mohawks, backwards
  caps, sashes, skateboards, elite armor + helmets) with face textures,
  walk/attack animation, telegraphed windups, and physical death falls.
- **True 3D combat**: shots raycast through the actual camera with
  separate head/body colliders, 3D tracers, bullet-hole decals stuck to
  surfaces with their normals, shell casings, and grenades that arc in
  3D. Crates and barriers block movement and bullets but you can shoot
  over them.
- **Native-resolution + dynamic scaling**: renders at your display's
  resolution (devicePixelRatio-aware, up to 1440p internal) and steps
  the internal resolution down/up automatically to hold frame rate. The
  HUD is a separate vector-drawn overlay, razor sharp at any size.
- Gameplay simulation stays on the 2D grid: enemies pathfind on a shared
  BFS flow field with local separation, LOS chases, standoff orbiting,
  and attack tokens. All SFX are WebAudio synthesis; portraits and HUD
  art are drawn to canvases at load.

Append `?debug=1` to the URL for an FPS counter and `Game.cheat`
(god/cash/wave/give/nuke) — handy for poking at later waves.

---

Unofficial parody fan game. Beavis and Butt-Head are trademarks of their
respective owners; this project is not affiliated with or endorsed by them.
