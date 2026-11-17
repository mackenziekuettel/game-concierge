"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { chooseMove, scoreMove } from "@/lib/azul/ai";
import {
  applyMove,
  createGame,
  isRoundOver,
  legalMoves,
  previewPlacement,
  resolveRound,
  sourceTiles,
  type Color,
  type GameState,
  type Move,
  type Player,
  type RoundStep,
  type Source,
  type Target,
} from "@/lib/azul/engine";
import Link from "next/link";
import { Market, PlayerBoard, Tile, type BuildTarget, type Selection } from "./board";
import { Tour } from "./Tour";

const FIRST_SEED = 20261116;
const BOT_DELAY_MS = 1200;
const ROUND_END_DELAY_MS = 900;

const STEPS = [
  {
    key: "Pick",
    text: "Take all tiles of one colour from a factory or the middle.",
    detail:
      "On your turn, take every tile of one colour from a single factory; the rest slide into the middle. You can also take one colour from the middle. The first player to do that takes the 1 token too: it costs a point, but you start next round.",
  },
  {
    key: "Place",
    text: "Put them into one matching-colour row on your board.",
    detail:
      "All the tiles you took go into one of your five pattern rows. Row 1 holds 1 tile, row 5 holds 5. A row holds one colour, and not a colour already on that row of your wall. Tiles that don't fit fall to the floor.",
  },
  {
    key: "Repeat",
    text: "Keep taking turns until all tiles are gone.",
    detail:
      "Players take turns until every factory and the middle are empty. Whatever you leave behind is what your opponent gets to choose from.",
  },
  {
    key: "Build",
    text: "Move one tile from every completed row onto your wall.",
    detail:
      "When the round ends, each full row moves one tile across to the matching colour on your wall. The rest of that row goes back in the box. Unfinished rows wait for next round.",
  },
  {
    key: "Score",
    text: "Earn points for connected tiles and lose points for floor tiles.",
    detail:
      "A new wall tile scores 1 on its own, or 1 for every tile it lines up with across and down. Each floor tile costs 1 to 3 points.",
  },
  {
    key: "Win",
    text: "Have the most points when someone completes a horizontal row!",
    detail:
      "Rounds repeat until someone completes a horizontal row on their wall. Then bonuses: +2 per full row, +7 per full column, +10 per colour placed five times. Highest score wins.",
  },
];

const TABLE_PARTS = [
  ["Factories", "Each holds 4 tiles. You take every tile of one colour from one factory."],
  ["The middle", "Leftovers collect here. You can take from it like a factory."],
  ["Pattern rows", "Your 5 staging rows, holding 1 to 5 tiles of one colour."],
  ["Wall", "Full rows send one tile here at round end. One spot per colour per row."],
  ["Floor", "Tiles you can't use land here and cost points."],
];

const STRATEGY_TIP =
  "Don't just collect as many tiles as possible. Think about where they'll fit on your board. Taking too many tiles can actually cost you points!";

type Stage = "intro" | "play" | "tiling" | "results";
type Tiling = { before: GameState; steps: RoundStep[]; after: GameState };

function sourceName(source: Source) {
  return source === "center" ? "the middle" : `Factory ${source + 1}`;
}

function lineName(line: Target) {
  return line === "floor" ? "the floor" : `row ${line + 1}`;
}

