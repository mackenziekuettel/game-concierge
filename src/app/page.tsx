import { Suspense } from "react";
import { Discover } from "@/components/discover/Discover";
import { getGameImages } from "@/lib/shopify/images";

export default function Home() {
  const images = getGameImages().catch(() => ({}));
  return (
    <Suspense>
      <Discover images={images} />
    </Suspense>
  );
}
