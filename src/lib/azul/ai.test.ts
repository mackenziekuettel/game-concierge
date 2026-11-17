import { describe, expect, it } from "vitest";
import { chooseMove } from "./ai";
import { applyMove, createGame, isRoundOver, resolveRound, wallColumn } from "./engine";

describe("beginner bot", () => {
  it("finishes a line instead of spilling tiles onto the floor", () => {
    const s = createGame(1);
    s.current = 1;
    s.factories = [["red", "red", "red", "red"], ["blue", "blue", "yellow", "black"], [], [], []];
    s.center = [];
    for (let row = 1; row < 5; row++) s.players[1].wall[row][wallColumn(row, "red")] = true;
    expect(chooseMove(s, () => 0)).toEqual({ source: 1, color: "blue", line: 1 });
  });

  it("can play a whole game against itself to a finish", () => {
    let s = createGame(42);
    let rounds = 0;
    while (s.phase !== "gameOver" && rounds < 20) {
      s = applyMove(s, chooseMove(s));
      if (isRoundOver(s)) {
        s = resolveRound(s).state;
        rounds++;
      }
    }
    expect(s.phase).toBe("gameOver");
  });
});
