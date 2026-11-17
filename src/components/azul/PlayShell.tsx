"use client";

import Link from "next/link";
import { AzulPreview } from "./AzulPreview";

export function PlayShell() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/games/azul" className="btn btn-ghost btn-sm">
            ← Azul
          </Link>
          <h1 className="heading-subsection">Try Azul: guided round vs. beginner bot</h1>
        </div>
        <Link href="/games/azul/buy" className="btn btn-outline btn-sm">
          Where to buy
        </Link>
      </div>
      <AzulPreview />
    </div>
  );
}
