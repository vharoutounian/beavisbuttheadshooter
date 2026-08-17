# Beavis & Butt-Head Shooter — Huh-Huh Warfare

A modern, Call-of-Duty-flavored first-person wave shooter starring Beavis and
Butt-Head, on a hand-rolled raycasting engine. Zero dependencies, zero build
step, zero asset files — every texture, sprite, portrait, and sound is
generated in the browser at runtime.

## Play

Open `index.html` in a browser. That's it.

If your browser is picky about `file://` pages, serve it locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
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

- **Beavis or Butt-Head** — faithful hand-drawn portraits, per-character
  traits (Beavis: faster fire and reloads; Butt-Head: +25 HP and faster
  regen), and their own speech-synthesis one-liners for kills, headshots,
  killstreaks, shopping, and dying.
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

- DDA raycaster drawing textured 2px wall columns at 1280×720, plus a true
  perspective **floor and ceiling caster** (typed-array pixel pass with
  distance fog and ceiling light panels), z-buffered billboard sprites with
  shadows, and eye-height support for crouch/slide.
- Enemies pathfind on a shared BFS flow field recomputed a few times per
  second, with local separation, line-of-sight chases, standoff orbiting,
  and windup-telegraphed attacks.
- All art is drawn to offscreen canvases at load (walls, floor/ceiling
  tiles, six enemy types × 10 animation frames each + elite variants,
  five weapon viewmodels, pickups, the scope, portraits); all SFX are
  WebAudio synthesis.

Append `?debug=1` to the URL for an FPS counter and `Game.cheat`
(god/cash/wave/give/nuke) — handy for poking at later waves.

---

Unofficial parody fan game. Beavis and Butt-Head are trademarks of their
respective owners; this project is not affiliated with or endorsed by them.
