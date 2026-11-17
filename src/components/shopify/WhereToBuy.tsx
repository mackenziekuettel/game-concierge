import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { loadProductOffers, type Snapshot } from "@/lib/shopify/offers";
import {
  convertMoney,
  discountPercent,
  formatMoney,
  formatMoneyWithCode,
  sortOffers,
  type Offer,
} from "@/lib/shopify/product";
import { REGION_COOKIE, regionFor } from "@/lib/region";
import { cookies } from "next/headers";
import { BackLink } from "./BackLink";

export type WhereToBuyGame = { slug: string; title: string; shopifyProductId: string; hasPreview?: boolean };

function host(url?: string) {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

function OfferRow({ offer, gameTitle, currency }: { offer: Offer; gameTitle: string; currency: string }) {
  const seller = offer.seller?.name ?? "Unnamed seller";
  const site = host(offer.seller?.url) ?? offer.seller?.domain;
  const local = offer.price?.currency === currency;
  const converted = local ? undefined : convertMoney(offer.price, currency);
  const price = formatMoney(converted ?? offer.price);
  const was = local ? formatMoney(offer.listPrice) : undefined;
  const canBuy = offer.available !== false && offer.checkoutUrl;
  const sale = discountPercent(offer);

  return (
    <li className="card card-sm">
      <div className="card-content grid items-center gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_9.5rem_11.5rem_7rem]">
        <div className="min-w-0">
          <div className="font-medium">{seller}</div>
          {site && <div className="text-caption">{site}</div>}
        </div>

        <div>
          {price ? (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular-nums">
                {converted && <span title="Approximate conversion">≈ </span>}
                {price}
              </span>
              {was && <span className="text-caption line-through tabular-nums">{was}</span>}
            </div>
          ) : (
            <span className="text-subtle">Price not listed</span>
          )}
          <div className="text-caption">
            {converted ? `${formatMoneyWithCode(offer.price)} at checkout` : offer.price?.currency}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {offer.available === undefined ? (
            <span className="badge badge-outline">Availability unknown</span>
          ) : offer.available ? (
            <span className="badge bg-success text-success-foreground">In stock</span>
          ) : (
            <span className="badge badge-secondary">Out of stock</span>
          )}
          {sale && <span className="badge badge-destructive">Sale · {sale}% off</span>}
        </div>

        <div className="flex items-center gap-2 sm:justify-end">
          {offer.productUrl && (
            <a className="btn btn-ghost btn-sm" href={offer.productUrl} target="_blank" rel="noopener noreferrer">
              View
            </a>
          )}
          {canBuy ? (
            <a
              className="btn btn-sm"
              href={offer.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Buy ${gameTitle} at ${seller}`}
            >
              Buy
            </a>
          ) : (
            <span className="btn btn-sm" aria-disabled="true">
              Sold out
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

async function Offers({ game, snapshot }: { game: WhereToBuyGame; snapshot?: Snapshot }) {
  const region = regionFor((await cookies()).get(REGION_COOKIE)?.value);
  const result = await loadProductOffers(game.shopifyProductId, region, snapshot);
  if (result.source === "unavailable") {
    return (
      <div className="banner">
        <div className="banner-title">We couldn&apos;t reach Shopify just now.</div>
        <div className="banner-description">Sellers for {game.title} will show here. Try again in a minute.</div>
      </div>
    );
  }
  const { source, fetchedAt, product } = result;
  const offers = sortOffers(product.offers);
  const inStock = offers.filter((o) => o.available).length;
  const onSale = offers.filter((o) => discountPercent(o)).length;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-content flex flex-wrap items-center gap-5">
          {product.imageUrl && (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.title ?? "Product image"}
              width={96}
              height={96}
              className="size-24 rounded-lg border bg-white object-contain"
            />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="heading-subsection">{product.title ?? game.title}</div>
            <div className="text-subtle">
              {offers.length} {offers.length === 1 ? "seller" : "sellers"} for {region.place} · {inStock} in stock
              {onSale > 0 && ` · ${onSale} on sale`}
              {product.rating &&
                ` · ${product.rating.value}/${product.rating.scaleMax ?? 5} from ${product.rating.count ?? "?"} reviews`}
            </div>
          </div>
          <div className="text-right">
            {source === "live" ? (
              <span className="badge bg-success text-success-foreground">Live from Shopify</span>
            ) : (
              <span className="badge badge-secondary">Saved Shopify data</span>
            )}
            <div className="mt-1 text-caption">
              {source === "live" ? "Updated" : "Saved"} {formatTime(fetchedAt)} UTC
            </div>
          </div>
        </div>
      </div>

      {offers.length === 0 ? (
        <p className="text-subtle">No sellers are listing {game.title} in the Shopify Catalog right now.</p>
      ) : (
        <ul className="space-y-2">
          {offers.map((offer, i) => (
            <OfferRow key={offer.variantId ?? i} offer={offer} gameTitle={game.title} currency={region.currency} />
          ))}
        </ul>
      )}

      <p className="text-caption">
        Prices marked ≈ are approximate conversions into {region.currency}; you pay the merchant&apos;s own currency at
        checkout. Prices and availability come from each merchant through the Shopify Catalog and can change. Checkout
        happens on the merchant&apos;s own store, in the merchant&apos;s currency.
      </p>
    </div>
  );
}

function OffersLoading() {
  return (
    <div className="space-y-2" aria-busy="true">
      <div className="text-subtle">Finding Shopify sellers…</div>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export function WhereToBuy({
  game,
  snapshot,
  back,
}: {
  game: WhereToBuyGame;
  snapshot?: Snapshot;
  back: { href: string; label: string };
}) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <BackLink href={back.href} label={back.label} />
          <h1 className="text-3xl font-semibold tracking-tight">Where to buy {game.title}</h1>
          <p className="text-subtle">Independent game stores and retailers selling {game.title} through Shopify.</p>
        </div>
        {game.hasPreview && (
          <Link href={`/games/${game.slug}/play`} className="btn btn-outline">
            Try before you buy
          </Link>
        )}
      </div>

      <Suspense fallback={<OffersLoading />}>
        <Offers game={game} snapshot={snapshot} />
      </Suspense>
    </div>
  );
}
