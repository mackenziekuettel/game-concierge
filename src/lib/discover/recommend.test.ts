import { describe, expect, it } from "vitest";
import { CURATED_GAMES } from "@/data/games/catalog";
import { matchKnownGame, rankGames, recommend, similarGames, type Answers } from "./recommend";

const base: Answers = { players: "3-4", length: "any", learn: "moderate", complexity: "medium", loved: [] };

describe("matchKnownGame", () => {
  it("matches names loosely: typos, aliases, missing subtitles", () => {
    expect(matchKnownGame("tickt to ride")?.name).toBe("Ticket to Ride");
    expect(matchKnownGame("Cluedo")?.name).toBe("Clue");
    expect(matchKnownGame("the crew")?.curatedSlug).toBe("the-crew");
    expect(matchKnownGame("hues & cues")?.curatedSlug).toBe("hues-and-cues");
    expect(matchKnownGame("xyzzy")).toBeUndefined();
    expect(matchKnownGame("")).toBeUndefined();
  });
});

describe("rankGames", () => {
  it("only recommends games that support the group size", () => {
    const twoPlayer = recommend({ ...base, players: "2" }).picks;
    expect(twoPlayer.length).toBeGreaterThanOrEqual(5);
    for (const { game } of twoPlayer) expect(game.players.min).toBeLessThanOrEqual(2);

    const solo = recommend({ ...base, players: "1" }).picks;
    expect(solo.length).toBeGreaterThanOrEqual(5);
    for (const { game } of solo) expect(game.players.min).toBe(1);

    const bigGroup = recommend({ ...base, players: "5+" }).picks;
    for (const { game } of bigGroup) expect(game.players.max).toBeGreaterThanOrEqual(5);
  });

  it("keeps heavy games away from someone who wants light, quick, short games", () => {
    const picks = recommend({ ...base, players: "3-4", length: "short", learn: "quick", complexity: "light" }).picks;
    for (const { game } of picks) expect(game.complexity).toBeLessThanOrEqual(1.6);
  });

  it("puts heavier games first for someone asking for strategy", () => {
    const [top] = rankGames({ ...base, length: "long", learn: "deep", complexity: "heavy" });
    expect(top.game.complexity).toBeGreaterThanOrEqual(2.2);
  });

  it("uses a loved game to find similar games, without recommending the loved game itself", () => {
    const ranked = rankGames({ ...base, loved: ["Ticket to Ride"] });
    expect(ranked.some((r) => r.game.slug === "ticket-to-ride")).toBe(false);
    const withReason = ranked.find((r) => r.reasons.some((x) => x.includes("Ticket to Ride")));
    expect(withReason).toBeDefined();
    expect(ranked.findIndex((r) => r === withReason)).toBeLessThan(4);
  });
});

describe("recommend shuffle", () => {
  it("shuffling avoids games already shown when there are enough alternatives", () => {
    const first = recommend(base);
    const shown = new Set(first.picks.map((p) => p.game.slug));
    const next = recommend(base, { avoid: shown, seed: 7 });
    expect(next.picks).toHaveLength(first.picks.length);
    if (first.poolSize >= shown.size * 2) {
      for (const p of next.picks) expect(shown.has(p.game.slug)).toBe(false);
    }
    expect(new Set(next.picks.map((p) => p.game.slug)).size).toBe(next.picks.length);
  });

  it("every curated game can be recommended by some answers", () => {
    const seen = new Set<string>();
    for (const players of ["1", "2", "3-4", "5+"] as const)
      for (const complexity of ["light", "medium", "heavy"] as const)
        for (const length of ["short", "medium", "long"] as const)
          for (const p of recommend({ ...base, players, complexity, length }).picks) seen.add(p.game.slug);
    expect(CURATED_GAMES.filter((g) => !seen.has(g.slug)).map((g) => g.slug)).toEqual([]);
  });
});

describe("similarGames", () => {
  it("finds close relatives of a game, never the game itself", () => {
    const similar = similarGames("azul", 3);
    expect(similar).toHaveLength(3);
    expect(similar.map((s) => s.game.slug)).not.toContain("azul");
    expect(similar.map((s) => s.game.slug)).toContain("cascadia");
    for (const s of similar) expect(s.shared.length).toBeGreaterThan(0);
  });
});
