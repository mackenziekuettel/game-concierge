import "server-only";
import { cacheLife } from "next/cache";
import { getProductDetails } from "./catalog";
import { summarizeProduct, type ProductSummary } from "./product";

export type Snapshot = { savedAt: string; response: { product?: unknown } };

export type ProductOffers =
  { source: "live" | "saved"; fetchedAt: string; product: ProductSummary } | { source: "unavailable" };

async function fetchLive(id: string, currency: string, country: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 600 });
  const { product } = await getProductDetails(id, { context: { currency, address_country: country } });
  if (!product) throw new Error(`Shopify returned no product for ${id}`);
  return { product, fetchedAt: new Date().toISOString() };
}

export async function loadProductOffers(
  id: string,
  region: { currency: string; country: string },
  snapshot?: Snapshot,
): Promise<ProductOffers> {
  try {
    return { source: "live", ...(await fetchLive(id, region.currency, region.country)) };
  } catch (error) {
    console.error(`[shopify] live get_product failed for ${id}: ${error instanceof Error ? error.message : error}`);
    if (!snapshot) return { source: "unavailable" };
    return { source: "saved", fetchedAt: snapshot.savedAt, product: summarizeProduct(snapshot.response.product) };
  }
}
