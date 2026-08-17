// Entry point: wire the modules, start the loop.
import { Game } from './game.js';
import { Renderer } from './render3d.js';
import { Hud } from './hud.js';
import { initUI } from './ui.js';

initUI();

// Debug/test hooks: modules are no longer page globals, so surface them
// explicitly when ?debug=1 (used by the headless QA harness).
if (Game.S.debug) {
  window.Game = Game;
  window.Renderer = Renderer;
}

let last = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  const mode = Game.S.mode;
  if (mode === 'playing') Game.update(dt);
  else if (mode === 'menu') Game.updateAttract(dt);
  Renderer.render(dt);   // 3D world
  Hud.render(dt);        // 2D overlay
}
requestAnimationFrame(tick);
