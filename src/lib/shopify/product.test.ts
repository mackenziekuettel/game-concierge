import { describe, expect, it } from "vitest";
import { convertMoney, discountPercent, formatMoney, formatMoneyWithCode, sortOffers, summarizeProduct } from "./product";

describe("summarizeProduct", () => {
  it("reads a catalog product shaped like a real search_catalog result", () => {
    const p = summarizeProduct({
      id: "gid://shopify/p/abc",
      title: "Azul",
      description: { plain: "<p><strong>Ages:</strong> 8+</p>\n<p>Players: 2&ndash;4 &amp; more</p>" },
      media: [{ type: "image", url: "https://cdn.shopify.com/azul.png", alt_text: "Azul box" }],
      rating: { value: 4.7, scale_min: 1, scale_max: 5, count: 18 },
      price_range: { min: { amount: 4495, currency: "CAD" }, max: { amount: 4495, currency: "CAD" } },
      variants: [
        {
          id: "gid://shopify/ProductVariant/1",
          price: { amount: 4495, currency: "CAD" },
          availability: { available: true },
          condition: ["new"],
          seller: { id: "gid://shopify/Shop/1", name: "401 Games", domain: "401games.myshopify.com" },
          checkout_url: "https://store.example/buy/1:1",
        },
      ],
    });

    expect(p.description).toBe("Ages: 8+\nPlayers: 2–4 & more");
    expect(p.imageUrl).toBe("https://cdn.shopify.com/azul.png");
    expect(p.offers[0]).toMatchObject({
      price: { amount: 4495, currency: "CAD" },
      available: true,
      condition: ["new"],
      seller: { name: "401 Games" },
      checkoutUrl: "https://store.example/buy/1:1",
    });
  });

  it("tolerates missing and malformed fields", () => {
    const p = summarizeProduct({ title: "", media: "nope", variants: [{ price: { amount: "10" }, seller: null }] });
    expect(p).toEqual({
      id: undefined,
      title: undefined,
      description: undefined,
      imageUrl: undefined,
      imageAlt: undefined,
      priceRange: undefined,
      rating: undefined,
      offers: [expect.objectContaining({ price: undefined, available: undefined, seller: undefined, condition: [] })],
    });
    expect(summarizeProduct(null).offers).toEqual([]);
  });
});

describe("formatMoney", () => {
  it("converts minor units using the currency's own decimals", () => {
    expect(formatMoney({ amount: 4495, currency: "USD" })).toBe("$44.95");
    expect(formatMoney({ amount: 500, currency: "JPY" })).toBe("¥500");
  });

  it("spells out the currency code so converted prices aren't ambiguous", () => {
    expect(formatMoneyWithCode({ amount: 4299, currency: "USD" })).toBe("$42.99 USD");
    expect(formatMoneyWithCode({ amount: 5699, currency: "CAD" })).toBe("$56.99 CAD");
  });
});

describe("sortOffers", () => {
  const offer = (amount: number, currency: string, available = true) => ({
    price: { amount, currency },
    available,
    condition: [],
  });

  it("orders by price low to high across currencies, with sold-out offers last", () => {
    const sorted = sortOffers([
      offer(3999, "USD"),
      offer(4495, "CAD"),
      offer(2999, "USD", false),
      offer(3199, "USD"),
      offer(5699, "CAD"),
    ]);
    expect(sorted.map((o) => `${o.price?.amount} ${o.price?.currency}`)).toEqual([
      "3199 USD",
      "4495 CAD",
      "3999 USD",
      "5699 CAD",
      "2999 USD",
    ]);
  });
});

describe("convertMoney", () => {
  it("approximates other currencies in the shopper's currency and leaves matching ones alone", () => {
    expect(convertMoney({ amount: 4495, currency: "CAD" }, "CAD")).toEqual({ amount: 4495, currency: "CAD" });
    const usd = convertMoney({ amount: 4495, currency: "CAD" }, "USD");
    expect(usd?.currency).toBe("USD");
    expect(usd?.amount).toBeGreaterThan(3000);
    expect(usd?.amount).toBeLessThan(3500);
    expect(convertMoney({ amount: 100, currency: "XYZ" }, "USD")).toBeUndefined();
  });
});

describe("discountPercent", () => {
  it("reports a sale only when the compare-at price is higher in the same currency", () => {
    const o = (price: number, list?: number, listCurrency = "USD") => ({
      price: { amount: price, currency: "USD" },
      listPrice: list === undefined ? undefined : { amount: list, currency: listCurrency },
      condition: [],
    });
    expect(discountPercent(o(3199, 3999))).toBe(20);
    expect(discountPercent(o(3999, 3999))).toBeUndefined();
    expect(discountPercent(o(3999))).toBeUndefined();
    expect(discountPercent(o(3199, 3999, "CAD"))).toBeUndefined();
    expect(discountPercent(o(3990, 4000))).toBeUndefined();
  });
});
