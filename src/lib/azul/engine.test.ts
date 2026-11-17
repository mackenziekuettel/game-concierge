import { describe, expect, it } from "vitest";
import {
  applyMove,
  createGame,
  emptyWall,
  isRoundOver,
  legalMoves,
  placementPoints,
  previewPlacement,
  resolveRound,
  wallColumn,
  type GameState,
} from "./engine";

function totalTiles(s: GameState) {
  const count = (arr: unknown[]) => arr.length;
  let n = count(s.bag) + count(s.lid) + count(s.center);
  for (const f of s.factories) n += f.length;
  for (const p of s.players) {
    for (const line of p.lines) n += line.count;
    n += p.floor.filter((t) => t !== "first").length;
    for (const row of p.wall) n += row.filter(Boolean).length;
  }
  return n;
}

describe("placementPoints", () => {
  it("scores 1 for an isolated tile", () => {
    expect(placementPoints(emptyWall(), 2, 2)).toBe(1);
  });

  it("counts horizontal and vertical runs through the placed tile", () => {
    const wall = emptyWall();
    wall[2][0] = true;
    wall[2][1] = true;
    wall[1][2] = true;
    wall[0][2] = true;
    wall[4][2] = true;
    expect(placementPoints(wall, 2, 2)).toBe(3 + 3);
  });
});

describe("moves", () => {
  it("sends overflow to the floor and the first-player token with the first center pick", () => {
    let s = createGame(1);
    s.factories = [["red", "red", "red", "blue"], [], [], [], []];
    s.center = ["yellow"];
    s.centerHasFirst = true;
    s = applyMove(s, { source: 0, color: "red", line: 0 });
    const me = s.players[0];
    expect(me.lines[0]).toEqual({ color: "red", count: 1 });
    expect(me.floor).toEqual(["red", "red"]);
    expect(s.center.sort()).toEqual(["blue", "yellow"]);
    expect(s.current).toBe(1);

    s = applyMove(s, { source: "center", color: "blue", line: 1 });
    expect(s.players[1].floor).toEqual(["first"]);
    expect(s.centerHasFirst).toBe(false);
    expect(s.center).toEqual(["yellow"]);
  });

  it("forbids lines holding another color or whose wall row already has the color", () => {
    const s = createGame(1);
    s.factories = [["red", "red", "blue", "blue"], [], [], [], []];
    s.center = [];
    s.players[0].lines[2] = { color: "blue", count: 1 };
    s.players[0].wall[3][wallColumn(3, "red")] = true;
    const redLines = legalMoves(s)
      .filter((m) => m.color === "red")
      .map((m) => m.line);
    expect(redLines).toEqual([0, 1, 4, "floor"]);
  });

  it("previews how many tiles land and the floor penalty", () => {
    const s = createGame(1);
    expect(previewPlacement(s.players[0], "red", 3, 1)).toEqual({
      placed: 2,
      overflow: 1,
      penalty: -1,
    });
  });
});

describe("resolveRound", () => {
  it("tiles full lines, scores them, applies floor penalties and keeps partial lines", () => {
    const s = createGame(1);
    s.factories = [[], [], [], [], []];
    s.center = [];
    s.centerHasFirst = false;
    const p = s.players[0];
    p.score = 2;
    p.lines[0] = { color: "blue", count: 1 };
    p.lines[1] = { color: "red", count: 2 };
    p.lines[2] = { color: "yellow", count: 1 };
    p.wall[1][wallColumn(1, "red") - 1] = true;
    p.floor = ["first", "black", "black"];
    s.players[1].floor = [];
    expect(isRoundOver(s)).toBe(true);

    const before = totalTiles(s);
    const { steps, state } = resolveRound(s);
    const mine = steps.filter((st) => st.event.player === 0);
    expect(mine.map((st) => st.event.points)).toEqual([1, 2, -4]);

    const after = state.players[0];
    expect(after.score).toBe(2 + 1 + 2 - 4);
    expect(after.lines[0].count).toBe(0);
    expect(after.lines[2]).toEqual({ color: "yellow", count: 1 });
    expect(after.floor).toEqual([]);
    expect(state.current).toBe(0);
    expect(state.round).toBe(2);
    expect(state.factories.every((f) => f.length === 4)).toBe(true);
    expect(totalTiles(state)).toBe(before);
  });

  it("never drops a score below zero", () => {
    const s = createGame(1);
    s.factories = [[], [], [], [], []];
    s.center = [];
    s.players[1].floor = ["red", "red", "red"];
    const { state } = resolveRound(s);
    expect(state.players[1].score).toBe(0);
  });

  it("ends the game on a completed horizontal row and adds end bonuses", () => {
    const s = createGame(1);
    s.factories = [[], [], [], [], []];
    s.center = [];
    const p = s.players[0];
    for (let c = 0; c < 4; c++) p.wall[0][c] = true;
    p.lines[0] = { color: "white", count: 1 };
    const { state, steps } = resolveRound(s);
    expect(state.phase).toBe("gameOver");
    const bonus = steps.find((st) => st.event.kind === "bonus" && st.event.player === 0);
    expect(bonus?.event.points).toBe(2);
    expect(state.players[0].score).toBe(5 + 2);
  });
});
