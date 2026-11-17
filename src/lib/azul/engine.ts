export const COLORS = ["blue", "yellow", "red", "black", "white"] as const;
export type Color = (typeof COLORS)[number];
export type FloorTile = Color | "first";

export const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3];
const TILES_PER_COLOR = 20;
const FACTORY_COUNT = 5;
const TILES_PER_FACTORY = 4;

export type PatternLine = { color: Color | null; count: number };

export type Player = {
  name: string;
  score: number;
  lines: PatternLine[];
  wall: boolean[][];
  floor: FloorTile[];
};

export type Source = number | "center";
export type Target = number | "floor";
export type Move = { source: Source; color: Color; line: Target };

export type GameState = {
  rng: number;
  bag: Color[];
  lid: Color[];
  factories: Color[][];
  center: Color[];
  centerHasFirst: boolean;
  players: Player[];
  current: number;
  round: number;
  phase: "picking" | "gameOver";
};

export type RoundEvent =
  | { kind: "tile"; player: number; row: number; col: number; color: Color; points: number; h: number; v: number }
  | { kind: "floor"; player: number; points: number; tiles: number }
  | { kind: "bonus"; player: number; points: number; rows: number; cols: number; colors: number };

export type RoundStep = { event: RoundEvent; state: GameState };

export function wallColor(row: number, col: number): Color {
  return COLORS[(col - row + 5) % 5];
}

export function wallColumn(row: number, color: Color): number {
  return (COLORS.indexOf(color) + row) % 5;
}

export function emptyWall(): boolean[][] {
  return Array.from({ length: 5 }, () => Array(5).fill(false));
}

function newPlayer(name: string): Player {
  return {
    name,
    score: 0,
    lines: Array.from({ length: 5 }, () => ({ color: null, count: 0 })),
    wall: emptyWall(),
    floor: [],
  };
}

