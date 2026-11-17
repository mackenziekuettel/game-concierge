"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore, useTransition } from "react";
import { DEFAULT_REGION, REGION_COOKIE, REGIONS, regionFor } from "@/lib/region";

const listeners = new Set<() => void>();

function readCookie() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${REGION_COOKIE}=([^;]*)`));
  return regionFor(match?.[1]).currency;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function CurrencyPicker() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const currency = useSyncExternalStore(subscribe, readCookie, () => DEFAULT_REGION.currency);

  function change(next: string) {
    document.cookie = `${REGION_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    listeners.forEach((l) => l());
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only text-muted-foreground sm:not-sr-only">Prices in</span>
      <select
        className="input h-8 w-auto py-0 pr-8"
        value={currency}
        aria-busy={pending}
        onChange={(e) => change(e.target.value)}
      >
        {REGIONS.map((r) => (
          <option key={r.currency} value={r.currency}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}
