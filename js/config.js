// All tuning data lives here. No logic.
const CONFIG = {
  W: 1280, H: 720,          // internal render resolution
  COLW: 2,                  // pixels per wall column
  FLOOR_W: 320, FLOOR_H: 180, // floor/ceiling casting buffer
  PLAYER_RADIUS: 0.22,
  BASE_SPEED: 3.7,
  SPRINT_MULT: 1.55,
  ADS_MULT: 0.55,
  CROUCH_MULT: 0.55,
  SLIDE_SPEED: 7.2,
  SLIDE_TIME: 0.55,
  SLIDE_COOLDOWN: 1.1,
  REGEN_DELAY: 3.6,
  REGEN_RATE: 30,
  MAX_HP: 100,
  MAX_ARMOR: 100,
  MAX_GRENADES: 6,
  FOG_DIST: 17,             // distance where walls fade to black
};

const WEAPONS = {
  pistol: {
    name: 'BB-9 BLASTER', slot: 1, auto: false, pellets: 1,
    dmg: 40, headshot: 1.9, rof: 0.24, mag: 12, maxReserve: 96, reload: 1.05,
    spread: 0.018, adsSpread: 0.003, kick: 10, viewKick: 0.8,
    falloffStart: 10, falloffEnd: 22, minDmgMult: 0.5,
    adsFov: 50, price: 0, sfx: 'shotPistol', tracer: true,
  },
  smg: {
    name: 'SCORCHER SMG', slot: 2, auto: true, pellets: 1,
    dmg: 18, headshot: 1.6, rof: 0.072, mag: 36, maxReserve: 216, reload: 1.6,
    spread: 0.04, adsSpread: 0.014, kick: 4.5, viewKick: 0.45,
    falloffStart: 8, falloffEnd: 18, minDmgMult: 0.5,
    adsFov: 52, price: 1500, sfx: 'shotSmg', tracer: true,
  },
  rifle: {
    name: 'THRASHER AK', slot: 3, auto: true, pellets: 1,
    dmg: 27, headshot: 1.8, rof: 0.1, mag: 30, maxReserve: 180, reload: 1.85,
    spread: 0.032, adsSpread: 0.009, kick: 6.5, viewKick: 0.6,
    falloffStart: 12, falloffEnd: 26, minDmgMult: 0.55,
    adsFov: 48, price: 0, sfx: 'shotRifle', tracer: true,
  },
  shotgun: {
    name: 'NACHO BOOMSTICK', slot: 4, auto: false, pellets: 8,
    dmg: 14, headshot: 1.4, rof: 0.9, mag: 6, maxReserve: 48, reload: 2.2,
    spread: 0.085, adsSpread: 0.05, kick: 26, viewKick: 1.6,
    falloffStart: 4, falloffEnd: 9.5, minDmgMult: 0.15,
    adsFov: 55, price: 2500, sfx: 'shotShotgun', tracer: false,
  },
  sniper: {
    name: 'DILLWEED .50', slot: 5, auto: false, pellets: 1,
    dmg: 120, headshot: 2.5, rof: 1.25, mag: 5, maxReserve: 30, reload: 2.6,
    spread: 0.05, adsSpread: 0.0006, kick: 40, viewKick: 2.2,
    falloffStart: 26, falloffEnd: 40, minDmgMult: 0.8,
    adsFov: 15, scope: true, sway: 0.010, price: 4500, sfx: 'shotSniper', tracer: true,
  },
};
const SLOT_ORDER = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper'];

