"use client";

import { useCallback, useEffect, useState } from "react";

export type TourStop = { target: string; title: string; body: string };

export const TOUR: TourStop[] = [
  {
    target: "market",
    title: "This is the table",
    body: "Each round, tiles are dealt onto five factories. Everyone picks from here, one turn at a time.",
  },
  {
    target: "factory",
    title: "A factory",
    body: "On your turn, take every tile of one colour from one factory. The rest slide into the middle.",
  },
  {
    target: "center",
    title: "The middle",
    body: "Leftovers collect here, and you can pick from it too. The first player to do so takes the 1 token: −1 point, but they start next round.",
  },
  {
    target: "lines",
    title: "Your pattern rows",
    body: "Tiles you take go into one row. Row 1 holds 1 tile, row 5 holds 5, and each row holds one colour.",
  },
  {
    target: "wall",
    title: "Your wall",
    body: "When a row is full, one tile slides across to its colour's spot here and scores. Touching tiles score more.",
  },
  {
    target: "floor",
    title: "The floor",
    body: "Tiles that don't fit fall here and cost points at the end of the round. Avoid it when you can.",
  },
  {
    target: "goal",
    title: "Your goal",
    body: "Have the most points when someone completes a row on their wall. Keep these three ideas in mind.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;
const POPOVER_WIDTH = 320;

function measure(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

const POPOVER_HEIGHT = 200;
const GAP = 12;

function placePopover(rect: Rect | null, vw: number, vh: number) {
  const clampX = (x: number) => Math.min(Math.max(GAP, x), vw - POPOVER_WIDTH - GAP);
  const clampY = (y: number) => Math.min(Math.max(GAP, y), vh - POPOVER_HEIGHT - GAP);
  if (!rect) return { top: 96, left: clampX(vw / 2 - POPOVER_WIDTH / 2) };
  const centerX = clampX(rect.left + rect.width / 2 - POPOVER_WIDTH / 2);
  const bottom = rect.top + rect.height;
  const right = rect.left + rect.width;
  if (vh - bottom >= POPOVER_HEIGHT + GAP) return { top: bottom + GAP, left: centerX };
  if (rect.top >= POPOVER_HEIGHT + GAP) return { bottom: vh - rect.top + GAP, left: centerX };
  if (vw - right >= POPOVER_WIDTH + GAP * 2) return { top: clampY(rect.top + 24), left: right + GAP };
  if (rect.left >= POPOVER_WIDTH + GAP * 2) return { top: clampY(rect.top + 24), left: rect.left - POPOVER_WIDTH - GAP };
  return { bottom: GAP, left: clampX(vw / 2 - POPOVER_WIDTH / 2) };
}

export function Tour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const stop = TOUR[index];
  const last = index === TOUR.length - 1;

  const update = useCallback(() => setRect(measure(stop.target)), [stop.target]);

  useEffect(() => {
    document.querySelector(`[data-tour="${stop.target}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const timer = setTimeout(update, 0);
    const settle = setTimeout(update, 400);
    return () => {
      clearTimeout(timer);
      clearTimeout(settle);
    };
  }, [stop.target, update]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMove = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 16);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, TOUR.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;
  const popStyle = placePopover(rect, vw, vh);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="fixed inset-0 z-40" onClick={(e) => e.stopPropagation()} />
      {rect && (
        <div
          className="tour-spot"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden
        />
      )}
      <div
        className="fixed z-50 max-w-[calc(100vw-24px)] rounded-xl bg-popover p-4 shadow-xl ring-1 ring-foreground/10"
        style={{ ...popStyle, width: POPOVER_WIDTH }}
      >
        <div className="mb-1 text-caption">
          Quick tour · {index + 1} of {TOUR.length}
        </div>
        <div id="tour-title" className="heading-subsection">
          {stop.title}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{stop.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm mr-auto" onClick={onClose}>
            Skip
          </button>
          {index > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm"
            autoFocus
            onClick={() => (last ? onClose() : setIndex(index + 1))}
          >
            {last ? "Let's play" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
