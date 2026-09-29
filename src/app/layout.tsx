import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Pharmnos Lite — Pharmacy Wholesale Simplified",
    template: "%s · Pharmnos Lite",
  },
  description:
    "A free-first, multi-tenant pharmacy wholesale web app for India. Billing, batch-wise inventory, expiry control, purchases, ledgers, and visibility on desktop and mobile.",
  applicationName: "Pharmnos Lite",
  keywords: [
    "pharmacy",
    "wholesale",
    "billing",
    "inventory",
    "batch tracking",
    "expiry control",
    "GST",
    "India",
    "ERP",
  ],
  authors: [{ name: "Pharmnos Lite" }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    title: "Pharmnos Lite — Pharmacy Wholesale Simplified",
    description:
      "Billing, batch-wise inventory, expiry control, purchases, ledgers, and business visibility for Indian pharmacy wholesalers.",
    siteName: "Pharmnos Lite",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pharmnos Lite",
    description:
      "Pharmacy wholesale essentials: billing, inventory with batch and expiry, purchases, and ledgers.",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable)} suppressHydrationWarning>
      <body className="min-h-dvh bg-canvas text-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
