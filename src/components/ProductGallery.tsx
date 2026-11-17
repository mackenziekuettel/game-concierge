"use client";

import Image from "next/image";
import { useState } from "react";

export type GalleryImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  fit?: "contain" | "cover";
};

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      <ul className="flex gap-2 sm:flex-col" aria-label="Product photos">
        {images.map((img, i) => (
          <li key={img.src}>
            <button
              type="button"
              aria-label={`Show photo ${i + 1}: ${img.alt}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              className={`relative block size-16 overflow-hidden rounded-lg border bg-white transition sm:size-20 ${
                i === active ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={img.src}
                alt=""
                fill
                sizes="80px"
                className={img.fit === "cover" ? "object-cover" : "object-contain p-1"}
              />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative aspect-square flex-1 overflow-hidden rounded-2xl border bg-white">
        <Image
          key={current.src}
          src={current.src}
          alt={current.alt}
          fill
          priority={active === 0}
          sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
          className={current.fit === "cover" ? "object-cover" : "object-contain p-6"}
        />
      </div>
    </div>
  );
}
