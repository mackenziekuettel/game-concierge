import "server-only";
import { cacheLife } from "next/cache";
import { CURATED_GAMES } from "@/data/games/catalog";
import { getProductDetails } from "./catalog";
import type { GameImage, GameImages } from "./product";

const CONCURRENCY = 4;
const ALLOWED_HOST = "cdn.shopify.com";

async function imageFor(id: string): Promise<GameImage | null> {
  const { product } = await getProductDetails(id);
  if (!product?.imageUrl) return null;
  try {
    if (new URL(product.imageUrl).hostname !== ALLOWED_HOST) return null;
  } catch {
    return null;
  }
  return { url: product.imageUrl, alt: product.imageAlt };
}

export async function getGameImages(): Promise<GameImages> {
  "use cache";
  const images: GameImages = {};
  let failures = 0;
  const queue = [...CURATED_GAMES];

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let game = queue.shift(); game; game = queue.shift()) {
        try {
          const image = await imageFor(game.shopifyProductId);
          if (image) images[game.slug] = image;
        } catch (error) {
          failures++;
          console.error(
            `[shopify] image lookup failed for ${game.slug}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    }),
  );

  if (failures) cacheLife({ stale: 60, revalidate: 300, expire: 900 });
  else cacheLife({ stale: 3600, revalidate: 6 * 3600, expire: 24 * 3600 });
  return images;
}
