import type { Metadata } from "next";
import { PlayShell } from "@/components/azul/PlayShell";

export const metadata: Metadata = {
  title: "Play Azul · The Game Concierge",
};

export default function AzulPlayPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <PlayShell />
    </div>
  );
}
