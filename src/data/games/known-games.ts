import { CURATED_GAMES, type Trait } from "./catalog";

// Well-known games a shopper might name, tagged so we can find curated games that feel similar.
export type KnownGame = { name: string; aliases?: string[]; traits: Trait[]; complexity: number; curatedSlug?: string };

const CURATED_ALIASES: Record<string, string[]> = {
  "hues-and-cues": ["Hues and Clues"],
  "sushi-go": ["Sushi Go Party"],
  "the-crew": ["The Crew: The Quest for Planet Nine"],
};

const OTHERS: KnownGame[] = [
  { name: "Monopoly", traits: ["trading", "take-that", "family"], complexity: 1.6 },
  { name: "Scrabble", traits: ["word", "abstract", "family"], complexity: 2.0 },
  { name: "Uno", traits: ["card-game", "take-that", "family", "party"], complexity: 1.1 },
  { name: "Clue", aliases: ["Cluedo"], traits: ["deduction", "family"], complexity: 1.7 },
  { name: "Risk", traits: ["strategy", "take-that"], complexity: 2.1 },
  { name: "Chess", traits: ["abstract", "strategy", "two-player"], complexity: 3.7 },
  { name: "Exploding Kittens", traits: ["card-game", "take-that", "party"], complexity: 1.1 },
  { name: "Cards Against Humanity", traits: ["party", "creative"], complexity: 1.2 },
  { name: "Apples to Apples", traits: ["party", "creative", "family"], complexity: 1.1 },
  { name: "Pictionary", traits: ["party", "creative", "family"], complexity: 1.1 },
  { name: "Telestrations", traits: ["party", "creative"], complexity: 1.1 },
  { name: "Taboo", traits: ["party", "word"], complexity: 1.1 },
  { name: "Scattergories", traits: ["party", "word", "family"], complexity: 1.1 },
  { name: "Boggle", traits: ["word", "family"], complexity: 1.1 },
  { name: "Bananagrams", traits: ["word", "family", "puzzle"], complexity: 1.1 },
  { name: "Trivial Pursuit", traits: ["party", "family"], complexity: 1.6 },
  { name: "Yahtzee", traits: ["family"], complexity: 1.2 },
  { name: "Dominion", traits: ["card-game", "engine-building", "strategy"], complexity: 2.4 },
  { name: "7 Wonders", traits: ["drafting", "card-game", "engine-building", "strategy"], complexity: 2.3 },
  { name: "Sagrada", traits: ["drafting", "puzzle", "abstract"], complexity: 1.9 },
  { name: "Everdell", traits: ["engine-building", "strategy"], complexity: 2.8 },
  { name: "Terraforming Mars", traits: ["engine-building", "card-game", "strategy"], complexity: 3.3 },
  { name: "Gloomhaven", traits: ["cooperative", "strategy"], complexity: 3.9 },
  { name: "Scythe", traits: ["strategy", "engine-building"], complexity: 3.4 },
  { name: "Root", traits: ["strategy", "take-that"], complexity: 3.7 },
  { name: "Spirit Island", traits: ["cooperative", "strategy"], complexity: 4.0 },
  { name: "Forbidden Island", traits: ["cooperative", "family"], complexity: 1.7 },
  { name: "Hanabi", traits: ["cooperative", "card-game", "deduction"], complexity: 1.7 },
  { name: "The Mind", traits: ["cooperative", "card-game", "party"], complexity: 1.1 },
  { name: "Mysterium", traits: ["cooperative", "deduction", "creative"], complexity: 1.9 },
  { name: "Love Letter", traits: ["card-game", "deduction", "family"], complexity: 1.2 },
  { name: "Jaipur", traits: ["card-game", "trading", "two-player", "set-collection"], complexity: 1.5 },
  { name: "Lost Cities", traits: ["card-game", "two-player", "set-collection"], complexity: 1.5 },
  {
    name: "Century: Spice Road",
    aliases: ["Century Spice Road"],
    traits: ["engine-building", "card-game", "family"],
    complexity: 1.8,
  },
  { name: "Small World", traits: ["strategy", "take-that"], complexity: 2.4 },
  { name: "Betrayal at House on the Hill", traits: ["cooperative", "strategy"], complexity: 2.3 },
  { name: "Mahjong", traits: ["abstract", "set-collection", "strategy"], complexity: 2.5 },
  { name: "Rummikub", traits: ["abstract", "set-collection", "family"], complexity: 1.8 },
  { name: "Qwirkle", traits: ["abstract", "tile-laying", "family"], complexity: 1.6 },
  { name: "Dobble", aliases: ["Spot It"], traits: ["party", "family"], complexity: 1.0 },
];

export const KNOWN_GAMES: KnownGame[] = [
  ...CURATED_GAMES.map((g) => ({
    name: g.title,
    aliases: CURATED_ALIASES[g.slug],
    traits: g.traits,
    complexity: g.complexity,
    curatedSlug: g.slug,
  })),
  ...OTHERS,
];
