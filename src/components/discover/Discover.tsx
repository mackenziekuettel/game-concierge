"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { LAST_RESULTS_KEY } from "@/components/shopify/BackLink";
import { GameCombobox } from "./GameCombobox";
import { CHOICE_KEYS, QUESTIONS, answersToQuery, parseAnswers, type ChoiceKey } from "@/lib/discover/answers";
import { matchKnownGame, recommend, type Answers, type Pick } from "@/lib/discover/recommend";
import type { GameImages } from "@/lib/shopify/product";

const PREVIEW_IMAGES: Record<string, string> = { azul: "/images/games/azul-box.webp" };
const TOTAL_STEPS = CHOICE_KEYS.length + 1;

export function Discover({ images }: { images: Promise<GameImages> }) {
  const params = useSearchParams();
  const answers = useMemo(() => parseAnswers(new URLSearchParams(params.toString())), [params]);
  return answers ? <Results key={params.toString()} answers={answers} images={images} /> : <Quiz />;
}

function Quiz({ initial, startAt = 0 }: { initial?: Answers; startAt?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(startAt);
  const [draft, setDraft] = useState<Partial<Answers>>(initial ?? {});
  const [loved, setLoved] = useState<string[]>([initial?.loved[0] ?? "", initial?.loved[1] ?? ""]);

  function choose(key: ChoiceKey, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setStep((s) => s + 1);
  }

  function finish() {
    router.push(`${pathname}?${answersToQuery({ ...draft, loved })}`);
  }

  const key = CHOICE_KEYS[step];
  const question = key ? QUESTIONS[key] : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:py-10">
      <header className="space-y-3 text-center">
        <span className="badge badge-secondary">The Game Concierge</span>
        <h1 className="text-4xl font-semibold tracking-tight">Find a game you&apos;ll actually love</h1>
        <p className="text-lead">
          Five quick questions, then a handful of games that fit your table. Try them before you buy.
        </p>
      </header>

      <div className="space-y-2">
        <div className="flex justify-between text-caption">
          <span>
            Question {step + 1} of {TOTAL_STEPS}
          </span>
          {step > 0 && (
            <button type="button" className="link-muted" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          )}
        </div>
        <div className="progress-track">
          <div className="progress-indicator" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {question ? (
        <fieldset className="space-y-4">
          <legend className="space-y-1">
            <span className="heading-section block">{question.title}</span>
            <span className="text-subtle block">{question.help}</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((o) => {
              const selected = draft[key] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => choose(key, o.value)}
                  className={`rounded-xl border p-4 text-left transition-all hover:border-foreground/40 hover:bg-muted/50 ${
                    selected ? "border-foreground ring-1 ring-foreground" : ""
                  }`}
                >
                  <span className="block font-medium">{o.label}</span>
                  {o.hint && <span className="text-caption block">{o.hint}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <LovedGames loved={loved} setLoved={setLoved} onSubmit={finish} />
      )}
    </div>
  );
}

function LovedGames({
  loved,
  setLoved,
  onSubmit,
}: {
  loved: string[];
  setLoved: (v: string[]) => void;
  onSubmit: () => void;
}) {
  const filled = loved.some((l) => l.trim());
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-1">
        <h2 className="heading-section">Name a game or two you love</h2>
        <p className="text-subtle">Optional. We&apos;ll look for games that feel similar.</p>
      </div>
      <div className="space-y-3">
        {loved.map((value, i) => {
          const match = value.trim().length > 1 ? matchKnownGame(value) : undefined;
          return (
            <div key={i} className="field">
              <label className="field-label" htmlFor={`loved-${i}`}>
                {i === 0 ? "A game you love" : "Another one (optional)"}
              </label>
              <GameCombobox
                id={`loved-${i}`}
                placeholder={i === 0 ? "e.g. Ticket to Ride" : "e.g. Codenames"}
                value={value}
                onChange={(next) => setLoved(loved.map((v, j) => (j === i ? next : v)))}
              />
              {value.trim().length > 1 && (
                <p className={`text-caption ${match ? "" : "text-warning-foreground"}`}>
                  {match ? `Got it: ${match.name}` : "We don't know that one yet, so we'll go by your other answers."}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-lg">
          Show my games
        </button>
        {!filled && (
          <button type="submit" className="btn btn-ghost btn-lg">
            Skip
          </button>
        )}
      </div>
    </form>
  );
}

function summary(answers: Answers) {
  return CHOICE_KEYS.map((k) => QUESTIONS[k].options.find((o) => o.value === answers[k])!).map((o) => o.label);
}

function Results({ answers, images }: { answers: Answers; images: Promise<GameImages> }) {
  const router = useRouter();
  const pathname = usePathname();
  const [round, setRound] = useState(0);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);

  const { picks, poolSize } = useMemo(() => recommend(answers, { avoid: shown, seed: round }), [answers, shown, round]);
  const lovedMatches = answers.loved.map((l) => ({ input: l, match: matchKnownGame(l) }));

  useEffect(() => {
    try {
      sessionStorage.setItem(LAST_RESULTS_KEY, `${window.location.pathname}${window.location.search}`);
    } catch {}
  }, [answers]);

  if (editing) return <Quiz initial={answers} startAt={0} />;

  function shuffle() {
    setShown(new Set(picks.map((p) => p.game.slug)));
    setRound((r) => r + 1);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Games for your table</h1>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}>
              ← Change answers
            </button>
            <button
              type="button"
              className="btn"
              onClick={shuffle}
              disabled={poolSize <= picks.length}
              title={poolSize <= picks.length ? "These are all the games that fit" : undefined}
            >
              Shuffle
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {summary(answers).map((s) => (
            <span key={s} className="badge badge-outline">
              {s}
            </span>
          ))}
          {lovedMatches.map(({ input, match }) => (
            <span key={input} className={`badge ${match ? "badge-secondary" : "badge-outline line-through"}`}>
              Loves {match?.name ?? input}
            </span>
          ))}
        </div>
      </header>

      {picks.length === 0 ? (
        <div className="banner">
          <div className="banner-title">Nothing in our collection fits all of that yet.</div>
          <div className="banner-description">
            Try a different group size.{" "}
            <button type="button" className="underline" onClick={() => router.push(pathname)}>
              Start over
            </button>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {picks.map((pick) => (
            <GameCard key={pick.game.slug} pick={pick} images={images} />
          ))}
        </ul>
      )}

      <p className="text-caption">
        Game details are curated from BoardGameGeek and publisher pages. Prices and sellers come live from Shopify.
      </p>
    </div>
  );
}

function GameCard({ pick, images }: { pick: Pick; images: Promise<GameImages> }) {
  const { game, reasons } = pick;
  const time =
    game.minutes.min === game.minutes.max ? `${game.minutes.min}` : `${game.minutes.min}–${game.minutes.max}`;
  const players =
    game.players.min === game.players.max ? `${game.players.min}` : `${game.players.min}–${game.players.max}`;

  const productHref = game.hasPreview ? `/games/${game.slug}` : null;

  return (
    <li
      className={`card ${
        productHref
          ? "relative transition-shadow hover:shadow-md hover:ring-foreground/25 has-[.card-link:focus-visible]:ring-2 has-[.card-link:focus-visible]:ring-ring"
          : ""
      }`}
    >
      <div className="relative -mt-3 h-44 border-b bg-white sm:-mt-4">
        <Suspense fallback={<div className="h-full animate-pulse bg-muted" />}>
          <CardImage images={images} slug={game.slug} title={game.title} />
        </Suspense>
      </div>
      <div className="card-header">
        <div className="card-title text-base">
          {productHref ? (
            <Link href={productHref} className="card-link outline-none after:absolute after:inset-0 after:z-10">
              {game.title}
            </Link>
          ) : (
            game.title
          )}
        </div>
        <div className="card-description">{game.pitch}</div>
        {game.hasPreview && (
          <div className="card-action">
            <span className="badge">Try it</span>
          </div>
        )}
      </div>
      <div className="card-content flex flex-1 flex-col gap-4">
        <dl className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Players" value={players} />
          <Stat label="Minutes" value={time} />
          <Stat label="Difficulty" value={`${game.complexity}/5`} />
          <Stat label="Learn" value={`${game.learnMinutes}m`} />
        </dl>
        <div className="space-y-1">
          <div className="text-caption">Why it fits</div>
          <ul className="space-y-1 text-sm">
            {reasons.slice(0, 3).map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden className="text-success">
                  ✓
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-caption">Mood: {game.mood}</p>
      </div>
      <div className="card-footer mt-auto flex flex-wrap gap-2">
        {game.hasPreview ? (
          <Link href={`/games/${game.slug}/play`} className="btn relative z-20">
            Try before you buy
          </Link>
        ) : (
          <Link href={`/games/${game.slug}/buy`} className="btn btn-outline">
            Where to buy
          </Link>
        )}
      </div>
    </li>
  );
}

function CardImage({ images, slug, title }: { images: Promise<GameImages>; slug: string; title: string }) {
  const shopify = use(images)[slug];
  const src = PREVIEW_IMAGES[slug] ?? shopify?.url;
  if (!src) return <div className="flex h-full items-center justify-center text-caption">No photo yet</div>;
  return (
    <>
      <Image
        src={src}
        alt={shopify?.alt && !PREVIEW_IMAGES[slug] ? shopify.alt : `${title} box`}
        fill
        sizes="(min-width: 1024px) 320px, (min-width: 768px) 50vw, 100vw"
        className="object-contain p-3"
      />
      {!PREVIEW_IMAGES[slug] && (
        <span className="absolute right-2 bottom-2 rounded bg-background/80 px-1.5 text-[0.6rem] text-muted-foreground">
          Photo: Shopify
        </span>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-1 py-2">
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
      <dt className="text-[0.65rem] text-muted-foreground">{label}</dt>
    </div>
  );
}
