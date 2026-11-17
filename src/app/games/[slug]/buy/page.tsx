import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WhereToBuy } from "@/components/shopify/WhereToBuy";
import { CURATED_GAMES, curatedGame } from "@/data/games/catalog";

export function generateStaticParams() {
  return CURATED_GAMES.filter((g) => g.slug !== "azul").map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/games/[slug]/buy">): Promise<Metadata> {
  const game = curatedGame((await params).slug);
  return { title: game ? `Where to buy ${game.title} · The Game Concierge` : "Not found" };
}

async function Buy({ params }: { params: PageProps<"/games/[slug]/buy">["params"] }) {
  const game = curatedGame((await params).slug);
  if (!game) notFound();
  return <WhereToBuy game={game} back={{ href: "/", label: "Recommendations" }} />;
}

export default function BuyPage({ params }: PageProps<"/games/[slug]/buy">) {
  return (
    <Suspense fallback={<div className="mx-auto h-40 w-full max-w-7xl animate-pulse px-4 py-6" />}>
      <Buy params={params} />
    </Suspense>
  );
}
