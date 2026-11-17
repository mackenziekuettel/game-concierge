import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { similarGames, traitLabel } from "@/lib/discover/recommend";
import { getGameImages } from "@/lib/shopify/images";
import type { GameImages } from "@/lib/shopify/product";

async function GamePhoto({ slug, title }: { slug: string; title: string }) {
  const images: GameImages = await getGameImages().catch(() => ({}));
  const image = images[slug];
  if (!image) return <div className="flex h-full items-center justify-center text-caption">No photo yet</div>;
  return (
    <>
      <Image
        src={image.url}
        alt={image.alt ?? `${title} box`}
        fill
        sizes="(min-width: 640px) 33vw, 100vw"
        className="object-contain p-3"
      />
      <span className="absolute right-2 bottom-2 rounded bg-background/80 px-1.5 text-[0.6rem] text-muted-foreground">
        Photo: Shopify
      </span>
    </>
  );
}

export function SimilarGames({ slug, title }: { slug: string; title: string }) {
  const similar = similarGames(slug, 3);
  if (!similar.length) return null;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="heading-section">If you like {title}, try</h2>
        <p className="text-subtle">Similar games from our collection.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-3">
        {similar.map(({ game, shared }) => {
          const players =
            game.players.min === game.players.max ? `${game.players.min}` : `${game.players.min}–${game.players.max}`;
          const minutes =
            game.minutes.min === game.minutes.max ? `${game.minutes.min}` : `${game.minutes.min}–${game.minutes.max}`;
          return (
            <li
              key={game.slug}
              className="card relative transition-shadow hover:shadow-md hover:ring-foreground/25 has-[.card-link:focus-visible]:ring-2 has-[.card-link:focus-visible]:ring-ring"
            >
              <div className="relative -mt-3 h-40 border-b bg-white sm:-mt-4">
                <Suspense fallback={<div className="h-full animate-pulse bg-muted" />}>
                  <GamePhoto slug={game.slug} title={game.title} />
                </Suspense>
              </div>
              <div className="card-header">
                <div className="card-title text-base">
                  <Link
                    href={`/games/${game.slug}/buy`}
                    className="card-link outline-none after:absolute after:inset-0 after:z-10"
                  >
                    {game.title}
                  </Link>
                </div>
                <div className="card-description">{game.pitch}</div>
              </div>
              <div className="card-content space-y-3">
                <p className="text-caption">
                  {players} players · {minutes} min · Difficulty {game.complexity}/5
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {shared.slice(0, 3).map((t) => (
                    <span key={t} className="badge badge-secondary">
                      {traitLabel(t)}
                    </span>
                  ))}
                </div>
                <span className="link text-sm">Where to buy →</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
