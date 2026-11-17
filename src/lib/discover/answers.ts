import type { Answers } from "./recommend";

type Option<V extends string> = { value: V; label: string; hint?: string };

export const QUESTIONS = {
  players: {
    param: "p",
    title: "Who are you usually playing with?",
    help: "The right game depends a lot on the table.",
    options: [
      { value: "1", label: "Solo", hint: "Just me" },
      { value: "2", label: "Just the two of us" },
      { value: "3-4", label: "A small group", hint: "3–4 players" },
      { value: "5+", label: "A crowd", hint: "5 or more" },
    ] as Option<Answers["players"]>[],
  },
  length: {
    param: "t",
    title: "How long should one game last?",
    help: "Including the time it takes to put it away.",
    options: [
      { value: "short", label: "Quick", hint: "Under 20 minutes" },
      { value: "medium", label: "An episode's worth", hint: "20–45 minutes" },
      { value: "long", label: "An evening", hint: "45 minutes or more" },
      { value: "any", label: "No preference" },
    ] as Option<Answers["length"]>[],
  },
  learn: {
    param: "l",
    title: "How much rule-learning are you up for?",
    help: "Some games take a few minutes to explain, others want a proper teach.",
    options: [
      { value: "quick", label: "Explain it in 5 minutes" },
      { value: "moderate", label: "Happy to learn for 15 minutes" },
      { value: "deep", label: "Teach me something meaty" },
    ] as Option<Answers["learn"]>[],
  },
  complexity: {
    param: "c",
    title: "How much thinking do you want while you play?",
    help: "Too simple gets boring, too complex gets frustrating.",
    options: [
      { value: "light", label: "Light and breezy", hint: "Chat while you play" },
      { value: "medium", label: "Some clever decisions", hint: "A satisfying puzzle" },
      { value: "heavy", label: "Proper strategy", hint: "Plan several turns ahead" },
    ] as Option<Answers["complexity"]>[],
  },
} as const;

export type ChoiceKey = keyof typeof QUESTIONS;
export const CHOICE_KEYS = Object.keys(QUESTIONS) as ChoiceKey[];

export function parseAnswers(params: URLSearchParams): Answers | null {
  const out: Partial<Answers> = {};
  for (const key of CHOICE_KEYS) {
    const value = params.get(QUESTIONS[key].param);
    if (!QUESTIONS[key].options.some((o) => o.value === value)) return null;
    Object.assign(out, { [key]: value });
  }
  out.loved = params
    .getAll("love")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);
  return out as Answers;
}

export function answersToQuery(answers: Partial<Answers>): string {
  const q = new URLSearchParams();
  for (const key of CHOICE_KEYS) {
    const value = answers[key];
    if (value) q.set(QUESTIONS[key].param, value);
  }
  for (const love of answers.loved ?? []) if (love.trim()) q.append("love", love.trim());
  return q.toString();
}
