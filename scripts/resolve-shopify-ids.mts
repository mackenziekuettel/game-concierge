// Finds the Shopify Catalog product with the most sellers for each curated game.
//   npm run shopify:resolve-ids [slug...]
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getProductDetails, searchProducts } = await import("../src/lib/shopify/catalog");
const { CURATED_GAMES } = await import("../src/data/games/catalog");

const norm = (s = "") =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
const only = process.argv.slice(2);
const results: Record<string, string> = {};

for (const game of CURATED_GAMES.filter((g) => !only.length || only.includes(g.slug))) {
  try {
    await new Promise((r) => setTimeout(r, 1500));
    const { products } = await searchProducts(`${game.title} board game`, { pagination: { limit: 10 } });
    const wanted = norm(game.title.split(":")[0]);
    const candidates = products.filter((p) => p.id && norm(p.title).includes(wanted)).slice(0, 4);

    const exact = (t?: string) =>
      [wanted, `${wanted}boardgame`, `${wanted}game`].includes(norm(t?.replace(/\(.*?\)/g, "")));
    if (!candidates.length) console.log(`  ${game.slug}: search returned ${products.map((p) => p.title).join(" | ")}`);
    let best: { id: string; title?: string; offers: number; rank: number } | undefined;
    for (const c of candidates) {
      await new Promise((r) => setTimeout(r, 800));
      const { product } = await getProductDetails(c.id!);
      const offers = product?.offers.length ?? 0;
      console.log(`  ${game.slug.padEnd(16)} ${String(offers).padStart(3)} offers  ${c.title}  ${c.id}`);
      const rank = offers + (exact(c.title) ? 100 : 0);
      if (!best || rank > best.rank) best = { id: c.id!, title: c.title, offers, rank };
    }
    if (best) results[game.slug] = best.id;
    console.log(best ? `→ ${game.slug}: ${best.title} (${best.offers} offers)\n` : `→ ${game.slug}: no match\n`);
  } catch (error) {
    console.log(`→ ${game.slug}: failed (${error instanceof Error ? error.message : error}), re-run with this slug\n`);
  }
}

console.log(JSON.stringify(results, null, 2));
