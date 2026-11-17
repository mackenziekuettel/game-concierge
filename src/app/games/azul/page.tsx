import type { Metadata } from "next";
import Link from "next/link";
import { SimilarGames } from "@/components/discover/SimilarGames";
import { ProductGallery } from "@/components/ProductGallery";
import { azul } from "@/data/games/azul";

export const metadata: Metadata = {
  title: "Azul · The Game Concierge",
  description: azul.tagline,
};

const HOW_IT_PLAYS = [
  ["Pick", "Take every tile of one colour from a factory or the middle."],
  ["Place", "Line them up in a row on your board. Too many, and they crash to the floor."],
  ["Build", "Full rows send a tile to your wall. Touching tiles score more."],
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-caption">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

export default function AzulProductPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-6">
      <section className="grid items-start gap-8 md:grid-cols-2">
        <ProductGallery images={azul.gallery} />

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-secondary">Curated</span>
              <span className="text-caption">by {azul.designer}</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">{azul.title}</h1>
            <p className="text-lead">{azul.tagline}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Players" value={azul.players} />
            <Stat label="Playtime" value={azul.playtime} />
            <Stat label="Difficulty" value={`${azul.complexity} / 5`} />
            <Stat label="Time to learn" value={azul.timeToLearn} />
          </div>

          <div className="space-y-3">
            <Link href="/games/azul/play" className="btn btn-lg h-12 w-full text-base">
              Try before you buy
            </Link>
            <Link href="/games/azul/buy" className="btn btn-outline btn-lg w-full">
              Where to buy
            </Link>
            <p className="text-caption text-center">
              Play a guided round against a beginner bot. About 5 minutes, no sign-up.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="heading-section">What it&apos;s like to play</h2>
            <p className="text-body">{azul.objective}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {HOW_IT_PLAYS.map(([title, text], i) => (
              <div key={title} className="card card-sm">
                <div className="card-header">
                  <div className="text-caption">Step {i + 1}</div>
                  <div className="card-title text-sm">{title}</div>
                </div>
                <div className="card-content text-subtle">{text}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="text-caption">Replay value</div>
            <p className="text-body">{azul.replay}</p>
          </div>
        </div>

        <aside className="card">
          <div className="card-header">
            <div className="card-title">Good to know</div>
            <div className="card-action">
              <span className="badge badge-secondary">Curated</span>
            </div>
          </div>
          <dl className="card-content space-y-3 text-sm">
            <div>
              <dt className="text-caption">Mood</dt>
              <dd>{azul.mood}</dd>
            </div>
            <div>
              <dt className="text-caption">Table space</dt>
              <dd>{azul.tableSpace}</dd>
            </div>
            <div>
              <dt className="text-caption">Ages</dt>
              <dd>{azul.age}</dd>
            </div>
            <div>
              <dt className="text-caption">If you like</dt>
              <dd>{azul.similar.join(", ")}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <SimilarGames slug={azul.slug} title={azul.title} />
    </div>
  );
}
