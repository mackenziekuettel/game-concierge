// Field-safe readers for UCP catalog products. Every field is optional because
// the Global Catalog omits fields per product and per profile.

export type Money = { amount: number; currency: string };

export type GameImage = { url: string; alt?: string };
export type GameImages = Record<string, GameImage>;

export type Seller = { id?: string; name?: string; url?: string; domain?: string };

export type Offer = {
  variantId?: string;
  title?: string;
  price?: Money;
  listPrice?: Money;
  available?: boolean;
  condition: string[];
  seller?: Seller;
  productUrl?: string;
  checkoutUrl?: string;
};

export type ProductSummary = {
  id?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  priceRange?: { min?: Money; max?: Money };
  rating?: { value: number; count?: number; scaleMax?: number };
  offers: Offer[];
};

type Obj = Record<string, unknown>;

const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function money(v: unknown): Money | undefined {
  const m = obj(v);
  const amount = num(m?.amount);
  const currency = str(m?.currency);
  return amount !== undefined && currency ? { amount, currency } : undefined;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function description(v: unknown): string | undefined {
  const d = obj(v);
  const raw = str(d?.plain) ?? str(d?.html) ?? str(v);
  return raw ? htmlToText(raw) || undefined : undefined;
}

function seller(v: unknown): Seller | undefined {
  const s = obj(v);
  if (!s) return undefined;
  return { id: str(s.id), name: str(s.name), url: str(s.url), domain: str(s.domain) };
}

function offer(v: unknown): Offer {
  const o = obj(v) ?? {};
  return {
    variantId: str(o.id),
    title: str(o.title),
    price: money(o.price),
    listPrice: money(o.list_price),
    available:
      typeof obj(o.availability)?.available === "boolean" ? (obj(o.availability)!.available as boolean) : undefined,
    condition: arr(o.condition).filter((c): c is string => typeof c === "string"),
    seller: seller(o.seller),
    productUrl: str(o.url),
    checkoutUrl: str(o.checkout_url),
  };
}

export function summarizeProduct(raw: unknown): ProductSummary {
  const p = obj(raw) ?? {};
  const image = arr(p.media)
    .map(obj)
    .find((m) => m && (m.type === undefined || m.type === "image") && str(m.url));
  const rating = obj(p.rating);
  const ratingValue = num(rating?.value);
  const range = obj(p.price_range);

  return {
    id: str(p.id),
    title: str(p.title),
    description: description(p.description),
    imageUrl: str(image?.url),
    imageAlt: str(image?.alt_text),
    priceRange: range ? { min: money(range.min), max: money(range.max) } : undefined,
    rating:
      ratingValue !== undefined
        ? { value: ratingValue, count: num(rating?.count), scaleMax: num(rating?.scale_max) }
        : undefined,
    offers: arr(p.variants).map(offer),
  };
}

export function formatMoney(m: Money | undefined, locale = "en-US"): string | undefined {
  if (!m) return undefined;
  try {
    const fmt = new Intl.NumberFormat(locale, { style: "currency", currency: m.currency });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(m.amount / 10 ** digits);
  } catch {
    return `${m.amount} ${m.currency} (minor units)`;
  }
}

export function formatMoneyWithCode(m: Money | undefined): string | undefined {
  if (!m) return undefined;
  try {
    const fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: m.currency,
      currencyDisplay: "narrowSymbol",
    });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return `${fmt.format(m.amount / 10 ** digits)} ${m.currency}`;
  } catch {
    return formatMoney(m);
  }
}

// Approximate USD rates, used only to order offers priced in different currencies.
// Displayed prices always stay in the merchant's own currency.
const APPROX_USD_RATE: Record<string, number> = {
  USD: 1,
  CAD: 0.72,
  AUD: 0.65,
  NZD: 0.6,
  EUR: 1.08,
  GBP: 1.27,
};

export function convertMoney(m: Money | undefined, currency: string): Money | undefined {
  if (!m) return undefined;
  if (m.currency === currency) return m;
  const from = APPROX_USD_RATE[m.currency];
  const to = APPROX_USD_RATE[currency];
  if (from === undefined || to === undefined) return undefined;
  return { amount: Math.round((m.amount * from) / to), currency };
}

function comparablePrice(m: Money | undefined): number {
  if (!m) return Infinity;
  const rate = APPROX_USD_RATE[m.currency];
  return rate === undefined ? Infinity : m.amount * rate;
}

export function sortOffers(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) => {
    const soldOutA = a.available === false;
    const soldOutB = b.available === false;
    if (soldOutA !== soldOutB) return soldOutA ? 1 : -1;
    return comparablePrice(a.price) - comparablePrice(b.price);
  });
}

const MIN_DISCOUNT_PERCENT = 1;

export function discountPercent(offer: Offer): number | undefined {
  const { price, listPrice } = offer;
  if (!price || !listPrice || price.currency !== listPrice.currency || listPrice.amount <= price.amount) return undefined;
  const percent = Math.round(((listPrice.amount - price.amount) / listPrice.amount) * 100);
  return percent >= MIN_DISCOUNT_PERCENT ? percent : undefined;
}
