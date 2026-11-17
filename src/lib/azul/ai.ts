import {
  canPlace,
  legalMoves,
  placementPoints,
  previewPlacement,
  sourceTiles,
  wallColumn,
  type GameState,
  type Move,
} from "./engine";

const BEGINNER_NOISE = 2.5;

export function scoreMove(s: GameState, m: Move): number {
  const p = s.players[s.current];
  const count = sourceTiles(s, m.source).filter((c) => c === m.color).length;
  const { placed, penalty } = previewPlacement(p, m.color, count, m.line);
  let value = placed + penalty * 1.5;

  if (m.line === "floor") {
    const anyLine = [0, 1, 2, 3, 4].some((l) => canPlace(p, m.color, l));
    value -= anyLine ? 3 : 0;
  } else if (p.lines[m.line].count + placed === m.line + 1) {
    const wall = p.wall.map((r) => [...r]);
    wall[m.line][wallColumn(m.line, m.color)] = true;
    value += 1 + placementPoints(wall, m.line, wallColumn(m.line, m.color));
  }

  if (m.source === "center" && s.centerHasFirst) value -= 0.5;
  return value;
}

export function chooseMove(s: GameState, random: () => number = Math.random): Move {
  let best: Move | null = null;
  let bestValue = -Infinity;
  for (const m of legalMoves(s)) {
    const value = scoreMove(s, m) + random() * BEGINNER_NOISE;
    if (value > bestValue) {
      bestValue = value;
      best = m;
    }
  }
  return best!;
}
