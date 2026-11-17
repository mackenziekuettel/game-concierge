"use client";

import { useId, useMemo, useState } from "react";
import { KNOWN_GAMES } from "@/data/games/known-games";

const NAMES = KNOWN_GAMES.map((g) => g.name).sort((a, b) => a.localeCompare(b));
const MAX_SUGGESTIONS = 8;

function suggestionsFor(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return NAMES.slice(0, MAX_SUGGESTIONS);
  const starts = NAMES.filter((n) => n.toLowerCase().startsWith(q));
  const contains = NAMES.filter((n) => !starts.includes(n) && n.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

export function GameCombobox({
  id,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = useMemo(() => suggestionsFor(value), [value]);
  const exact = options.length === 1 && options[0].toLowerCase() === value.trim().toLowerCase();
  const showList = open && options.length > 0 && !exact;

  function choose(name: string) {
    onChange(name);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && showList && active >= 0) {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {options.map((name, i) => (
            <li
              key={name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer rounded-md px-3 py-2 text-sm ${i === active ? "bg-muted" : "hover:bg-muted/60"}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(name)}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
