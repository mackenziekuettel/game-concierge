"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  FLOOR_PENALTIES,
  wallColor,
  type Color,
  type FloorTile,
  type GameState,
  type Player,
  type Source,
  type Target,
} from "@/lib/azul/engine";

type TileSize = "md" | "sm" | "xs";

const sizeClass: Record<TileSize, string> = { md: "", sm: "tile-sm", xs: "tile-xs" };

export function Tile({
  tile,
  size = "md",
  className = "",
  onClick,
}: {
  tile: FloorTile | null;
  size?: TileSize;
  className?: string;
  onClick?: () => void;
}) {
  const base = `tile ${sizeClass[size]} ${className}`;
  if (tile === null) return <span className={`${base} tile-empty`} aria-hidden />;
  if (tile === "first")
    return (
      <span className={`${base} tile-first`} aria-label="First player token">
        1
      </span>
    );
  if (onClick)
    return (
      <button
        type="button"
        className={`${base} tile-${tile} tile-pickable`}
        aria-label={`${tile} tile`}
        onClick={onClick}
      />
    );
  return <span className={`${base} tile-${tile}`} aria-label={`${tile} tile`} />;
}

export type Selection = { source: Source; color: Color } | null;

export function Market({
  state,
  selection,
  pickable,
  onPick,
  highlight,
  hint,
}: {
  state: GameState;
  selection: Selection;
  pickable: boolean;
  onPick: (source: Source, color: Color) => void;
  highlight?: Source | null;
  hint?: Selection;
}) {
  const tileClass = (source: Source, color: Color) => {
    if (!selection) return hint && hint.source === source && hint.color === color ? "tile-hint" : "";
    if (selection.source !== source) return "";
    return selection.color === color ? "tile-selected" : "tile-dimmed";
  };

  const slot = (i: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / state.factories.length;
    return {
      "--x": Math.cos(angle).toFixed(4),
      "--y": Math.sin(angle).toFixed(4),
    } as CSSProperties;
  };

  return (
    <div className="market-ring" data-tour="market">
      {state.factories.map((tiles, i) => (
        <div key={i} className="market-slot flex flex-col items-center gap-1" style={slot(i)}>
          <div
            className={`factory ${tiles.length === 0 ? "factory-empty" : ""} ${highlight === i ? "board-flash" : ""}`}
            data-tour="factory"
          >
            {tiles.map((color, j) => (
              <Tile
                key={j}
                tile={color}
                className={tileClass(i, color)}
                onClick={pickable ? () => onPick(i, color) : undefined}
              />
            ))}
          </div>
          <span className="text-caption">Factory {i + 1}</span>
        </div>
      ))}
      <div className={`market-slot market-center ${highlight === "center" ? "board-flash" : ""}`} data-tour="center">
        <div className="mb-2 text-caption">Middle</div>
        <div className="flex min-h-8 flex-wrap justify-center gap-1.5">
          {state.centerHasFirst && <Tile tile="first" />}
          {[...state.center].sort().map((color, j) => (
            <Tile
              key={j}
              tile={color}
              className={tileClass("center", color)}
              onClick={pickable ? () => onPick("center", color) : undefined}
            />
          ))}
          {state.center.length === 0 && !state.centerHasFirst && (
            <span className="text-caption self-center">Empty</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PlayerBoard({
  player,
  size = "md",
  active,
  targets,
  targetNotes,
  onTarget,
  flashLine,
  hintLine,
  popCell,
  build,
  notice,
  bare,
}: {
  player: Player;
  size?: TileSize;
  active?: boolean;
  targets?: Target[];
  targetNotes?: Partial<Record<string, string>>;
  onTarget?: (t: Target) => void;
  flashLine?: Target | null;
  hintLine?: Target | null;
  popCell?: [number, number] | null;
  build?: BuildTarget | null;
  notice?: ReactNode;
  bare?: boolean;
}) {
  const isTarget = (t: Target) => targets?.includes(t) ?? false;
  const gap = size === "md" ? "gap-1" : "gap-0.5";
  const boardRef = useRef<HTMLDivElement>(null);
  const arrow = useBuildArrow(boardRef, build);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [miss, setMiss] = useState<string | null>(null);
  const targetKey = build ? `${build.row}-${build.col}` : null;

  function endDrag(e: PointerEvent<HTMLElement>) {
    setDrag(null);
    if (!build) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-wall]");
    if (!cell) return;
    if (cell.dataset.wall === targetKey) {
      setMiss(null);
      build.onDone();
    } else {
      setMiss(cell.dataset.wall ?? null);
    }
  }

  const missColor = miss ? wallColor(Number(miss[0]), Number(miss[2])) : null;

  return (
    <div
      className={`${size === "md" ? "board-md" : ""} ${bare ? "" : `card ${active || build ? "ring-2 ring-ring/60" : ""}`}`}
    >
      {!bare && (
        <div className="card-header">
          <div className="card-title">{player.name}</div>
          <div className="card-action">
            <span className="text-metric text-2xl">{player.score}</span>
            <span className="ml-1 text-caption">pts</span>
          </div>
        </div>
      )}
      <div className={bare ? "space-y-3" : "card-content space-y-3"}>
        {build && missColor ? (
          <div className="banner banner-warning">
            <div className="banner-title">That spot is for {missColor}.</div>
            <div className="banner-description">
              Each wall row has one spot per colour. Follow the arrow to the {build.color} spot.
            </div>
          </div>
        ) : (
          notice
        )}
        <div ref={boardRef} className={`relative flex items-start ${size === "md" ? "gap-4" : "gap-2"}`}>
          {arrow && (
            <svg className="build-arrow" aria-hidden>
              <defs>
                <marker
                  id={`arrowhead-${player.name}`}
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
              </defs>
              <path d={arrow} markerEnd={`url(#arrowhead-${player.name})`} />
            </svg>
          )}
          <div className={`flex flex-col ${gap}`} data-tour="lines">
            {player.lines.map((line, row) => {
              const target = isTarget(row);
              const cells = Array.from({ length: row + 1 }, (_, i) => (i >= row + 1 - line.count ? line.color : null));
              const note = targetNotes?.[String(row)];
              const content = (
                <>
                  {note && (
                    <span
                      className={`mr-1 text-xs ${note.startsWith("−") ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {note}
                    </span>
                  )}
                  {cells.map((c, i) =>
                    build?.row === row && i === row && c ? (
                      <span
                        key={i}
                        data-build-source
                        role="img"
                        aria-label={`${c} tile, drag to the wall`}
                        className={`tile ${sizeClass[size]} tile-${c} build-source ${drag ? "opacity-30" : ""}`}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setDrag({ x: e.clientX, y: e.clientY });
                        }}
                        onPointerMove={(e) => drag && setDrag({ x: e.clientX, y: e.clientY })}
                        onPointerUp={endDrag}
                        onPointerCancel={() => setDrag(null)}
                      />
                    ) : (
                      <Tile key={i} tile={c} size={size} />
                    ),
                  )}
                </>
              );
              const cls = `flex items-center justify-end ${gap} p-0.5 ${flashLine === row ? "board-flash rounded-lg" : ""} ${
                hintLine === row ? "focus-glow" : ""
              }`;
              return target ? (
                <button
                  key={row}
                  type="button"
                  className={`${cls} board-target`}
                  aria-label={`Place on row ${row + 1}`}
                  onClick={() => onTarget?.(row)}
                >
                  {content}
                </button>
              ) : (
                <div key={row} className={cls}>
                  {content}
                </div>
              );
            })}
          </div>
          <div className={`grid grid-cols-5 ${gap} p-0.5`} data-tour="wall">
            {player.wall.map((row, r) =>
              row.map((filled, c) => {
                const key = `${r}-${c}`;
                const cls = `tile ${sizeClass[size]} tile-${wallColor(r, c)} ${filled ? "" : "tile-ghost"} ${
                  popCell?.[0] === r && popCell?.[1] === c ? "tile-pop" : ""
                } ${miss === key ? "tile-shake" : ""}`;
                return key === targetKey ? (
                  <button
                    key={key}
                    type="button"
                    data-wall={key}
                    className={`${cls} build-target`}
                    aria-label={`Move the ${build?.color} tile here`}
                    onClick={() => build?.onDone()}
                  />
                ) : (
                  <span key={key} data-wall={key} className={cls} aria-hidden />
                );
              }),
            )}
          </div>
        </div>
        {drag && build && (
          <span
            className={`tile ${sizeClass[size]} tile-${build.color} build-ghost`}
            style={{ left: drag.x, top: drag.y }}
            aria-hidden
          />
        )}
        <FloorLine
          floor={player.floor}
          size={size}
          target={isTarget("floor")}
          note={targetNotes?.floor}
          onClick={() => onTarget?.("floor")}
          flash={flashLine === "floor"}
        />
      </div>
    </div>
  );
}

export type BuildTarget = { row: number; col: number; color: Color; onDone: () => void };

function useBuildArrow(boardRef: RefObject<HTMLDivElement | null>, build?: BuildTarget | null) {
  const [path, setPath] = useState<string | null>(null);
  const row = build?.row;
  const col = build?.col;

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || row === undefined || col === undefined) {
      setPath(null);
      return;
    }
    const measure = () => {
      const from = board.querySelector("[data-build-source]")?.getBoundingClientRect();
      const to = board.querySelector(`[data-wall="${row}-${col}"]`)?.getBoundingClientRect();
      if (!from || !to) return setPath(null);
      const origin = board.getBoundingClientRect();
      const sx = from.left + from.width / 2 - origin.left;
      const sy = from.top - origin.top;
      const tx = to.left + to.width / 2 - origin.left;
      const ty = to.top - origin.top - 4;
      const lift = Math.max(28, Math.abs(tx - sx) * 0.35);
      setPath(`M ${sx} ${sy} C ${sx} ${sy - lift}, ${tx} ${ty - lift}, ${tx} ${ty}`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    return () => ro.disconnect();
  }, [boardRef, row, col]);

  return path;
}

function FloorLine({
  floor,
  size,
  target,
  note,
  onClick,
  flash,
}: {
  floor: FloorTile[];
  size: TileSize;
  target: boolean;
  note?: string;
  onClick: () => void;
  flash: boolean;
}) {
  const body = (
    <div className="flex items-end gap-1">
      {FLOOR_PENALTIES.map((p, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <Tile tile={floor[i] ?? null} size={size} />
          <span className="text-[0.65rem] tabular-nums text-muted-foreground">{p}</span>
        </div>
      ))}
      {note && <span className="ml-2 self-center text-xs text-destructive">{note}</span>}
    </div>
  );
  const cls = `flex items-center gap-2 p-1 ${flash ? "board-flash rounded-lg" : ""}`;
  return (
    <div data-tour="floor">
      <div className="mb-1 text-caption">Floor</div>
      {target ? (
        <button type="button" className={`${cls} board-target`} aria-label="Drop on floor" onClick={onClick}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </div>
  );
}
