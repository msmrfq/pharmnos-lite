import Link from "next/link";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-hairline-soft bg-canvas/80 backdrop-blur">
      <div className="container-editorial flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Pill className="h-4 w-4 text-on-primary" strokeWidth={2.25} />
          </span>
          <span className="text-title-md font-semibold tracking-brand text-ink">
            Pharmnos
            <span className="text-muted font-medium"> Lite</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-nav-link text-body hover:text-ink transition-none"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth/sign-in">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/auth/sign-up">Sign up free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="mt-section border-t border-hairline bg-surface-dark text-on-dark-soft">
      <div className="container-editorial py-16">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="space-y-4 md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-canvas">
                <Pill className="h-4 w-4 text-ink" strokeWidth={2.25} />
              </span>
              <span className="text-title-md font-semibold text-on-dark">
                Pharmnos Lite
              </span>
            </Link>
            <p className="text-body-sm max-w-md">
              Pharmacy wholesale essentials. Billing, batch-wise inventory, expiry control,
              purchases, ledgers, and daily business visibility.
            </p>
            <p className="text-caption text-on-dark-soft/70 pt-4">
              © {new Date().getFullYear()} Pharmnos Lite. All rights reserved.
            </p>
          </div>
          <div>
            <h4 className="text-nav-link font-semibold text-on-dark mb-4">Product</h4>
            <ul className="space-y-3 text-body-sm">
              <li><Link href="/#features" className="hover:text-on-dark">Features</Link></li>
              <li><Link href="/#how" className="hover:text-on-dark">How it works</Link></li>
              <li><Link href="/#pricing" className="hover:text-on-dark">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-nav-link font-semibold text-on-dark mb-4">Company</h4>
            <ul className="space-y-3 text-body-sm">
              <li><Link href="/contact" className="hover:text-on-dark">Contact</Link></li>
              <li><Link href="#" className="hover:text-on-dark">Privacy</Link></li>
              <li><Link href="#" className="hover:text-on-dark">Terms</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-body">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