function countOf(s: GameState, source: Source, color: Color) {
  return sourceTiles(s, source).filter((c) => c === color).length;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function bestMove(s: GameState): Move {
  return legalMoves(s).reduce((best, m) => (scoreMove(s, m) > scoreMove(s, best) ? m : best));
}

function describeMove(s: GameState, m: Move, who: string) {
  const n = countOf(s, m.source, m.color);
  const p = s.players[s.current];
  const { overflow, penalty } = previewPlacement(p, m.color, n, m.line);
  const firstToken = m.source === "center" && s.centerHasFirst;
  let text = `${who} took ${n} ${m.color} from ${sourceName(m.source)} and put ${n === 1 ? "it" : "them"} on ${lineName(m.line)}.`;
  if (m.line !== "floor" && overflow > 0) text += ` ${plural(overflow, "tile")} spilled onto the floor (${penalty}).`;
  if (firstToken) text += ` ${who} also took the first-player token.`;
  return text;
}

function describeEvent(step: RoundStep, s: GameState) {
  const e = step.event;
  const name = s.players[e.player].name;
  const owner = e.player === 0 ? "Your" : `${name}'s`;
  if (e.kind === "tile") {
    const parts = [];
    if (e.h > 1) parts.push(`${e.h} in a row`);
    if (e.v > 1) parts.push(`${e.v} in a column`);
    const why = parts.length ? `It joins ${parts.join(" and ")}` : "It has no neighbours yet";
    return {
      title: `${owner} row ${e.row + 1} is complete`,
      body: `One ${e.color} tile moves onto the wall${e.row > 0 ? "; the rest go back in the box" : ""}. ${why}: +${e.points}.`,
    };
  }
  if (e.kind === "floor") {
    return {
      title: `${owner} floor`,
      body: `${plural(e.tiles, "tile")} on the floor: ${plural(-e.points, "point")} lost. The floor is cleared for next round.`,
    };
  }
  return {
    title: `${owner} end-of-game bonus`,
    body: `${plural(e.rows, "full row")} (+2 each), ${plural(e.cols, "full column")} (+7 each), ${plural(e.colors, "complete colour")} (+10 each): +${e.points}.`,
  };
}

export function AzulPreview() {
  const [stage, setStage] = useState<Stage>("intro");
  const [game, setGame] = useState(() => createGame(FIRST_SEED));
  const [selection, setSelection] = useState<Selection>(null);
  const [turns, setTurns] = useState(0);
  const [botNote, setBotNote] = useState<string | null>(null);
  const [botFlash, setBotFlash] = useState<{ source: Source; line: Target } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [tiling, setTiling] = useState<Tiling | null>(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [roundStartScores, setRoundStartScores] = useState([0, 0]);
  const [log, setLog] = useState<string[]>([]);
  const [botOpen, setBotOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const myBoardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stage === "tiling") myBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [stage]);

  const myTurn = stage === "play" && game.current === 0 && !isRoundOver(game);

  useEffect(() => {
    if (stage !== "play" || game.current !== 1 || isRoundOver(game)) return;
    const t = setTimeout(() => {
      const m = chooseMove(game);
      const note = describeMove(game, m, game.players[1].name);
      setBotNote(note);
      setLog((l) => [note, ...l]);
      setBotFlash({ source: m.source, line: m.line });
      setGame(applyMove(game, m));
    }, BOT_DELAY_MS);
    return () => clearTimeout(t);
  }, [stage, game]);

  useEffect(() => {
    if (stage !== "play" || !isRoundOver(game)) return;
    const t = setTimeout(() => {
      const r = resolveRound(game);
      setTiling({ before: game, steps: r.steps, after: r.state });
      setStepIndex(-1);
      setSelection(null);
      setStage("tiling");
      setLog((l) => [`Round ${game.round} over. Completed rows move to the walls.`, ...l]);
    }, ROUND_END_DELAY_MS);
    return () => clearTimeout(t);
  }, [stage, game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelection(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const suggestion = useMemo(() => (myTurn ? bestMove(game) : null), [myTurn, game]);
  const coaching = turns === 0 || showHint;
  const hintPick = coaching && suggestion && !selection ? { source: suggestion.source, color: suggestion.color } : null;
  const hintLine = useMemo(() => {
    if (!coaching || !selection || !myTurn) return null;
    const options = legalMoves(game).filter((m) => m.source === selection.source && m.color === selection.color);
    if (!options.length) return null;
    return options.reduce((best, m) => (scoreMove(game, m) > scoreMove(game, best) ? m : best)).line;
  }, [coaching, selection, myTurn, game]);

  const targets: Target[] = useMemo(() => {
    if (!selection || !myTurn) return [];
    return legalMoves(game)
      .filter((m) => m.source === selection.source && m.color === selection.color)
      .map((m) => m.line);
  }, [selection, myTurn, game]);

  const targetNotes = useMemo(() => {
    if (!selection) return {};
    const me = game.players[0];
    const n = countOf(game, selection.source, selection.color);
    const notes: Record<string, string> = {};
    for (const t of targets) {
      const { placed, overflow, penalty } = previewPlacement(me, selection.color, n, t);
      if (t === "floor") notes.floor = penalty < 0 ? `−${-penalty}` : "";
      else if (overflow > 0) notes[String(t)] = penalty < 0 ? `−${-penalty}` : `${overflow} spill`;
      else if (placed + me.lines[t].count === t + 1) notes[String(t)] = "fills it";
    }
    return notes;
  }, [selection, targets, game]);

  function pick(source: Source, color: Color) {
    if (!myTurn) return;
    const same = selection?.source === source && selection.color === color;
    setSelection(same ? null : { source, color });
  }

  function place(line: Target) {
    if (!selection) return;
    const move = { ...selection, line };
    const n = countOf(game, selection.source, selection.color);
    const { overflow, penalty } = previewPlacement(game.players[0], selection.color, n, line);
    setWarning(
      penalty < 0
        ? `${plural(line === "floor" ? n : overflow, "tile")} landed on your floor. That's ${penalty} when the round is scored.`
        : null,
    );
    setBotFlash(null);
    setBotNote(null);
    setShowHint(false);
    setGame(applyMove(game, move));
    setSelection(null);
    setTurns((t) => t + 1);
    setLog((l) => [describeMove(game, move, "You"), ...l]);
  }

  function nextStep() {
    if (tiling && stepIndex < tiling.steps.length - 1) setStepIndex(stepIndex + 1);
    else setStage("results");
  }

  function start() {
    setStage("play");
    setTourOpen(true);
  }

  function nextRound() {
    if (!tiling) return;
    setGame(tiling.after);
    setRoundStartScores(tiling.after.players.map((p) => p.score));
    setTiling(null);
    setWarning(null);
    setBotNote(null);
    setBotFlash(null);
    setStage("play");
  }

  function restart() {
    setGame(createGame(Math.floor(Math.random() * 1e9)));
    setTiling(null);
    setTurns(0);
    setWarning(null);
    setBotNote(null);
    setBotFlash(null);
    setRoundStartScores([0, 0]);
    setLog([]);
    setStage("play");
  }

  const currentStep = (() => {
    if (stage === "intro") return -1;
    if (stage === "play") return turns === 0 ? (selection ? 1 : 0) : 2;
    if (stage === "tiling") {
      const e = tiling?.steps[stepIndex]?.event;
      return e && e.kind !== "tile" ? 4 : 3;
    }
    return 5;
  })();

  const tilingStep = tiling && stepIndex >= 0 ? tiling.steps[stepIndex] : null;
  const shown = (() => {
    if (!tiling) return game;
    if (stage === "tiling") return tilingStep?.state ?? tiling.before;
    if (stage === "results") return tiling.steps.at(-1)?.state ?? tiling.before;
    return game;
  })();
  const popFor = (pi: number): [number, number] | null =>
    tilingStep?.event.kind === "tile" && tilingStep.event.player === pi
      ? [tilingStep.event.row, tilingStep.event.col]
      : null;

  const myBuilds = tiling ? tiling.steps.filter((s) => s.event.kind === "tile" && s.event.player === 0).length : 0;
  const nextBuildEvent =
    stage === "tiling" && tiling && stepIndex + 1 < myBuilds ? tiling.steps[stepIndex + 1].event : null;
  const build: BuildTarget | null =
    nextBuildEvent?.kind === "tile"
      ? {
          row: nextBuildEvent.row,
          col: nextBuildEvent.col,
          color: nextBuildEvent.color,
          onDone: () => setStepIndex((i) => i + 1),
        }
      : null;
  const lastMine = tilingStep?.event.kind === "tile" && tilingStep.event.player === 0 ? tilingStep : null;

  const firstBotStep = tiling ? tiling.steps.findIndex((st) => st.event.player === 1) : -1;
  const botTiling = stage === "tiling" && firstBotStep >= 0 && stepIndex >= firstBotStep;
  const guide = guidance({
    stage,
    game,
    turns,
    selection,
    suggestion,
    showHint,
    botNote,
    tiling,
    stepIndex,
    roundStartScores,
    building: !!build,
    onStart: start,
    onHint: () => setShowHint(true),
    onNext: nextStep,
    onSkip: () => setStage("results"),
    onNextRound: nextRound,
  });

  return (
    <div className="space-y-4">
      <StatusBar
        current={currentStep}
        title={guide.title}
        detail={guide.detail}
        warning={stage === "play" ? warning : null}
        actions={guide.actions}
        scores={shown.players.map((p) => p.score)}
        log={log}
        onRestart={restart}
        onTour={() => setTourOpen(true)}
      />
      {tourOpen && <Tour onClose={() => setTourOpen(false)} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Table</div>
            <div className="card-action">
              <span className="badge badge-outline">Simplified preview</span>
            </div>
          </div>
          <div className="card-content">
            <Market
              state={shown}
              selection={selection}
              pickable={myTurn}
              onPick={pick}
              hint={hintPick}
              highlight={stage === "play" && game.current === 0 ? botFlash?.source : null}
            />
          </div>
        </div>

        <div ref={myBoardRef} className="flex scroll-mt-4 flex-col gap-4">
          <PlayerBoard
            player={shown.players[0]}
            active={myTurn}
            targets={targets}
            targetNotes={targetNotes}
            onTarget={place}
            hintLine={hintLine}
            popCell={popFor(0)}
            build={build}
            notice={
              stage === "tiling" && (build || lastMine) ? (
                <BuildNotice build={build} last={lastMine} state={shown} />
              ) : null
            }
          />
          <GoalCard />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <BotPanel
          open={botOpen || botTiling}
          onToggle={() => setBotOpen((o) => !o)}
          player={shown.players[1]}
          thinking={stage === "play" && game.current === 1 && !isRoundOver(game)}
          lastMove={stage === "play" ? botNote : null}
          flashLine={stage === "play" && botFlash && game.current === 0 ? botFlash.line : null}
          popCell={popFor(1)}
        />
        <HowToPlay current={currentStep} />
      </div>
    </div>
  );
}

type Guide = { title: string; detail?: ReactNode; actions?: ReactNode };

function guidance(p: {
  stage: Stage;
  game: GameState;
  turns: number;
  selection: Selection;
  suggestion: Move | null;
  showHint: boolean;
  botNote: string | null;
  tiling: Tiling | null;
  stepIndex: number;
  roundStartScores: number[];
  building: boolean;
  onStart: () => void;
  onHint: () => void;
  onNext: () => void;
  onSkip: () => void;
  onNextRound: () => void;
}): Guide {
  const { stage, game, turns, selection, suggestion, tiling, stepIndex } = p;

  if (stage === "intro") {
    return {
      title: "Learn Azul in one guided round",
      detail: "Play a full round against a beginner bot. Each rule shows up right when you need it.",
      actions: (
        <button type="button" className="btn" onClick={p.onStart}>
          Start
        </button>
      ),
    };
  }

  if (stage === "tiling" && tiling) {
    if (p.building) {
      return {
        title: "Build: move your full rows to the wall",
        detail: "Drag the highlighted tile along the arrow to its matching spot, or click the glowing spot.",
      };
    }
    const step = tiling.steps[stepIndex];
    const last = stepIndex >= tiling.steps.length - 1;
    const noBuilds = !tiling.steps.some((s) => s.event.kind === "tile" && s.event.player === 0);
    const info = step
      ? describeEvent(step, step.state)
      : noBuilds
        ? {
            title: "None of your rows are full this round",
            body: "Only full rows send a tile to the wall. Partly filled rows carry over to next round.",
          }
        : { title: "Every tile is gone, so the round ends", body: "Full rows now move one tile to the wall." };
    return {
      title: `${step && step.event.kind !== "tile" ? "Score" : "Build"}: ${info.title}`,
      detail: info.body,
      actions: (
        <>
          <button type="button" className="btn btn-sm" onClick={p.onNext}>
            {last ? "See results" : "Next"}
          </button>
          {!last && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={p.onSkip}>
              Skip
            </button>
          )}
        </>
      ),
    };
  }

  if (stage === "results" && tiling) {
    const after = tiling.after;
    const over = after.phase === "gameOver";
    const [me, bot] = after.players;
    const floor = tiling.steps.find((s) => s.event.player === 0 && s.event.kind === "floor")?.event;
    const lead = me.score === bot.score ? "you're level" : me.score > bot.score ? "you're ahead" : "the bot is ahead";
    const gains = `You +${me.score - p.roundStartScores[0]}, Bot +${bot.score - p.roundStartScores[1]} this round.`;
    const floorText = floor && floor.points < 0 ? ` Your floor cost ${plural(-floor.points, "point")}.` : "";
    return {
      title: over
        ? `Win: ${me.score >= bot.score ? "you win!" : "the bot wins this one"}`
        : `Round ${tiling.before.round} done: ${lead}`,
      detail: over
        ? `${gains}${floorText} The game ended because someone completed a row on their wall.`
        : `${gains}${floorText} A real game keeps going (about five rounds) until someone completes a row on their wall.`,
      actions: (
        <>
          <Link href="/games/azul/buy" className="btn btn-sm">
            Buy Azul
          </Link>
          {!over && (
            <button type="button" className="btn btn-outline btn-sm" onClick={p.onNextRound}>
              Play round {after.round}
            </button>
          )}
        </>
      ),
    };
  }

  if (isRoundOver(game)) return { title: "All the tiles are taken" };

  if (game.current === 1) {
    return {
      title: "Repeat: the bot is choosing…",
      detail:
        turns === 1
          ? "You and the bot take turns until every factory and the middle are empty."
          : "Watch what it takes. What it leaves behind is what you get to pick from.",
    };
  }

  if (selection) {
    const n = countOf(game, selection.source, selection.color);
    return turns === 0
      ? {
          title: `Place: choose a row for your ${n} ${selection.color}`,
          detail: "Row 1 holds 1 tile, row 5 holds 5. Extra tiles fall to the floor and cost points.",
        }
      : {
          title: `Repeat: place your ${n} ${selection.color}`,
          detail: "Red numbers show what you'd lose to the floor. Press Esc to put them back.",
        };
  }

  const hint = !!suggestion;
  const middleTip =
    game.centerHasFirst && game.center.length > 0 && turns <= 3 ? (
      <>
        {" "}
        First to take from the middle gets the <Tile tile="first" size="xs" /> token: you start next round, but it costs
        1 point.
      </>
    ) : null;

  if (turns === 0)
    return {
      title: "Pick: take tiles of one colour",
      detail: "Click a tile in any factory. The glowing tiles are a good place to start.",
    };

  return {
    title: "Repeat: your move",
    detail: (
      <>
        {p.botNote}
        {middleTip}
      </>
    ),
    actions:
      !p.showHint && hint ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={p.onHint}>
          Hint
        </button>
      ) : undefined,
  };
}

function StatusBar({
  current,
  title,
  detail,
  warning,
  actions,
  scores,
  log,
  onRestart,
  onTour,
}: {
  current: number;
  title: string;
  detail?: ReactNode;
  warning: string | null;
  actions?: ReactNode;
  scores: number[];
  log: string[];
  onRestart: () => void;
  onTour: () => void;
}) {
  const stepNumber = current >= 0 ? `${current + 1} · ` : "";
  return (
    <div className="relative rounded-xl bg-muted/60" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <div className="min-w-0 flex-1 basis-64">
          <div className="font-semibold">
            {stepNumber}
            {title}
          </div>
          {detail && <div className="text-subtle">{detail}</div>}
          {warning && <div className="text-sm text-destructive">{warning}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        <div className="shrink-0 text-sm tabular-nums text-muted-foreground">
          You {scores[0]} · Bot {scores[1]}
        </div>
        <GameMenu log={log} onRestart={onRestart} onTour={onTour} />
      </div>
    </div>
  );
}

function GameMenu({ log, onRestart, onTour }: { log: string[]; onRestart: () => void; onTour: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        className="btn btn-ghost btn-icon-sm"
        aria-label="Game menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden className="text-lg leading-none">
          ⋯
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border bg-popover p-3 shadow-lg">
          <div className="mb-2 text-caption">Game log</div>
          {log.length === 0 ? (
            <p className="text-caption">Moves will show up here.</p>
          ) : (
            <ol className="max-h-64 space-y-2 overflow-y-auto scrollbar-on-hover text-xs">
              {log.map((e, i) => (
                <li key={log.length - i} className={i === 0 ? "text-foreground" : "text-muted-foreground"}>
                  {e}
                </li>
              ))}
            </ol>
          )}
          <div className="prose-divider my-3" />
          <button
            type="button"
            className="btn btn-ghost btn-sm mb-2 w-full"
            onClick={() => {
              setOpen(false);
              onTour();
            }}
          >
            Replay the tour
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm w-full"
            onClick={() => {
              setOpen(false);
              onRestart();
            }}
          >
            New game
          </button>
        </div>
      )}
    </div>
  );
}

function BotPanel({
  open,
  onToggle,
  player,
  thinking,
  lastMove,
  flashLine,
  popCell,
}: {
  open: boolean;
  onToggle: () => void;
  player: Player;
  thinking: boolean;
  lastMove: string | null;
  flashLine: Target | null;
  popCell: [number, number] | null;
}) {
  const fullRows = player.lines.filter((l, i) => l.count === i + 1).length;
  const summary = thinking
    ? "Choosing tiles…"
    : (lastMove ?? `${plural(fullRows, "row")} ready · ${plural(player.floor.length, "floor tile")}`);
  return (
    <div className={`card card-sm ${thinking ? "ring-2 ring-ring/40" : ""}`}>
      <button
        type="button"
        className="card-content flex w-full items-center gap-3 text-left"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="font-medium">Bot</span>
        <span className="text-sm tabular-nums">{player.score} pts</span>
        <span className="min-w-0 flex-1 truncate text-caption">{summary}</span>
        <span aria-hidden className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>
      {open && (
        <div className="card-content border-t pt-3">
          <PlayerBoard player={player} size="sm" bare flashLine={flashLine} popCell={popCell} />
        </div>
      )}
    </div>
  );
}

function HowToPlay({ current }: { current: number }) {
  const [open, setOpen] = useState(false);
  const focus = STEPS[Math.max(current, 0)];
  return (
    <div className="card card-sm">
      <button
        type="button"
        className="card-content flex w-full items-center gap-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-medium">How to play</span>
        <span className="min-w-0 flex-1 truncate text-caption">
          {open ? "All six steps" : `${Math.max(current, 0) + 1} · ${focus.key}: ${focus.text}`}
        </span>
        <span aria-hidden className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>
      <div className="card-content space-y-4 border-t pt-3">
        {open ? (
          <>
            <ol className="space-y-3">
              {STEPS.map((s, i) => (
                <li key={s.key} className={`flex gap-3 ${i === current ? "" : "text-muted-foreground"}`}>
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-medium ${
                      i === current ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm">
                    <span className="font-semibold text-foreground">{s.key}.</span> {s.detail}
                  </span>
                </li>
              ))}
            </ol>
            <div className="space-y-1">
              <div className="text-caption">What&apos;s on the table</div>
              <ul className="space-y-1 text-sm">
                {TABLE_PARTS.map(([name, text]) => (
                  <li key={name}>
                    <span className="font-medium">{name}:</span> <span className="text-muted-foreground">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="blockquote not-italic">{STRATEGY_TIP}</div>
          </>
        ) : (
          <>
            <p className="text-sm">{focus.detail}</p>
            {current === STEPS.length - 1 && <div className="blockquote not-italic">{STRATEGY_TIP}</div>}
          </>
        )}
      </div>
    </div>
  );
}

const GOAL_FOCUS = [
  ["Fill rows exactly", "Take only what a row can hold. Extra tiles fall to the floor and cost points."],
  ["Build in clusters", "A wall tile scores more for every tile it lines up with across and down."],
  ["Race to a full row", "The game ends when someone finishes a wall row. Bonuses: row +2, column +7, colour +10."],
];

function GoalCard() {
  return (
    <div className="card flex-1" data-tour="goal">
      <div className="card-header">
        <div className="card-title">Goal</div>
        <div className="card-description">Score the most points by decorating your wall.</div>
      </div>
      <ol className="card-content grid gap-3 sm:grid-cols-3">
        {GOAL_FOCUS.map(([title, text], i) => (
          <li key={title} className="rounded-lg bg-muted/60 p-3">
            <div className="text-sm font-medium">
              <span className="mr-1.5 text-muted-foreground">{i + 1}</span>
              {title}
            </div>
            <p className="mt-1 text-caption">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BuildNotice({ build, last, state }: { build: BuildTarget | null; last: RoundStep | null; state: GameState }) {
  const result = last ? describeEvent(last, state) : null;
  return (
    <div className="banner banner-info">
      {result && <div className="banner-title">{result.body}</div>}
      {build ? (
        <div className={result ? "banner-description" : "banner-title"}>
          Drag the {build.color} tile from row {build.row + 1} onto its spot on the wall.
        </div>
      ) : (
        <div className="banner-description">Your wall is built. Press Next to watch the bot&apos;s board.</div>
      )}
    </div>
  );
}
