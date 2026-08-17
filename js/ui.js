// DOM overlays: main menu (with settings), pause, death screen.
const UI = (() => {
  const $ = id => document.getElementById(id);
  const menu = $('menu'), pauseEl = $('pause'), deadEl = $('dead');
  let character = Game.savedCharacter();

  function show(el) {
    for (const o of [menu, pauseEl, deadEl]) o.classList.add('hidden');
    if (el) el.classList.remove('hidden');
  }

  // ------------------------------------------------ character select
  const cards = { beavis: $('card-beavis'), butthead: $('card-butthead') };
  for (const who of ['beavis', 'butthead']) {
    const bustC = Characters.bust(who, 460, 500);  // 2x for crisp downscale
    cards[who].querySelector('.face').appendChild(bustC);
    cards[who].addEventListener('click', () => {
      selectCharacter(who);
      Sound.play('uiClick');
    });
    cards[who].addEventListener('mouseenter', () => Sound.play('uiHover'));
  }
  function selectCharacter(who) {
    character = who;
    cards.beavis.classList.toggle('selected', who === 'beavis');
    cards.butthead.classList.toggle('selected', who === 'butthead');
  }
  selectCharacter(character);

  function refreshStats() {
    const s = Game.stats();
    $('career').textContent = s.bestScore > 0
      ? `CAREER: ${s.careerRank} · BEST SCORE ${s.bestScore} · BEST WAVE ${s.bestWave}`
      : 'FRESH MEAT — NO SERVICE RECORD';
  }
  refreshStats();

  // ------------------------------------------------------- settings
  const bindRange = (id, key, fmt) => {
    const el = $(id), out = $(id + '-val');
    el.value = Game.settings[key];
    out.textContent = fmt(Game.settings[key]);
    el.addEventListener('input', () => {
      Game.settings[key] = parseFloat(el.value);
      out.textContent = fmt(Game.settings[key]);
      Game.saveSettings();
    });
  };
  const bindCheck = (id, key) => {
    const el = $(id);
    el.checked = !!Game.settings[key];
    el.addEventListener('change', () => {
      Game.settings[key] = el.checked;
      Game.saveSettings();
      if (key === 'music' && el.checked) Sound.music.start();
    });
  };
  bindRange('set-sens', 'sens', v => `${Number(v).toFixed(2)}×`);
  bindRange('set-fov', 'fov', v => `${Math.round(v)}°`);
  bindRange('set-sfx', 'volSfx', v => `${Math.round(v * 100)}%`);
  bindRange('set-music', 'volMusic', v => `${Math.round(v * 100)}%`);
  bindCheck('set-voice', 'voice');
  bindCheck('set-musicon', 'music');
  bindCheck('set-dmg', 'dmgNumbers');
  bindCheck('set-shake', 'shake');
  bindCheck('set-maprot', 'minimapRotate');

  $('btn-settings').addEventListener('click', () => {
    $('settings-panel').classList.toggle('hidden');
    Sound.play('uiClick');
  });

  // -------------------------------------------------------- buttons
  const wire = (id, fn) => $(id).addEventListener('click', () => { Sound.play('uiClick'); fn(); });
  wire('btn-start', () => { show(null); Game.start(character); });
  wire('btn-resume', () => { show(null); Game.resume(); });
  wire('btn-restart', () => { show(null); Game.restart(); });
  wire('btn-quit', () => Game.quitToMenu());
  wire('btn-respawn', () => { show(null); Game.restart(); });
  wire('btn-dead-quit', () => Game.quitToMenu());

  document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && !pauseEl.classList.contains('hidden')) {
      show(null); Game.resume();
    }
  });

  return {
    showMenu() { refreshStats(); show(menu); },
    showPause() { show(pauseEl); },
    showDead(stats) {
      $('dead-stats').innerHTML =
        `<div class="stat"><span>SCORE</span><b>${stats.score}</b></div>` +
        `<div class="stat"><span>WAVE REACHED</span><b>${stats.wave}</b></div>` +
        `<div class="stat"><span>KILLS</span><b>${stats.kills}</b></div>` +
        `<div class="stat"><span>RANK</span><b>${stats.rank}</b></div>` +
        `<div class="stat dim"><span>BEST SCORE</span><b>${stats.bestScore}</b></div>` +
        `<div class="stat dim"><span>CAREER RANK</span><b>${stats.careerRank}</b></div>`;
      show(deadEl);
    },
  };
})();
