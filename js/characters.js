// Procedural portraits of the two dumbasses, drawn cel-style in a
// 100x130 design space and scaled. Iterated against reference memory:
// what matters is the silhouette — Beavis's brow shelf + flame of hair
// + underbite; Butt-Head's tall skull + curtain part + snout + braces.
const Characters = (() => {
  const SKIN = '#f0c98c', SKIN_DK = '#d8a862';
  const LINE = '#4a3018';

  function head(g, s, who, expr) {
    const u = s / 100;
    g.save();
    g.scale(u, u);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    if (who === 'beavis') beavis(g, expr);
    else butthead(g, expr);
    g.restore();
  }

  // ----------------------------------------------------------- BEAVIS
  function beavis(g, expr) {
    const hurt = expr === 'hurt';

    // skinny neck
    g.fillStyle = SKIN;
    g.strokeStyle = LINE; g.lineWidth = 1.8;
    g.fillRect(44, 100, 12, 30);
    g.strokeRect(44, 100, 12, 30);

    // skull: tall forehead, brow shelf, broad short jaw (the underbite base)
    g.fillStyle = SKIN;
    g.beginPath();
    g.moveTo(31, 54);                          // left temple
    g.quadraticCurveTo(29, 26, 50, 23);        // domed crown
    g.quadraticCurveTo(71, 26, 69, 54);        // right temple
    g.quadraticCurveTo(71, 72, 67, 84);        // right cheek
    g.quadraticCurveTo(66, 100, 58, 105);      // right jaw
    g.quadraticCurveTo(50, 109, 42, 105);      // broad chin
    g.quadraticCurveTo(34, 100, 33, 84);       // left jaw
    g.quadraticCurveTo(29, 72, 31, 54);        // left cheek
    g.closePath();
    g.fill(); g.stroke();

    // ears
    g.fillStyle = SKIN;
    g.beginPath(); g.ellipse(29.5, 68, 4, 6.5, -0.1, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(70.5, 68, 4, 6.5, 0.1, 0, 7); g.fill(); g.stroke();
    g.lineWidth = 1.2;
    g.beginPath(); g.arc(29.5, 68, 2.2, -1, 1.6); g.stroke();
    g.beginPath(); g.arc(70.5, 68, 2.2, Math.PI - 1.6, Math.PI + 1); g.stroke();

    // hair: the blond flame — irregular jags swept up and back, wide base
    g.fillStyle = '#f5d33d';
    g.beginPath();
    g.moveTo(28, 54);
    g.lineTo(25, 36);
    const peaks = [
      [29, 14], [34, 27], [37, 6], [43, 24], [47, 2], [52, 20],
      [56, 1], [61, 19], [64, 5], [69, 24], [72, 12], [75, 36],
    ];
    for (const [px, py] of peaks) g.lineTo(px, py);
    g.lineTo(72, 54);
    g.quadraticCurveTo(68, 41, 50, 40);        // hairline (tall forehead below)
    g.quadraticCurveTo(32, 41, 28, 54);
    g.closePath();
    g.fill();
    g.strokeStyle = '#9a7a14'; g.lineWidth = 1.8; g.stroke();

    // forehead wrinkles
    g.strokeStyle = LINE; g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(38, 46); g.quadraticCurveTo(50, 43, 62, 46);
    g.moveTo(37, 50); g.quadraticCurveTo(50, 47, 63, 50);
    g.stroke();

    // THE brow shelf: one heavy ridge across the whole face
    g.strokeStyle = LINE; g.lineWidth = 2.8;
    g.beginPath();
    g.moveTo(33, 58);
    g.quadraticCurveTo(42, hurt ? 60 : 55.5, 49, 58);
    g.quadraticCurveTo(50, 58.5, 51, 58);
    g.quadraticCurveTo(58, hurt ? 60 : 55.5, 67, 58);
    g.stroke();
    g.lineWidth = 1.2;                          // scowl notches above the nose
    g.beginPath();
    g.moveTo(48, 54.5); g.lineTo(48.5, 57); g.moveTo(52, 54.5); g.lineTo(51.5, 57);
    g.stroke();

    // eyes: small and beady, jammed right under the shelf
    g.fillStyle = '#fff'; g.strokeStyle = LINE; g.lineWidth = 1.5;
    g.beginPath(); g.arc(44.5, 62, hurt ? 4.8 : 3.9, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(55.5, 62, hurt ? 4.8 : 3.9, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#141414';
    g.beginPath(); g.arc(45, 62.7, 1.5, 0, 7); g.arc(55, 62.7, 1.5, 0, 7); g.fill();

    // nose: long, thin, pointy — hangs from the brow to over the mouth
    g.fillStyle = SKIN_DK;
    g.beginPath();
    g.moveTo(48.5, 59);
    g.quadraticCurveTo(46.5, 70, 46, 76);
    g.quadraticCurveTo(46.5, 80, 50, 80.5);    // hooked tip
    g.quadraticCurveTo(53.5, 79.5, 53.5, 76);
    g.quadraticCurveTo(53, 68, 51.5, 59);
    g.closePath();
    g.fill();
    g.strokeStyle = LINE; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = '#7a5230'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(47.5, 78.5); g.lineTo(48.8, 79.3); g.stroke();

    // cheek creases framing the grin
    g.strokeStyle = LINE; g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(43, 79); g.quadraticCurveTo(38, 84, 36.5, 90);
    g.moveTo(57, 79); g.quadraticCurveTo(62, 84, 63.5, 90);
    g.stroke();

    if (hurt) {
      // yelling
      g.fillStyle = '#84362a';
      g.beginPath(); g.ellipse(50, 92, 9.5, 7.5, 0, 0, 7); g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#fff';
      g.fillRect(43, 85.5, 14, 4);
      g.strokeRect(43, 85.5, 14, 4);
    } else {
      // the underbite grin: big bared upper teeth, lower lip pushed up
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(36.5, 85);
      g.quadraticCurveTo(50, 82, 63.5, 85);    // top of teeth follows the lip
      g.lineTo(62.5, 95);
      g.quadraticCurveTo(50, 97.5, 37.5, 95);
      g.closePath();
      g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < 6; i++) {
        const x = 36.5 + i * 4.5;
        g.moveTo(x, 84 + Math.abs(i - 3) * 0.4); g.lineTo(x, 95.4);
      }
      g.stroke();
      // jutting lower lip right under the teeth
      g.strokeStyle = LINE; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(39, 99.5); g.quadraticCurveTo(50, 102.5, 61, 99.5); g.stroke();
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(45, 105); g.quadraticCurveTo(50, 106.5, 55, 105); g.stroke();
    }
  }

  // -------------------------------------------------------- BUTT-HEAD
  function butthead(g, expr) {
    const hurt = expr === 'hurt';

    // neck
    g.fillStyle = SKIN;
    g.strokeStyle = LINE; g.lineWidth = 1.8;
    g.fillRect(43, 106, 14, 24);
    g.strokeRect(43, 106, 14, 24);

    // skull: enormous tall cranium, long face, weak little chin
    g.fillStyle = SKIN;
    g.beginPath();
    g.moveTo(30, 52);
    g.quadraticCurveTo(28, 16, 50, 14);
    g.quadraticCurveTo(72, 16, 70, 52);
    g.quadraticCurveTo(72, 74, 68, 88);
    g.quadraticCurveTo(65, 104, 56, 110);
    g.quadraticCurveTo(50, 113, 44, 110);
    g.quadraticCurveTo(35, 104, 32, 88);
    g.quadraticCurveTo(28, 74, 30, 52);
    g.closePath();
    g.fill(); g.stroke();

    // ears
    g.beginPath(); g.ellipse(28.5, 70, 4, 7, -0.1, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(71.5, 70, 4, 7, 0.1, 0, 7); g.fill(); g.stroke();
    g.lineWidth = 1.2;
    g.beginPath(); g.arc(28.5, 70, 2.2, -1, 1.6); g.stroke();
    g.beginPath(); g.arc(71.5, 70, 2.2, Math.PI - 1.6, Math.PI + 1); g.stroke();

    // hair: dark curtain — TWO distinct rounded mounds with a deep notch
    // at the center part, side flaps hanging over the temples
    g.fillStyle = '#5a3a1e';
    g.beginPath();
    g.moveTo(26.5, 62);                        // left flap tip by the ear
    g.quadraticCurveTo(24, 36, 29, 20);        // left mound outer rise
    g.quadraticCurveTo(35, 11.5, 42, 13);      // left lobe crown (wide)
    g.quadraticCurveTo(47.5, 14.5, 48.8, 20);  // curls toward the part
    g.lineTo(49.2, 35);                        // down into the notch
    g.lineTo(50.8, 35);
    g.lineTo(51.2, 20);
    g.quadraticCurveTo(52.5, 14.5, 58, 13);    // right lobe crown
    g.quadraticCurveTo(65, 11.5, 71, 20);
    g.quadraticCurveTo(76, 36, 73.5, 62);      // right flap tip
    g.lineTo(69, 57);
    g.quadraticCurveTo(67, 47, 60, 45);        // right underside
    g.quadraticCurveTo(55, 43, 51, 47);
    g.lineTo(49, 47);
    g.quadraticCurveTo(45, 43, 40, 45);        // left underside
    g.quadraticCurveTo(33, 47, 31, 57);
    g.closePath();
    g.fill();
    g.strokeStyle = '#33200e'; g.lineWidth = 1.8; g.stroke();

    // forehead wrinkles
    g.strokeStyle = LINE; g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(40, 50); g.quadraticCurveTo(50, 48, 60, 50);
    g.stroke();

    // heavy low brow bar, riding right on the lids
    g.strokeStyle = '#2e1c0c'; g.lineWidth = 3.8;
    g.beginPath();
    g.moveTo(33, hurt ? 57 : 60.5); g.quadraticCurveTo(41, 59.5, 47.5, 61);
    g.moveTo(52.5, 61); g.quadraticCurveTo(59, 59.5, 67, hurt ? 57 : 60.5);
    g.stroke();

    // eyes: heavy-lidded and vacant — lids slice the circles in half
    g.fillStyle = '#fff'; g.strokeStyle = LINE; g.lineWidth = 1.5;
    g.beginPath(); g.arc(41, 67, 5.6, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(59, 67, 5.6, 0, 7); g.fill(); g.stroke();
    if (!hurt) {
      g.fillStyle = SKIN;
      g.fillRect(34.5, 60.5, 13, 6.2);
      g.fillRect(52.5, 60.5, 13, 6.2);
      g.strokeStyle = LINE; g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(35.4, 66.7); g.lineTo(46.6, 66.7);
      g.moveTo(53.4, 66.7); g.lineTo(64.6, 66.7);
      g.stroke();
    }
    g.fillStyle = '#141414';
    g.beginPath(); g.arc(41.5, 68.3, 1.8, 0, 7); g.arc(58.5, 68.3, 1.8, 0, 7); g.fill();

    // THE nose: a big wide snout with huge forward nostrils
    g.fillStyle = SKIN_DK;
    g.beginPath();
    g.moveTo(45, 63);
    g.quadraticCurveTo(38.5, 76, 40, 83);
    g.quadraticCurveTo(43, 88.5, 50, 88.5);
    g.quadraticCurveTo(57, 88.5, 60, 83);
    g.quadraticCurveTo(61.5, 76, 55, 63);
    g.closePath();
    g.fill();
    g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = '#5c3a1c';
    g.beginPath();
    g.ellipse(45.2, 82, 2.6, 3.6, -0.15, 0, 7);
    g.ellipse(54.8, 82, 2.6, 3.6, 0.15, 0, 7);
    g.fill();

    if (hurt) {
      g.fillStyle = '#84362a';
      g.beginPath(); g.ellipse(50, 99, 10, 6.5, 0, 0, 7); g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#d9d9de';
      g.fillRect(43, 93.5, 14, 3.6);
      g.strokeRect(43, 93.5, 14, 3.6);
    } else {
      // gummy braces grin, corners curled
      g.fillStyle = '#cf8f74';                 // the gums
      g.beginPath();
      g.moveTo(33.5, 95);
      g.quadraticCurveTo(50, 88.5, 66.5, 95);
      g.quadraticCurveTo(64, 98.5, 60, 99);
      g.lineTo(40, 99);
      g.quadraticCurveTo(36, 98.5, 33.5, 95);
      g.closePath();
      g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#fff';                    // teeth
      g.beginPath();
      g.moveTo(37, 99); g.lineTo(63, 99);
      g.quadraticCurveTo(62.5, 105.5, 50, 106);
      g.quadraticCurveTo(37.5, 105.5, 37, 99);
      g.closePath();
      g.fill(); g.stroke();
      g.strokeStyle = '#9aa0a8'; g.lineWidth = 2.6;  // braces band
      g.beginPath(); g.moveTo(37.5, 101.6); g.quadraticCurveTo(50, 103.4, 62.5, 101.6); g.stroke();
      g.strokeStyle = '#5a6068'; g.lineWidth = 0.9;
      for (let i = 0; i < 6; i++) {
        const x = 39.5 + i * 4.2;
        g.beginPath(); g.moveTo(x, 100.3); g.lineTo(x, 103.4); g.stroke();
      }
      g.strokeStyle = LINE; g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < 6; i++) { const x = 37 + i * 4.4; g.moveTo(x, 99); g.lineTo(x, 100.6); }
      g.stroke();
      // smug crease by the mouth corners
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(32, 92); g.quadraticCurveTo(30.5, 94.5, 31.5, 97);
      g.moveTo(68, 92); g.quadraticCurveTo(69.5, 94.5, 68.5, 97);
      g.stroke();
    }
  }

  // ----------------------------------------------------- compositions
  function shirt(g, who, w, h, yTop) {
    const ch = CHARACTERS[who];
    g.fillStyle = ch.shirt;
    g.beginPath();
    g.moveTo(w * 0.02, h);
    g.quadraticCurveTo(w * 0.04, yTop + h * 0.05, w * 0.28, yTop);
    g.lineTo(w * 0.72, yTop);
    g.quadraticCurveTo(w * 0.96, yTop + h * 0.05, w * 0.98, h);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.stroke();
    // collar
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = w * 0.018;
    g.beginPath();
    g.ellipse(w / 2, yTop + w * 0.015, w * 0.115, w * 0.045, 0, 0, Math.PI);
    g.stroke();
    // generic metal-tee lightning glyph
    g.fillStyle = 'rgba(255,255,255,0.85)';
    const bx = w / 2, by = yTop + h * 0.09, s = w * 0.055;
    g.beginPath();
    g.moveTo(bx - s * 0.2, by - s);
    g.lineTo(bx + s * 0.55, by - s);
    g.lineTo(bx + s * 0.1, by - s * 0.15);
    g.lineTo(bx + s * 0.5, by - s * 0.15);
    g.lineTo(bx - s * 0.45, by + s);
    g.lineTo(bx - s * 0.05, by + s * 0.05);
    g.lineTo(bx - s * 0.5, by + s * 0.05);
    g.closePath();
    g.fill();
  }

  function portrait(who, size, expr = 'normal') {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    // shirt sliver behind the neck
    g.fillStyle = CHARACTERS[who].shirt;
    g.fillRect(0, size * 0.9, size, size * 0.1);
    // uniform scale: design y 4..118 fits the square, face centered
    const k = size / 116;
    g.save();
    g.translate(size / 2 - 50 * k, -4 * k);
    head(g, 100 * k, who, expr);
    g.restore();
    return c;
  }

  // menu bust: head + shoulders, nothing cropped
  function bust(who, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const s = h * 0.72;                    // head design height 130 -> ~0.94h
    const u = s / 100;
    const yTop = h * 0.8;
    shirt(g, who, w, h, yTop);
    g.save();
    g.translate(w / 2 - 50 * u, yTop - 104 * u);
    head(g, s, who, 'normal');
    g.restore();
    return c;
  }

  return { head, portrait, bust };
})();
