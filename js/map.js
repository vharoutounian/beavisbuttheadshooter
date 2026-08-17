// Highland High — the map. Grid tiles:
// '#' brick  'L' lockers  'C' chalkboard  'M' gym metal  '.' floor
// 'S' enemy spawn point   'P' player start
const GameMap = (() => {
  const W = 32, H = 24;

  const LAYOUT = [
    "################################",
    "#S.....L........L..........L..S#",
    "#......L.CCCCC..L..CCCCCC..L...#",
    "#..##..L.C...C..L..C....C......#",
    "#..##..L.C...C..L..C....C..L...#",
    "#......L.CC.CC..L..CC..CC..L...#",
    "#......L........L..........L...#",
    "#LL.LLLL........LL.LL.LLLLLL...#",
    "#..............................#",
    "#..MMMM..MM..........MMMM..M...#",
    "#..M......M....P.....M.....M...#",
    "#..M......M..........M.....M...#",
    "#..MM.MMMMM..........MM.MMMM...#",
    "#..............................#",
    "#CCCC.CCC.....LL.LL.....CCCCCC.#",
    "#C......C.....L...L.....C....C.#",
    "#C......C.....L...L.....C....C.#",
    "#C..CC..C.....L...L.....CC..CC.#",
    "#....C........L...L.........C..#",
    "#S...C........L...L.........C.S#",
    "#....................##........#",
    "#..#....#....##....#....#...#..#",
    "#S............................S#",
    "################################",
  ];

  const TILE = { '#': 1, 'L': 2, 'C': 3, 'M': 4 };

  const grid = [];        // 0 = floor, >0 = wall texture id
  const spawns = [];
  let playerStart = { x: W / 2 + 0.5, y: H / 2 + 0.5 };

  for (let y = 0; y < H; y++) {
    let row = LAYOUT[y] || "";
    row = (row + "#".repeat(W)).slice(0, W);
    const out = new Array(W);
    for (let x = 0; x < W; x++) {
      let ch = row[x];
      if (y === 0 || y === H - 1 || x === 0 || x === W - 1) ch = '#';
      if (ch === 'S') { spawns.push({ x: x + 0.5, y: y + 0.5 }); ch = '.'; }
      if (ch === 'P') { playerStart = { x: x + 0.5, y: y + 0.5 }; ch = '.'; }
      out[x] = TILE[ch] || 0;
    }
    grid.push(out);
  }

  function tileAt(x, y) {
    const gx = x | 0, gy = y | 0;
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) return 1;
    return grid[gy][gx];
  }
  const solidAt = (x, y) => tileAt(x, y) > 0;

  // Breadth-first flow field: distance (in steps) from every walkable cell
  // to the player's cell. Enemies walk downhill on it.
  const field = new Int16Array(W * H);
  function computeField(px, py) {
    field.fill(0x3fff);
    const sx = px | 0, sy = py | 0;
    if (solidAt(sx, sy)) return field;
    const queue = [sy * W + sx];
    field[sy * W + sx] = 0;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const cx = cur % W, cy = (cur / W) | 0;
      const d = field[cur] + 1;
      // 4-connected keeps paths out of wall corners
      const nbs = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of nbs) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (grid[ny][nx] > 0) continue;
        const idx = ny * W + nx;
        if (field[idx] > d) { field[idx] = d; queue.push(idx); }
      }
    }
    return field;
  }
  const fieldAt = (x, y) => {
    const gx = x | 0, gy = y | 0;
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) return 0x3fff;
    return field[gy * W + gx];
  };

  return { W, H, grid, spawns, playerStart, tileAt, solidAt, computeField, fieldAt };
})();
if (typeof module !== 'undefined') module.exports = GameMap;
