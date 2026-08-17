// The loop. Simulation only advances while playing; the renderer always runs.
(() => {
  let last = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const mode = Game.S.mode;
    if (mode === 'playing') Game.update(dt);
    else if (mode === 'menu') Game.updateAttract(dt);
    Renderer.render(dt);
  }
  requestAnimationFrame(tick);
})();
