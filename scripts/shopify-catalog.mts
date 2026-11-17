// Live checks against Shopify's Global Catalog (UCP search_catalog + get_product).
//   npm run shopify:test                      search "Azul board game", then get_product on the first result
//   npm run shopify:search -- "Cascadia"      search only
//   npm run shopify:product -- gid://shopify/p/...
//   add --raw to print the untouched structuredContent JSON
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getProduct, getProductDetails, searchCatalog, searchProducts } = await import("../src/lib/shopify/catalog");
const { formatMoney } = await import("../src/lib/shopify/product");
type ProductSummary = import("../src/lib/shopify/product").ProductSummary;

const DEFAULT_QUERY = "Azul board game";
const MISSING = "\x1b[2mnot provided\x1b[0m";
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

const args = process.argv.slice(2);
const raw = args.includes("--raw");
const [mode = "test", value] = args.filter((a) => a !== "--raw");

function line(label: string, v: string | undefined, indent = 4) {
  console.log(`${" ".repeat(indent)}${label.padEnd(13)}${v ?? MISSING}`);
}

function truncate(s: string | undefined, max: number) {
  if (!s) return undefined;
  const flat = s.replace(/\n/g, " · ");
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function priceRange(p: ProductSummary) {
  const min = formatMoney(p.priceRange?.min);
  const max = formatMoney(p.priceRange?.max);
  if (!min && !max) return undefined;
  return min === max || !max ? min : `${min ?? "?"} – ${max}`;
}

function printProduct(p: ProductSummary, i: number | null, full: boolean) {
  console.log(`\n  ${i === null ? "" : `[${i + 1}] `}${bold(p.title ?? "(untitled)")}`);
  line("ID", p.id);
  line("Price", priceRange(p));
  line("Rating", p.rating ? `${p.rating.value}/${p.rating.scaleMax ?? 5}${p.rating.count ? ` (${p.rating.count} reviews)` : ""}` : undefined);
  line("Image", p.imageUrl);
  line("Description", full ? p.description?.replace(/\n/g, `\n${" ".repeat(17)}`) : truncate(p.description, 140));
  console.log(`    Offers (${p.offers.length})`);
  for (const o of p.offers) {
    const who = o.seller?.name ?? MISSING;
    const where = o.seller?.url ?? o.seller?.domain;
    const stock = o.available === undefined ? "availability not provided" : o.available ? "in stock" : "out of stock";
    const price = formatMoney(o.price) ?? "price not provided";
    const list = o.listPrice ? ` (was ${formatMoney(o.listPrice)})` : "";
    console.log(`      • ${who}${where ? ` <${where}>` : ""}  ${price}${list}  ${stock}${o.condition.length ? `  ${o.condition.join("/")}` : ""}`);
    if (full) {
      line("variant", o.variantId, 10);
      line("seller id", o.seller?.id, 10);
      line("product url", o.productUrl, 10);
      line("checkout url", o.checkoutUrl, 10);
    }
  }
}

function printMessages(messages: unknown[]) {
  if (messages.length) console.log(`\n  Messages from Shopify: ${JSON.stringify(messages)}`);
}

async function runSearch(query: string) {
  console.log(`\n${bold("search_catalog")}  query: "${query}"`);
  if (raw) {
    console.log(JSON.stringify(await searchCatalog({ query }), null, 2));
    return undefined;
  }
  const { products, pagination, messages } = await searchProducts(query);
  console.log(
    `  ${products.length} products returned` +
      (pagination?.totalCount !== undefined ? ` (about ${pagination.totalCount} matches, more pages: ${pagination.hasNextPage ?? "unknown"})` : ""),
  );
  products.forEach((p, i) => printProduct(p, i, false));
  printMessages(messages);
  return products[0]?.id;
}

async function runProduct(id: string) {
  console.log(`\n${bold("get_product")}  id: ${id}`);
  if (raw) {
    console.log(JSON.stringify(await getProduct({ id }), null, 2));
    return;
  }
  const { product, messages } = await getProductDetails(id);
  if (product) printProduct(product, null, true);
  else {
    console.log("  No product in the response.");
    process.exitCode = 1;
  }
  printMessages(messages);
}

try {
  if (mode === "search") await runSearch(value ?? DEFAULT_QUERY);
  else if (mode === "product") {
    if (!value) throw new Error("Pass a product ID: npm run shopify:product -- gid://shopify/p/...");
    await runProduct(value);
  } else {
    const firstId = await runSearch(DEFAULT_QUERY);
    if (firstId) await runProduct(firstId);
    else if (!raw) throw new Error("Search returned no products, so get_product was skipped.");
  }
  console.log();
} catch (error) {
  console.error(`\n\x1b[31mFailed:\x1b[0m ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
