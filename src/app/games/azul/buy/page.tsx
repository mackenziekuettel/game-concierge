import type { Metadata } from "next";
import { WhereToBuy } from "@/components/shopify/WhereToBuy";
import { curatedGame } from "@/data/games/catalog";
import snapshot from "@/data/shopify/azul-product.snapshot.json";
import type { Snapshot } from "@/lib/shopify/offers";

export const metadata: Metadata = {
  title: "Where to buy Azul · The Game Concierge",
  description: "Shopify merchants selling Azul, with live prices and availability.",
};

export default function AzulBuyPage() {
  return (
    <WhereToBuy
      game={curatedGame("azul")!}
      snapshot={snapshot as Snapshot}
      back={{ href: "/games/azul", label: "Azul" }}
    />
  );
}
