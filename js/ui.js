// DOM menus: main menu, pause, and death screen.
const UI = (() => {
  const $ = id => document.getElementById(id);
  const menu = $('menu'), pauseEl = $('pause'), deadEl = $('dead');
  let character = Game.savedCharacter();

  function show(el) {
    for (const o of [menu, pauseEl, deadEl]) o.classList.add('hidden');
    if (el) el.classList.remove('hidden');
  }

  // character cards
  const cards = { beavis: $('card-beavis'), butthead: $('card-butthead') };
  for (const who of ['beavis', 'butthead']) {
    const face = Textures.portrait(who, 160);
    cards[who].querySelector('.face').appendChild(face);
    cards[who].addEventListener('click', () => selectCharacter(who));
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

  $('btn-start').addEventListener('click', () => { show(null); Game.start(character); });
  $('btn-resume').addEventListener('click', () => { show(null); Game.resume(); });
  $('btn-restart').addEventListener('click', () => { show(null); Game.restart(); });
  $('btn-quit').addEventListener('click', () => Game.quitToMenu());
  $('btn-respawn').addEventListener('click', () => { show(null); Game.restart(); });
  $('btn-dead-quit').addEventListener('click', () => Game.quitToMenu());

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
