import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Game Concierge",
  description: "Try a board game before you buy it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4">
            <Link href="/" className="heading-subsection flex items-center gap-2.5 whitespace-nowrap">
              <Image src="/images/logo.png" alt="" width={28} height={28} priority className="size-7" />
              The Game Concierge
            </Link>
            <div className="ml-auto">
              <CurrencyPicker />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
