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

    // skull: forehead slopes back under the quiff; the jaw is the story
    g.fillStyle = SKIN;
    g.beginPath();
    g.moveTo(31, 52);                          // left temple
    g.quadraticCurveTo(30, 30, 50, 27);        // crown (hidden by hair)
    g.quadraticCurveTo(70, 30, 69, 52);        // right temple
    g.quadraticCurveTo(71, 70, 68, 80);        // right cheek
    g.quadraticCurveTo(68, 94, 61, 102);       // right jaw, thrust forward
    g.quadraticCurveTo(52, 108, 41, 104);      // big jutting chin shelf
    g.quadraticCurveTo(33, 98, 32, 82);        // left jaw
    g.quadraticCurveTo(29, 70, 31, 52);        // left cheek
    g.closePath();
    g.fill(); g.stroke();

    // ears
    g.fillStyle = SKIN;
    g.beginPath(); g.ellipse(29.5, 66, 4, 6.5, -0.1, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(70.5, 66, 4, 6.5, 0.1, 0, 7); g.fill(); g.stroke();
    g.lineWidth = 1.2;
    g.beginPath(); g.arc(29.5, 66, 2.2, -1, 1.6); g.stroke();
    g.beginPath(); g.arc(70.5, 66, 2.2, Math.PI - 1.6, Math.PI + 1); g.stroke();

    // hair: the towering blond pompadour — a rounded swept-back cloud
    // with soft scallops, overhanging the forehead
    g.fillStyle = '#e9c25e';
    g.beginPath();
    g.moveTo(28, 52);
    g.quadraticCurveTo(23, 40, 26, 26);        // left side rises steeply
    g.quadraticCurveTo(28, 12, 38, 6);         // up into the cloud
    g.quadraticCurveTo(44, 2.5, 50, 4);        // scallop 1
    g.quadraticCurveTo(55, 1, 62, 4);          // scallop 2
    g.quadraticCurveTo(70, 6.5, 74, 14);       // scallop 3, swept back-right
    g.quadraticCurveTo(78, 24, 75, 36);        // back of the quiff
    g.quadraticCurveTo(73, 46, 71, 52);
    g.quadraticCurveTo(66, 42, 50, 41);        // underside overhang
    g.quadraticCurveTo(34, 42, 28, 52);
    g.closePath();
    g.fill();
    g.strokeStyle = '#96771c'; g.lineWidth = 1.8; g.stroke();
    // sweep lines inside the quiff
    g.strokeStyle = 'rgba(150,119,28,0.55)'; g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(34, 34); g.quadraticCurveTo(40, 18, 52, 12);
    g.moveTo(44, 38); g.quadraticCurveTo(52, 24, 64, 16);
    g.moveTo(58, 38); g.quadraticCurveTo(65, 28, 70, 22);
    g.stroke();

    // forehead wrinkle zigzag over the brow
    g.strokeStyle = LINE; g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(40, 48); g.lineTo(46, 45.5); g.lineTo(52, 48); g.lineTo(58, 45.5); g.lineTo(63, 48);
    g.stroke();

    // THE brow ridge, heavy and low
    g.strokeStyle = LINE; g.lineWidth = 2.8;
    g.beginPath();
    g.moveTo(33, 57);
    g.quadraticCurveTo(42, hurt ? 59.5 : 54.5, 49, 57.5);
    g.moveTo(51, 57.5);
    g.quadraticCurveTo(58, hurt ? 59.5 : 54.5, 67, 57);
    g.stroke();

    // eyes: close-set under the ridge, one squinting harder
    g.fillStyle = '#fff'; g.strokeStyle = LINE; g.lineWidth = 1.5;
    g.beginPath(); g.arc(44, 62, hurt ? 5 : 4.4, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(56, 62.5, hurt ? 5 : 3.7, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#141414';
    g.beginPath(); g.arc(44.6, 62.6, 1.5, 0, 7); g.arc(55.5, 63, 1.4, 0, 7); g.fill();

    // nose: a sharp beak hooking down from the brow
    g.fillStyle = SKIN_DK;
    g.beginPath();
    g.moveTo(48, 58.5);
    g.quadraticCurveTo(45.5, 68, 44.5, 74);
    g.quadraticCurveTo(44.5, 78.5, 49, 79);    // pointed hooked tip
    g.quadraticCurveTo(53.5, 78, 53.5, 74.5);
    g.quadraticCurveTo(53, 66, 52, 58.5);
    g.closePath();
    g.fill();
    g.strokeStyle = LINE; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = '#7a5230'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(46.5, 77); g.lineTo(48, 77.8); g.stroke();

    if (hurt) {
      g.fillStyle = '#7c3226';
      g.beginPath(); g.ellipse(50, 92, 10, 8, 0, 0, 7); g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#fff';
      g.fillRect(42.5, 84.5, 15, 4.5);
      g.strokeRect(42.5, 84.5, 15, 4.5);
    } else {
      // the enormous underbite grin: mouth open, upper teeth bared over
      // a dark cavity, the lower jaw shelf pushed way out
      g.fillStyle = '#43201a';                 // open mouth behind the teeth
      g.beginPath();
      g.moveTo(34, 84);
      g.quadraticCurveTo(50, 79, 66, 84);
      g.quadraticCurveTo(64, 97, 50, 99);
      g.quadraticCurveTo(36, 97, 34, 84);
      g.closePath();
      g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
      // upper teeth row: big squarish teeth with visible gaps
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(35.5, 83.5);
      g.quadraticCurveTo(50, 79.5, 64.5, 83.5);
      g.lineTo(63, 90.5);
      g.quadraticCurveTo(50, 87.5, 37, 90.5);
      g.closePath();
      g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.4; g.stroke();
      g.lineWidth = 1.1;
      g.beginPath();
      for (let i = 1; i < 5; i++) {
        const x = 36.5 + i * 5.5;
        g.moveTo(x, 81.5 + Math.abs(i - 2.5) * 0.5); g.lineTo(x - 0.5, 89.5);
      }
      g.stroke();
      // the jutting lower jaw lip
      g.strokeStyle = LINE; g.lineWidth = 1.9;
      g.beginPath(); g.moveTo(37, 98); g.quadraticCurveTo(50, 102.5, 63, 98); g.stroke();
      // grin corner creases
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(33, 80); g.quadraticCurveTo(31.5, 83, 32.5, 86);
      g.moveTo(67, 80); g.quadraticCurveTo(68.5, 83, 67.5, 86);
      g.stroke();
    }
  }

  // -------------------------------------------------------- BUTT-HEAD
  function butthead(g, expr) {
    const hurt = expr === 'hurt';

    // long thin neck
    g.fillStyle = SKIN;
    g.strokeStyle = LINE; g.lineWidth = 1.8;
    g.fillRect(43, 108, 14, 22);
    g.strokeRect(43, 108, 14, 22);

    // skull: enormously tall; face narrows down a long slope to the chin
    g.fillStyle = SKIN;
    g.beginPath();
    g.moveTo(29, 46);
    g.quadraticCurveTo(28, 14, 50, 12);
    g.quadraticCurveTo(72, 14, 71, 46);
    g.quadraticCurveTo(73, 72, 68, 88);
    g.quadraticCurveTo(64, 106, 55, 112);
    g.quadraticCurveTo(50, 115, 45, 112);
    g.quadraticCurveTo(36, 106, 32, 88);
    g.quadraticCurveTo(27, 72, 29, 46);
    g.closePath();
    g.fill(); g.stroke();

    // ears, small and low
    g.beginPath(); g.ellipse(28.5, 72, 3.6, 6, -0.1, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(71.5, 72, 3.6, 6, 0.1, 0, 7); g.fill(); g.stroke();

    // hair: one tall rounded brown mass with a wavy edge and scribbled
    // curl texture, sideburn points curving in front of the ears
    g.fillStyle = '#7a4a20';
    g.beginPath();
    g.moveTo(27, 58);                          // left sideburn point
    g.quadraticCurveTo(24, 40, 28, 26);
    g.quadraticCurveTo(32, 10, 46, 7);         // big rounded crown
    g.quadraticCurveTo(50, 6, 54, 7);
    g.quadraticCurveTo(68, 10, 72, 26);
    g.quadraticCurveTo(76, 40, 73, 58);        // right sideburn point
    g.quadraticCurveTo(71, 52, 68, 49);        // wavy underside edge
    g.quadraticCurveTo(63, 44, 57, 46);
    g.quadraticCurveTo(52, 42, 48, 46);
    g.quadraticCurveTo(42, 43, 37, 47);
    g.quadraticCurveTo(31, 51, 27, 58);
    g.closePath();
    g.fill();
    g.strokeStyle = '#3c2408'; g.lineWidth = 1.8; g.stroke();
    // scribbled curl texture
    g.strokeStyle = 'rgba(50,28,8,0.6)'; g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(33, 36); g.quadraticCurveTo(37, 26, 45, 22);
    g.moveTo(40, 40); g.quadraticCurveTo(46, 28, 55, 24);
    g.moveTo(52, 40); g.quadraticCurveTo(58, 30, 64, 28);
    g.moveTo(60, 42); g.quadraticCurveTo(66, 34, 69, 30);
    g.moveTo(30, 44); g.quadraticCurveTo(33, 34, 38, 30);
    g.arc(44, 14, 3, 0, 4);
    g.moveTo(56, 12); g.arc(53, 14, 3, 0, 4);
    g.stroke();

    // the vast bare forehead, then thin angry brows far below the hair
    g.strokeStyle = '#3c2408'; g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(34, hurt ? 56 : 58); g.lineTo(46, 61);
    g.moveTo(54, 61); g.lineTo(66, hurt ? 56 : 58);
    g.stroke();

    // eyes: narrow sleepy slits right under the brows
    g.fillStyle = '#fff'; g.strokeStyle = LINE; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(40.5, 65.5, 5.4, hurt ? 4.6 : 3, 0.08, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(59.5, 65.5, 5.4, hurt ? 4.6 : 3, -0.08, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#141414';
    g.beginPath(); g.arc(41.5, 66, 1.6, 0, 7); g.arc(58.5, 66, 1.6, 0, 7); g.fill();

    // THE nose: long bulb with huge flaring comma-nostrils
    g.fillStyle = SKIN_DK;
    g.beginPath();
    g.moveTo(46, 62);
    g.quadraticCurveTo(42, 74, 40, 80);        // left flank flares out
    g.quadraticCurveTo(38, 86, 43, 87.5);      // left nostril wing
    g.quadraticCurveTo(47, 89, 50, 88.5);
    g.quadraticCurveTo(53, 89, 57, 87.5);
    g.quadraticCurveTo(62, 86, 60, 80);        // right nostril wing
    g.quadraticCurveTo(58, 74, 54, 62);
    g.closePath();
    g.fill();
    g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
    // the nostrils themselves: big dark commas
    g.fillStyle = '#4a2c10';
    g.beginPath();
    g.moveTo(41.5, 84.5); g.quadraticCurveTo(41, 80.5, 44.5, 80);
    g.quadraticCurveTo(47, 80, 46.5, 83); g.quadraticCurveTo(45.5, 85.5, 41.5, 84.5);
    g.moveTo(58.5, 84.5); g.quadraticCurveTo(59, 80.5, 55.5, 80);
    g.quadraticCurveTo(53, 80, 53.5, 83); g.quadraticCurveTo(54.5, 85.5, 58.5, 84.5);
    g.fill();

    if (hurt) {
      g.fillStyle = '#7c3226';
      g.beginPath(); g.ellipse(50, 101, 10, 6.5, 0, 0, 7); g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#d9d9de';
      g.fillRect(43, 95.5, 14, 3.6);
      g.strokeRect(43, 95.5, 14, 3.6);
    } else {
      // open grin: red upper gums with braced teeth over a dark mouth
      g.fillStyle = '#3c1c16';                 // open mouth
      g.beginPath();
      g.moveTo(35, 94);
      g.quadraticCurveTo(50, 89, 65, 94);
      g.quadraticCurveTo(63, 104, 50, 105.5);
      g.quadraticCurveTo(37, 104, 35, 94);
      g.closePath();
      g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke();
      // gums band
      g.fillStyle = '#c4574a';
      g.beginPath();
      g.moveTo(36, 93.5);
      g.quadraticCurveTo(50, 88.5, 64, 93.5);
      g.lineTo(63, 96.5);
      g.quadraticCurveTo(50, 92.5, 37, 96.5);
      g.closePath();
      g.fill();
      g.strokeStyle = LINE; g.lineWidth = 1.2; g.stroke();
      // teeth with the braces band
      g.fillStyle = '#e9e9ee';
      g.beginPath();
      g.moveTo(37.5, 96);
      g.quadraticCurveTo(50, 92.5, 62.5, 96);
      g.lineTo(61.5, 100.5);
      g.quadraticCurveTo(50, 97.5, 38.5, 100.5);
      g.closePath();
      g.fill(); g.stroke();
      g.strokeStyle = '#7c828c'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(38.5, 98); g.quadraticCurveTo(50, 94.8, 61.5, 98); g.stroke();
      g.strokeStyle = LINE; g.lineWidth = 0.9;
      g.beginPath();
      for (let i = 1; i < 5; i++) {
        const x = 39 + i * 4.6;
        g.moveTo(x, 94 + Math.abs(i - 2.5) * 0.5); g.lineTo(x - 0.3, 99.5);
      }
      g.stroke();
      // chin crease + smug cheek line
      g.strokeStyle = LINE; g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(45, 108.5); g.quadraticCurveTo(50, 110, 55, 108.5);
      g.moveTo(66, 88); g.quadraticCurveTo(69, 92, 67.5, 97);
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
