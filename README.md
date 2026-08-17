# Beavis & Butt-Head Shooter — Huh-Huh Warfare

A Call-of-Duty-flavored first-person wave shooter starring Beavis and Butt-Head,
running on a hand-rolled raycasting engine. Zero dependencies, zero build step,
zero asset files — every texture, sprite, and sound is generated in the browser
at runtime.

## Play

Open `index.html` in a browser. That's it.

If your browser is picky about `file://` pages (pointer lock usually works fine,
but just in case), serve it locally:

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
| Right mouse (hold) | Aim down sights |
| `Shift` | Sprint |
| `R` | Reload |
| `G` | Throw grenade |
| `1` `2` `3` / wheel | Switch weapon |
| Arrow keys | Turn / move (trackpad fallback) |
| `P` / `Esc` | Pause |
| `M` | Sound effects on/off |
| `V` | Voice lines on/off |

## What's in it

- **Playable characters** — Beavis or Butt-Head, each with their own voice
  lines (via the browser's speech synthesis) and portrait.
- **Three guns + grenades** — the Burrito Blaster 9 (pistol), Turbo Thrasher AK
  (full auto), and the Nacho Boomstick (shotgun), with magazines, reserve ammo,
  reloads, damage falloff, and spread.
- **COD feel** — aim-down-sights zoom, sprint, regenerating health, hitmarkers,
  dynamic crosshair, damage-direction indicators, screen shake, kill feed,
  minimap, and rank progression from PRIVATE BUTTMUNCH up to THE GREAT
  CORNHOLIO (career XP persists in localStorage).
- **Killstreaks** — 3 kills: *Nacho Rush* (heal + speed), 5: *TP for the
  Bunghole* (double damage + grenades), 7: *Air Guitar Strike* (everything you
  can see gets deleted). Take a beating and you lose your streak.
- **Waves at Highland High** — posers, jocks, and hall monitors pathfind
  through the school on a flow field; every 5th wave the Principal shows up
  with a health bar over his combover.
- **Drops** — ammo crates, grenades, and nachos (+35 HP).

## Engine notes

- Classic DDA raycaster (à la Wolfenstein 3D) drawing 2px textured columns,
  with a z-buffer for billboard sprites (enemies, pickups, grenades, particles).
- Enemy pathfinding is one shared BFS flow field from the player, recomputed a
  few times per second; enemies steer downhill on it plus local separation.
- All art is drawn to offscreen canvases on load; all SFX are synthesized with
  WebAudio oscillators and filtered noise.

---

Unofficial parody fan game. Beavis and Butt-Head are trademarks of their
respective owners; this project is not affiliated with or endorsed by them.
