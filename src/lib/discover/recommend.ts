import { CURATED_GAMES, type CuratedGame, type Trait } from "@/data/games/catalog";
import { KNOWN_GAMES, type KnownGame } from "@/data/games/known-games";

export type Answers = {
  players: "1" | "2" | "3-4" | "5+";
  length: "short" | "medium" | "long" | "any";
  learn: "quick" | "moderate" | "deep";
  complexity: "light" | "medium" | "heavy";
  loved: string[];
};

export type Pick = { game: CuratedGame; score: number; reasons: string[] };

const SET_SIZE = 6;
const POOL_SIZE = 12;
const COMPLEXITY_TARGET = { light: 1.15, medium: 1.9, heavy: 2.5 };
const LENGTH_RANGE = { short: [0, 20], medium: [20, 45], long: [45, 999] } as const;

const TRAIT_LABEL: Record<Trait, string> = {
  abstract: "abstract",
  "card-game": "card play",
  cooperative: "teamwork",
  creative: "creative clues",
  deduction: "deduction",
  drafting: "drafting",
  "engine-building": "engine building",
  family: "family-friendly",
  party: "party energy",
  puzzle: "puzzly",
  "route-building": "route building",
  "set-collection": "set collecting",
  strategy: "strategy",
  "take-that": "sneaky steals",
  "tile-laying": "tile laying",
  trading: "trading",
  "two-player": "two-player duels",
  word: "word play",
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/^\s*the\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

export function matchKnownGame(input: string): KnownGame | undefined {
  const q = normalize(input);
  if (q.length < 2) return undefined;
  let best: { game: KnownGame; cost: number } | undefined;
  for (const game of KNOWN_GAMES) {
    for (const name of [game.name, ...(game.aliases ?? [])]) {
      const n = normalize(name);
      let cost = editDistance(q, n);
      if (q.length >= 4 && n.startsWith(q)) cost = Math.min(cost, 0.5);
      const allowed = Math.max(1, Math.floor(n.length / 5));
      if (cost <= allowed && (!best || cost < best.cost)) best = { game, cost };
    }
  }
  return best?.game;
}

function fitsGroup(game: CuratedGame, players: Answers["players"]) {
  if (players === "1") return game.players.min === 1;
  if (players === "2") return game.players.min <= 2 && game.players.max >= 2;
  if (players === "3-4") return game.players.min <= 4 && game.players.max >= 3;
  return game.players.max >= 5;
}

function groupReason(game: CuratedGame, players: Answers["players"]): [number, string?] {
  const best = game.players.best;
  if (players === "2") return best.includes(2) ? [2, "Shines with just two players"] : [0, "Plays with two"];
  if (players === "3-4")
    return best.some((n) => n === 3 || n === 4) ? [2, "Best with 3–4 players"] : [0, "Works for 3–4 players"];
  if (players === "1")
    return best.includes(1)
      ? [2, game.players.max === 1 ? "Made for solo play" : "Shines as a solo game"]
      : [0.5, "Has a solo mode"];
  if (players === "5+")
    return best.some((n) => n >= 5)
      ? [2, `Built for big groups, up to ${game.players.max}`]
      : [0.5, `Plays up to ${game.players.max}`];
  return [0];
}

function lengthScore(game: CuratedGame, length: Answers["length"]): [number, string?] {
  if (length === "any") return [0];
  const [lo, hi] = LENGTH_RANGE[length];
  const { min, max } = game.minutes;
  const time = min === max ? `${min} min` : `${min}–${max} min`;
  if (max <= hi && min >= lo) return [3, `Fits your time: ${time}`];
  if (min <= hi && max >= lo) return [1.5, `Usually ${time}`];
  return [-3];
}

function learnScore(game: CuratedGame, learn: Answers["learn"]): [number, string?] {
  const m = game.learnMinutes;
  if (learn === "quick")
    return m <= 5 ? [3, `Learn it in about ${m} minutes`] : m <= 10 ? [1, `Quick to teach (~${m} min)`] : [-3];
  if (learn === "moderate") return m <= 15 ? [1.5, `About ${m} minutes to learn`] : m <= 20 ? [0] : [-2];
  return m >= 10 ? [1, "Rewards learning it properly"] : [0];
}

function complexityScore(game: CuratedGame, complexity: Answers["complexity"]): [number, string?] {
  const dist = Math.abs(game.complexity - COMPLEXITY_TARGET[complexity]);
  const label = game.complexity < 1.5 ? "Light" : game.complexity < 2.2 ? "Medium-light" : "Medium-weight";
  const score = 4 - dist * 6;
  return score > 1.5 ? [score, `${label} difficulty (${game.complexity}/5)`] : [score];
}

function lovedScore(game: CuratedGame, loved: KnownGame[]): [number, string?] {
  let best: [number, string?] = [0];
  for (const k of loved) {
    const shared = game.traits.filter((t) => k.traits.includes(t));
    const union = new Set([...game.traits, ...k.traits]).size;
    let score = (shared.length / union) * 5 - Math.abs(game.complexity - k.complexity) * 1.5;
    const listed = game.similar.some((s) => normalize(s) === normalize(k.name));
    if (listed) score += 3;
    if (score <= best[0] || score <= 1) continue;
    const traits = shared
      .filter((t) => t !== "family")
      .slice(0, 2)
      .map((t) => TRAIT_LABEL[t]);
    const reason = listed
      ? `Fans of ${k.name} often love this${traits.length ? `: same ${traits.join(" and ")}` : ""}`
      : `Like ${k.name}: ${traits.length ? traits.join(" and ") : "a similar feel"}`;
    best = [score, reason];
  }
  return best;
}

export function rankGames(answers: Answers): Pick[] {
  const loved = answers.loved.map(matchKnownGame).filter((k): k is KnownGame => !!k);
  const lovedSlugs = new Set(loved.map((k) => k.curatedSlug).filter(Boolean));

  return CURATED_GAMES.filter((g) => fitsGroup(g, answers.players) && !lovedSlugs.has(g.slug))
    .map((game) => {
      const parts = [
        lovedScore(game, loved),
        complexityScore(game, answers.complexity),
        lengthScore(game, answers.length),
        learnScore(game, answers.learn),
        groupReason(game, answers.players),
      ];
      return {
        game,
        score: parts.reduce((s, [n]) => s + n, 0),
        reasons: parts.map(([, r]) => r).filter((r): r is string => !!r),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function recommend(answers: Answers, { avoid = new Set<string>(), seed = 0 } = {}) {
  const pool = rankGames(answers).slice(0, POOL_SIZE);
  const size = Math.min(SET_SIZE, pool.length);
  const fresh = pool.filter((p) => !avoid.has(p.game.slug));
  const random = seeded(seed);

  const chosen: Pick[] = [];
  const candidates = [...fresh];
  while (chosen.length < size && candidates.length) {
    const i = seed === 0 ? 0 : Math.floor(random() ** 1.5 * candidates.length);
    chosen.push(...candidates.splice(i, 1));
  }
  for (const p of pool) if (chosen.length < size && !chosen.includes(p)) chosen.push(p);

  return { picks: chosen.sort((a, b) => b.score - a.score), poolSize: pool.length };
}

export function traitLabel(t: Trait) {
  return TRAIT_LABEL[t];
}

export function similarGames(slug: string, count = 3) {
  const base = CURATED_GAMES.find((g) => g.slug === slug);
  if (!base) return [];
  return CURATED_GAMES.filter((g) => g.slug !== slug)
    .map((game) => {
      const shared = game.traits.filter((t) => base.traits.includes(t) && t !== "family");
      const union = new Set([...game.traits, ...base.traits]).size;
      const listed = base.similar.includes(game.title) || game.similar.includes(base.title);
      const score = (shared.length / union) * 5 - Math.abs(game.complexity - base.complexity) * 1.5 + (listed ? 2 : 0);
      return { game, shared, score };
    })
    .filter((s) => s.shared.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}
