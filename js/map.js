// The house — a home-invasion floor plan. Grid tiles:
// '#' wallpaper  'L' wood paneling  'C' kitchen tile  'M' bathroom tile
// 'P' bookshelf  'D' door (they kick it in)  'T' boarded window  '.' floor
// 'X' couch section  'H' table/counter  'V' the TV
// 'S' break-in spawn point   '@' player start
export const GameMap = (() => {
  const W = 36, H = 26;

  const LAYOUT = [
    "####TT######################DD######",
    "#...S.....H.#M.....C.HHHHH..SS....H#",
    "#.HH........#M.....C..............H#",
    "#...........#M.....C...............#",
    "#...........#M............HH.......#",
    "#...........#M.....................#",
    "#...........#MMM.MMC...............#",
    "#...........#......#...............#",
    "########..###......#...............#",
    "#..................CCCCCC..CCCCCCCC#",
    "#LLLLL....LLLLLLL..................#",
    "#................#.................#",
    "#P...............#.................#",
    "#P...............#.................#",
    "T................#......HH.........#",
    "TS...X..........................S..T",
    "#.V.H.X............................#",
    "#................#.................#",
    "#.......@........#.................#",
    "#................#.................#",
    "#................#####..#########..#",
    "#..................................#",
    "#.............................X....#",
    "#..................................#",
    "#................SS................#",
    "################DDDD################",
  ];

  const TILE = {
    '#': 1, 'L': 2, 'C': 3, 'M': 4, 'P': 5, 'D': 6, 'T': 7,
    'X': 8, 'H': 9, 'V': 10,
  };

  const grid = [];        // 0 = floor, >0 = wall texture id
  const spawns = [];
  let playerStart = { x: W / 2 + 0.5, y: H / 2 + 0.5 };

  for (let y = 0; y < H; y++) {
    let row = LAYOUT[y] || "";
    row = (row + "#".repeat(W)).slice(0, W);
    const out = new Array(W);
    for (let x = 0; x < W; x++) {
      let ch = row[x];
      if (y === 0 || y === H - 1 || x === 0 || x === W - 1)
        ch = (ch === 'D' || ch === 'T') ? ch : '#';   // doors/windows on the shell
      if (ch === 'S') { spawns.push({ x: x + 0.5, y: y + 0.5 }); ch = '.'; }
      if (ch === '@') { playerStart = { x: x + 0.5, y: y + 0.5 }; ch = '.'; }
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