const ENEMY_TYPES = {
  poser: {
    hp: 62, speed: 2.6, dmg: 13, rate: 0.95, range: 1.15, windup: 0.34,
    score: 100, melee: true, scale: 1.0, label: 'POSER',
    token: 'melee',
  },
  skater: {
    hp: 55, speed: 3.4, dmg: 11, rate: 0.85, range: 1.1, windup: 0.28,
    score: 130, melee: true, scale: 0.95, label: 'SKATER',
    token: 'melee', erratic: true,
  },
  jock: {
    hp: 100, speed: 1.75, dmg: 9, rate: 1.35, range: 9, windup: 0.5,
    score: 150, melee: false, scale: 1.0, label: 'JOCK',
    token: 'ranged',
  },
  monitor: {
    hp: 135, speed: 1.5, dmg: 6, rate: 1.7, range: 11, windup: 0.55,
    score: 200, melee: false, burst: 3, scale: 1.05, label: 'HALL MONITOR',
    token: 'ranged',
  },
  coach: {
    hp: 380, speed: 1.9, dmg: 24, rate: 1.6, range: 1.4, windup: 0.55,
    score: 400, melee: true, scale: 1.22, label: 'COACH BUZZCUT JR.',
    token: 'melee', charges: true,
  },
  principal: {
    hp: 1100, speed: 1.3, dmg: 10, rate: 1.4, range: 8.5, windup: 0.6,
    score: 1200, melee: false, burst: 4, scale: 1.38, boss: true,
    label: 'PRINCIPAL McDOOM', token: 'ranged',
  },
};

// waves: [type weights by wave band]
const WAVE_MIX = [
  { from: 1, mix: { poser: 1 } },
  { from: 2, mix: { poser: 0.7, skater: 0.3 } },
  { from: 3, mix: { poser: 0.45, skater: 0.25, jock: 0.3 } },
  { from: 5, mix: { poser: 0.3, skater: 0.25, jock: 0.3, monitor: 0.15 } },
  { from: 7, mix: { poser: 0.22, skater: 0.23, jock: 0.25, monitor: 0.2, coach: 0.1 } },
  { from: 10, mix: { poser: 0.15, skater: 0.25, jock: 0.2, monitor: 0.25, coach: 0.15 } },
];
const ELITE_FROM_WAVE = 8;     // elites (armored variants) can appear from here
const ELITE_CHANCE = 0.18;

const RANKS = [
  [0, 'PRIVATE BUTTMUNCH'],
  [500, 'CORPORAL DILLWEED'],
  [1200, 'SERGEANT DOOFUS'],
  [2500, 'STAFF SGT. FARTKNOCKER'],
  [4200, 'LIEUTENANT WANNABE'],
  [6500, 'CAPTAIN SEMI-COOL'],
  [9500, 'MAJOR METALHEAD'],
  [13500, 'COLONEL ULTRA-COOL'],
  [18500, 'GENERAL OF NACHOS'],
  [25000, 'THE GREAT CORNHOLIO'],
];

const MEDALS = {
  headshot: { label: 'HEADSHOT', bonus: 25, color: '#ff5f5f' },
  longshot: { label: 'LONGSHOT', bonus: 50, color: '#7fd4ff' },
  pointblank: { label: 'POINT BLANK', bonus: 25, color: '#ffb347' },
  onetap: { label: 'ONE TAP', bonus: 50, color: '#f6c945' },
  double: { label: 'DOUBLE KILL', bonus: 50, color: '#f6c945' },
  triple: { label: 'TRIPLE KILL', bonus: 100, color: '#ff8844' },
  quad: { label: 'MEGA KILL', bonus: 200, color: '#ff4444' },
  boom: { label: 'BOOM, DUMBASS', bonus: 50, color: '#9fd06a' },
  slide: { label: 'SLIDE KILL', bonus: 50, color: '#c39cff' },
};

const PERKS = {
  grip: { label: 'WINGER GRIP', desc: '-30% spread & recoil', price: 2000 },
  nacho: { label: 'NACHO BODY', desc: '+50 max health', price: 2500 },
  hands: { label: 'FAST HANDS', desc: '-40% reload & swap time', price: 2000 },
};

