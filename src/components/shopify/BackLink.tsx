"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export const LAST_RESULTS_KEY = "discover:last-results";

function savedResults() {
  try {
    const saved = sessionStorage.getItem(LAST_RESULTS_KEY);
    return saved?.startsWith("/?") ? saved : null;
  } catch {
    return null;
  }
}

export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className="link-muted text-sm"
      onClick={(e) => {
        const saved = href === "/" ? savedResults() : null;
        if (saved) {
          e.preventDefault();
          router.push(saved);
        }
      }}
    >
      ← {label}
    </Link>
  );
}