function random(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle(s: GameState, tiles: Color[]): Color[] {
  const out = [...tiles];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fillFactories(s: GameState) {
  s.factories = Array.from({ length: FACTORY_COUNT }, () => {
    const f: Color[] = [];
    while (f.length < TILES_PER_FACTORY) {
      if (s.bag.length === 0) {
        if (s.lid.length === 0) break;
        s.bag = shuffle(s, s.lid);
        s.lid = [];
      }
      f.push(s.bag.pop()!);
    }
    return f;
  });
}

export function createGame(seed: number, names: [string, string] = ["You", "Bot"]): GameState {
  const s: GameState = {
    rng: seed,
    bag: [],
    lid: [],
    factories: [],
    center: [],
    centerHasFirst: true,
    players: names.map(newPlayer),
    current: 0,
    round: 1,
    phase: "picking",
  };
  s.bag = shuffle(s, COLORS.flatMap((c) => Array<Color>(TILES_PER_COLOR).fill(c)));
  fillFactories(s);
  return s;
}

export function sourceTiles(s: GameState, source: Source): Color[] {
  return source === "center" ? s.center : s.factories[source];
}

export function canPlace(p: Player, color: Color, line: number): boolean {
  const l = p.lines[line];
  if (l.count >= line + 1) return false;
  if (l.color && l.color !== color) return false;
  return !p.wall[line][wallColumn(line, color)];
}

export function floorPenalty(start: number, added: number): number {
  let total = 0;
  for (let i = start; i < start + added && i < FLOOR_PENALTIES.length; i++) total += FLOOR_PENALTIES[i];
  return total;
}

export function previewPlacement(p: Player, color: Color, count: number, line: Target) {
  const space = line === "floor" ? 0 : line + 1 - p.lines[line].count;
  const placed = Math.min(count, space);
  const overflow = count - placed;
  return { placed, overflow, penalty: floorPenalty(p.floor.length, overflow) };
}

export function legalMoves(s: GameState): Move[] {
  const p = s.players[s.current];
  const moves: Move[] = [];
  const sources: Source[] = [...s.factories.keys(), "center"];
  for (const source of sources) {
    const colors = new Set(sourceTiles(s, source));
    for (const color of colors) {
      for (let line = 0; line < 5; line++) if (canPlace(p, color, line)) moves.push({ source, color, line });
      moves.push({ source, color, line: "floor" });
    }
  }
  return moves;
}

function pushFloor(s: GameState, p: Player, tiles: FloorTile[]) {
  for (const t of tiles) {
    if (p.floor.length < FLOOR_PENALTIES.length) p.floor.push(t);
    else if (t !== "first") s.lid.push(t);
  }
}

export function applyMove(state: GameState, move: Move): GameState {
  const s = structuredClone(state);
  const p = s.players[s.current];
  const from = sourceTiles(s, move.source);
  const taken = from.filter((c) => c === move.color);
  if (taken.length === 0) throw new Error("No tiles of that color at source");
  if (move.line !== "floor" && !canPlace(p, move.color, move.line)) throw new Error("Illegal line");

  const rest = from.filter((c) => c !== move.color);
  if (move.source === "center") {
    s.center = rest;
    if (s.centerHasFirst) {
      s.centerHasFirst = false;
      pushFloor(s, p, ["first"]);
    }
  } else {
    s.factories[move.source] = [];
    s.center.push(...rest);
  }

  let overflow = taken.length;
  if (move.line !== "floor") {
    const l = p.lines[move.line];
    const placed = Math.min(taken.length, move.line + 1 - l.count);
    l.color = move.color;
    l.count += placed;
    overflow -= placed;
  }
  pushFloor(s, p, Array<Color>(overflow).fill(move.color));

  s.current = (s.current + 1) % s.players.length;
  return s;
}

export function isRoundOver(s: GameState): boolean {
  return s.center.length === 0 && s.factories.every((f) => f.length === 0);
}

function runLength(wall: boolean[][], row: number, col: number, dr: number, dc: number): number {
  let n = 1;
  for (const sign of [-1, 1]) {
    let r = row + dr * sign;
    let c = col + dc * sign;
    while (r >= 0 && r < 5 && c >= 0 && c < 5 && wall[r][c]) {
      n++;
      r += dr * sign;
      c += dc * sign;
    }
  }
  return n;
}

export function placementRuns(wall: boolean[][], row: number, col: number) {
  return { h: runLength(wall, row, col, 0, 1), v: runLength(wall, row, col, 1, 0) };
}

export function placementPoints(wall: boolean[][], row: number, col: number): number {
  const { h, v } = placementRuns(wall, row, col);
  const points = (h > 1 ? h : 0) + (v > 1 ? v : 0);
  return points || 1;
}

export function endBonus(p: Player) {
  const rows = p.wall.filter((r) => r.every(Boolean)).length;
  const cols = [0, 1, 2, 3, 4].filter((c) => p.wall.every((r) => r[c])).length;
  const colors = COLORS.filter((color) => p.wall.every((r, i) => r[wallColumn(i, color)])).length;
  return { rows, cols, colors, points: rows * 2 + cols * 7 + colors * 10 };
}

export function resolveRound(state: GameState): { steps: RoundStep[]; state: GameState } {
  const s = structuredClone(state);
  const steps: RoundStep[] = [];
  let nextFirst = s.current;

  s.players.forEach((p, pi) => {
    p.lines.forEach((line, row) => {
      if (!line.color || line.count < row + 1) return;
      const color = line.color;
      const col = wallColumn(row, color);
      p.wall[row][col] = true;
      const { h, v } = placementRuns(p.wall, row, col);
      const points = placementPoints(p.wall, row, col);
      p.score += points;
      s.lid.push(...Array<Color>(line.count - 1).fill(color));
      p.lines[row] = { color: null, count: 0 };
      steps.push({ event: { kind: "tile", player: pi, row, col, color, points, h, v }, state: structuredClone(s) });
    });
  });

  s.players.forEach((p, pi) => {
    if (p.floor.length > 0) {
      const points = floorPenalty(0, p.floor.length);
      if (p.floor.includes("first")) nextFirst = pi;
      p.score = Math.max(0, p.score + points);
      const tiles = p.floor.length;
      s.lid.push(...p.floor.filter((t): t is Color => t !== "first"));
      p.floor = [];
      steps.push({ event: { kind: "floor", player: pi, points, tiles }, state: structuredClone(s) });
    }
  });

  if (s.players.some((p) => p.wall.some((r) => r.every(Boolean)))) {
    s.phase = "gameOver";
    s.players.forEach((p, pi) => {
      const bonus = endBonus(p);
      p.score += bonus.points;
      steps.push({ event: { kind: "bonus", player: pi, ...bonus }, state: structuredClone(s) });
    });
    return { steps, state: s };
  }

  s.round += 1;
  s.current = nextFirst;
  s.centerHasFirst = true;
  fillFactories(s);
  return { steps, state: s };
}