const SHOP = [
  { type: 'weapon', id: 'smg' },
  { type: 'weapon', id: 'shotgun' },
  { type: 'weapon', id: 'sniper' },
  { type: 'ammo', label: 'AMMO REFILL', desc: 'fill all reserves', price: 600 },
  { type: 'armor', label: 'ARMOR PLATES', desc: '+100 armor', price: 1200 },
  { type: 'nade', label: 'GRENADE ×2', desc: 'up to 6 max', price: 500 },
  { type: 'perk', id: 'grip' },
  { type: 'perk', id: 'nacho' },
  { type: 'perk', id: 'hands' },
];

const KILLSTREAKS = [
  { at: 3, name: 'NACHO RUSH', desc: '+40 HEALTH · SPEED BOOST' },
  { at: 5, name: 'TP FOR THE BUNGHOLE', desc: 'DOUBLE DAMAGE · +2 GRENADES' },
  { at: 7, name: 'AIR GUITAR STRIKE', desc: 'TOTAL CARNAGE' },
];

const CHARACTERS = {
  beavis: {
    label: 'BEAVIS',
    quote: '“FIRE! FIRE! FIRE!”',
    trait: 'CORNHOLIO TWITCH',
    traitDesc: '+12% fire rate, +15% reload speed',
    sleeve: '#2a4d9b', shirt: '#3557a7',
    rofMult: 0.88, reloadMult: 0.85, hpBonus: 0,
    voice: { pitch: 1.8, rate: 1.25 },
  },
  butthead: {
    label: 'BUTT-HEAD',
    quote: '“UH HUH HUH. COOL.”',
    trait: 'THICK SKULL',
    traitDesc: '+25 max health, faster regen',
    sleeve: '#57575c', shirt: '#6a6a70',
    rofMult: 1, reloadMult: 1, hpBonus: 25, regenMult: 1.35,
    voice: { pitch: 0.35, rate: 0.85 },
  },
};

const LINES = {
  beavis: {
    kill: ['Heh heh, yes!', 'Fire! Fire!', 'That was cool!', 'Take that, dillweed!',
      'Yes! Yes! Heh heh!', 'Break stuff! Break stuff!'],
    headshot: ['Right in the head! Heh heh!', 'Boi-oi-oing!'],
    streak: ['Heh heh heh, I am unstoppable!', 'This is the greatest day of my life!'],
    cornholio: 'I am the Great Cornholio! I need TP for my bunghole!',
    hurt: ['Ow! Cut it out, butthole!', 'That sucked!', 'Aaah! My face!'],
    wave: ['Heh heh, here they come.', 'This is gonna be cool.', 'Come on, fartknockers!'],
    death: ['This sucks more than anything has ever sucked.'],
    boss: ['Whoa! The principal! Run!'],
    buy: ['Heh heh. Shopping rules.', 'Cool. New stuff.'],
    reload: ['Uh... hang on. Heh heh.'],
  },
  butthead: {
    kill: ['Uh huh huh, cool.', 'Nice one.', 'That was cool.', 'Whoa. Heh heh.',
      'This is like, art or something.', 'Settle down, dumbass.'],
    headshot: ['Uh huh huh. Skull shot.', 'That was like, surgical.'],
    streak: ['I am like, a war hero or something.', 'This is the coolest thing I have ever seen.'],
    cornholio: 'Uh huh huh. Total carnage. Cool.',
    hurt: ['Hey! Watch it, buttmunch.', 'Uh, ow.', 'Cut it out, bunghole.'],
    wave: ['Uh huh huh, more of these guys.', 'Come to Butt-Head.', 'These guys, like, suck.'],
    death: ['Uh... this sucks. Huh huh.'],
    boss: ['Whoa, the principal. Not cool.'],
    buy: ['Uh huh huh. Money rules.', 'Whoa. Upgrades.'],
    reload: ['Uh... loading. Huh huh.'],
  },
};

const DEFAULT_SETTINGS = {
  sens: 1.0,          // 0.4 .. 2.5
  fov: 68,            // 60 .. 85
  volSfx: 0.8,
  volMusic: 0.45,
  voice: true,
  music: true,
  dmgNumbers: true,
  shake: true,
  minimapRotate: true,
};
