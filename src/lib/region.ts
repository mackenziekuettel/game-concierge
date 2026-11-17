// The shopper's region: Shopify returns local prices and sellers when given both a currency and a country.

export const REGIONS = [
  { currency: "USD", country: "US", label: "USD $", place: "the United States" },
  { currency: "CAD", country: "CA", label: "CAD $", place: "Canada" },
  { currency: "GBP", country: "GB", label: "GBP £", place: "the United Kingdom" },
  { currency: "EUR", country: "DE", label: "EUR €", place: "Germany" },
  { currency: "AUD", country: "AU", label: "AUD $", place: "Australia" },
] as const;

export type Region = (typeof REGIONS)[number];

export const REGION_COOKIE = "currency";
export const DEFAULT_REGION: Region = REGIONS[0];

export function regionFor(currency: string | undefined | null): Region {
  return REGIONS.find((r) => r.currency === currency) ?? DEFAULT_REGION;
}
