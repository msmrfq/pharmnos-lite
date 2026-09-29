import Link from "next/link";
import {
  Pill,
  Receipt,
  Warehouse,
  PackagePlus,
  Users,
  ShieldCheck,
  ArrowRight,
  Check,
} from "lucide-react";
import MarketingLayout from "@/components/layout/marketing-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardCanvas,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge as B } from "@/components/ui/badge";

const features = [
  {
    icon: Receipt,
    title: "Billing that just works",
    description:
      "GST-ready sales invoices with FEFO batch suggestions, multiple payment modes, and rapid keyboard-first data entry.",
  },
  {
    icon: Warehouse,
    title: "Batch & expiry control",
    description:
      "Track inventory at product-plus-batch level. Near-expiry alerts and blocked batches protect your customers and your margin.",
  },
  {
    icon: PackagePlus,
    title: "Purchase entry with inward stock",
    description:
      "Supplier purchase entries create batches and stock movements automatically. No double work.",
  },
  {
    icon: Users,
    title: "Customer & supplier ledgers",
    description:
      "Receivables and payables at a glance. Aging summaries and drill-down ledgers for every account.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access & audit",
    description:
      "Admin, Billing, Inventory, and Manager roles. Every cancellation, adjustment, and price change is logged.",
  },
  {
    icon: Pill,
    title: "Pharmacy-safe defaults",
    description:
      "Schedule classifications, GST rates, drug-license fields, and drug-license capture are built in.",
  },
];

const pricing = [
  {
    name: "Starter",
    price: "₹0",
    period: "forever",
    description: "For single-store pharmacies getting started.",
    features: [
      "Up to 1 business workspace",
      "Unlimited products & customers",
      "5 staff users included",
      "500 invoices / month",
      "Email support",
    ],
    featured: false,
  },
  {
    name: "Growth",
    price: "₹1,499",
    period: "/month",
    description: "Most popular for growing wholesale distributors.",
    features: [
      "Everything in Starter",
      "Unlimited invoices",
      "Unlimited staff users",
      "Printable GST invoices",
      "CSV imports & exports",
      "Priority support",
    ],
    featured: true,
  },
];

export default function HomePage() {
  return (
    <MarketingLayout>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="container-editorial py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_1fr] items-center">
          <div className="space-y-8">
            <Badge variant="secondary" className="gap-2 py-1.5">
              <Pill className="h-3.5 w-3.5" />
              Built for Indian pharmacy wholesalers
            </Badge>
            <div className="space-y-6">
              <h1 className="font-display tracking-tight text-display-md leading-[1.15] sm:text-display-lg lg:text-display-xl text-ink">
                Your pharmacy wholesale.
                <br />
                <span className="text-muted font-normal">Simply, on every device.</span>
              </h1>
              <p className="text-body-md text-body max-w-xl">
                Pharmnos Lite replaces the daily essentials of a heavy ERP with a calm,
                browser-based system for billing, batch inventory, expiry control,
                purchases, ledgers, and the business visibility that actually gets used.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" asChild>
                <Link href="/auth/sign-up">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/auth/sign-in">Sign in to workspace</Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-caption text-muted">
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-semantic-success" /> GST-ready
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-semantic-success" /> Batch + expiry
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-semantic-success" /> Mobile & desktop
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-semantic-success" /> Audit log
              </li>
            </ul>
          </div>

          {/* Product mockup card */}
          <CardCanvas className="p-0 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            {/* Fake app chrome */}
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary">
                  <Pill className="h-3 w-3 text-on-primary" />
                </span>
                <span className="text-nav-link font-semibold text-ink">
                  New Invoice · INV-00182
                </span>
              </div>
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-hairline" />
                <span className="h-2 w-2 rounded-full bg-hairline" />
                <span className="h-2 w-2 rounded-full bg-hairline" />
              </div>
            </div>
            <div className="p-5 space-y-4">
              {/* Customer row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-caption text-muted">Customer</p>
                  <p className="text-title-sm font-semibold text-ink">
                    MedPlus Pharmacy · MP-042
                  </p>
                </div>
                <B variant="badge-orange">Credit</B>
              </div>
              {/* Invoice lines */}
              <div className="rounded-lg border border-hairline overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-9">Product</TableHead>
                      <TableHead className="h-9 text-right">Qty</TableHead>
                      <TableHead className="h-9 text-right">Rate</TableHead>
                      <TableHead className="h-9 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <div>
                          <p className="text-body font-medium text-ink">
                            Paracetamol 500mg
                          </p>
                          <p className="text-caption text-muted flex items-center gap-1.5">
                            Batch PX-2408 · <B variant="badge-emerald">Exp Mar 2027</B>
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">20 × 10</TableCell>
                      <TableCell className="text-right">₹28.50</TableCell>
                      <TableCell className="text-right font-medium text-ink">₹5,700.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div>
                          <p className="text-body font-medium text-ink">
                            Amoxicillin 250mg
                          </p>
                          <p className="text-caption text-muted flex items-center gap-1.5">
                            Batch AM-2405 · <B variant="warning">Exp Sep 2026</B>
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">10 × 10</TableCell>
                      <TableCell className="text-right">₹142.00</TableCell>
                      <TableCell className="text-right font-medium text-ink">₹14,200.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div>
                          <p className="text-body font-medium text-ink">
                            Montelukast 10mg
                          </p>
                          <p className="text-caption text-muted flex items-center gap-1.5">
                            Batch MK-2409 · <B variant="badge-emerald">Exp Nov 2027</B>
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">15 × 15</TableCell>
                      <TableCell className="text-right">₹74.80</TableCell>
                      <TableCell className="text-right font-medium text-ink">₹16,830.00</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {/* Totals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface-card p-4">
                  <p className="text-caption text-muted">GST</p>
                  <p className="text-title-md font-semibold text-ink">₹3,305.70</p>
                </div>
                <div className="rounded-lg bg-primary p-4 text-on-primary">
                  <p className="text-caption opacity-80">Net Total</p>
                  <p className="text-title-md font-semibold">₹40,035.70</p>
                </div>
              </div>
            </div>
          </CardCanvas>
        </div>
      </section>

      {/* ── Nav pill group + feature tabs ──────────────────────────────── */}
      <section id="features" className="container-editorial py-24">
        <div className="mx-auto max-w-2xl text-center space-y-4 mb-14">
          <h2 className="font-display tracking-tight text-display-sm md:text-display-md text-ink">
            Replace daily ERP friction in weeks, not quarters
          </h2>
          <p className="text-body-md text-body">
            Every module is designed to be immediately useful. Operators start billing on
            day one; owners see risk and cash positions the same evening.
          </p>
        </div>

        <Tabs defaultValue="billing" className="w-full">
          <div className="flex justify-center mb-10">
            <TabsList>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
              <TabsTrigger value="ledgers">Ledgers</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="billing" className="mt-0">
            <div className="grid gap-8 lg:grid-cols-2 items-start">
              <div className="space-y-5">
                <h3 className="text-title-lg font-semibold text-ink">
                  Fast, pharmacy-aware billing
                </h3>
                <p className="text-body-md text-body">
                  The billing screen is built for speed. Search by brand, generic, or
                  short code. Batches are suggested by earliest expiry first (FEFO) and
                  blocked batches are excluded automatically.
                </p>
                <ul className="space-y-3 text-body-md text-body">
                  {[
                    "FEFO batch suggestions with expiry-aware badges",
                    "GST 5/12/18/28% with per-line override",
                    "Cash, Card, UPI, Credit, and Mixed payment capture",
                    "Cancellation with permission gating and audit log",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-card">
                        <Check className="h-3 w-3 text-ink" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <CardCanvas className="p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-nav-link font-semibold text-ink">Product search</p>
                  <B variant="badge-emerald">FEFO</B>
                </div>
                <div className="rounded-md bg-surface-soft p-2 mb-4 flex items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-canvas text-caption text-muted border border-hairline">
                    Para
                  </span>
                  <span className="px-2 py-1 rounded-md text-caption text-muted">
                    Amox →
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    {
                      name: "Paracetamol 500mg · Ipca",
                      badge: "Available 480",
                      variant: "badge-emerald" as const,
                    },
                    {
                      name: "Paracetamol + Caffeine · Cipla",
                      badge: "Low stock 42",
                      variant: "warning" as const,
                    },
                    {
                      name: "Paracetamol 650mg · Micro",
                      badge: "1 near expiry",
                      variant: "badge-orange" as const,
                    },
                  ].map((row, i) => (
                    <div
                      key={row.name}
                      className={
                        "flex items-center justify-between rounded-md px-3 py-2.5 " +
                        (i === 0 ? "bg-surface-soft ring-1 ring-ink/10" : "")
                      }
                    >
                      <span className="text-body text-ink">{row.name}</span>
                      <B variant={row.variant}>{row.badge}</B>
                    </div>
                  ))}
                </div>
              </CardCanvas>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="mt-0">
            <div className="grid gap-8 lg:grid-cols-2 items-start">
              <div className="space-y-5">
                <h3 className="text-title-lg font-semibold text-ink">
                  Batch-wise inventory, with protections
                </h3>
                <p className="text-body-md text-body">
                  Stock is tracked at product-plus-batch level. Batch number, expiry,
                  MRP, and purchase rate are captured at inward and preserved through
                  every stock movement.
                </p>
                <ul className="space-y-3 text-body-md text-body">
                  {[
                    "Immutable stock movements for audit integrity",
                    "Expired batches are auto-blocked from billing",
                    "Low-stock & near-expiry queues with configurable thresholds",
                    "Adjustments with reason codes and actor log",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-card">
                        <Check className="h-3 w-3 text-ink" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <CardCanvas className="p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-nav-link font-semibold text-ink">Low stock queue</p>
                  <B variant="badge-orange">12 items</B>
                </div>
                <div className="divide-y divide-hairline">
                  {[
                    ["Cetirizine 10mg", "21", "reorder 100", "warning" as const],
                    ["Omeprazole 20mg", "8", "reorder 50", "badge-orange" as const],
                    ["Multivitamin gold", "3", "below reorder", "destructive" as const],
                  ].map(([name, qty, note, variant]) => (
                    <div key={name} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body font-medium text-ink truncate">{name}</p>
                        <p className="text-caption text-muted">{note}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-body font-semibold text-ink">{qty}</span>
                        <B variant={variant as "warning" | "badge-orange" | "destructive"}>Create PO</B>
                      </div>
                    </div>
                  ))}
                </div>
              </CardCanvas>
            </div>
          </TabsContent>

          <TabsContent value="purchases" className="mt-0">
            <div className="grid gap-8 lg:grid-cols-2 items-start">
              <div className="space-y-5">
                <h3 className="text-title-lg font-semibold text-ink">
                  Purchase entry creates stock, not paperwork
                </h3>
                <p className="text-body-md text-body">
                  When a supplier invoice is entered, batch records and inward stock
                  movements are created in a single transaction. Nothing lives in two
                  places.
                </p>
                <ul className="space-y-3 text-body-md text-body">
                  {[
                    "Batch + expiry + MRP + rate captured at purchase line",
                    "Draft & finalized states with supplier invoice numbers",
                    "Automatic supplier payable ledger postings",
                    "Purchase prefix and numbering per tenant",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-card">
                        <Check className="h-3 w-3 text-ink" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <CardCanvas className="p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-nav-link font-semibold text-ink">Purchase entry</p>
                  <B variant="success">Draft</B>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-surface-card p-3">
                      <p className="text-caption text-muted mb-1">Supplier</p>
                      <p className="text-body font-medium text-ink">Alembic Distributors</p>
                    </div>
                    <div className="rounded-md bg-surface-card p-3">
                      <p className="text-caption text-muted mb-1">Supplier Inv #</p>
                      <p className="text-body font-medium text-ink">ALB/26/20184</p>
                    </div>
                  </div>
                  <div className="rounded-md border border-hairline p-3 space-y-2">
                    <div className="flex justify-between text-caption text-muted">
                      <span>5 lines</span>
                      <span>GST ₹ 2,810</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-caption text-muted">Net payable</p>
                      <p className="text-title-md font-semibold text-ink">₹ 18,432</p>
                    </div>
                  </div>
                </div>
              </CardCanvas>
            </div>
          </TabsContent>

          <TabsContent value="ledgers" className="mt-0">
            <div className="grid gap-8 lg:grid-cols-2 items-start">
              <div className="space-y-5">
                <h3 className="text-title-lg font-semibold text-ink">
                  Receivables and payables, always live
                </h3>
                <p className="text-body-md text-body">
                  Every finalized invoice and payment updates customer & supplier
                  balances atomically — the same transaction that writes the document
                  updates the ledger.
                </p>
                <ul className="space-y-3 text-body-md text-body">
                  {[
                    "Customer aging: 0-30 / 31-60 / 61-90 / 90+ day buckets",
                    "Supplier aging with credit limit monitoring",
                    "Click-through drill down to invoice lines",
                    "Statement-style ledger by date range",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-card">
                        <Check className="h-3 w-3 text-ink" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <CardCanvas className="p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-nav-link font-semibold text-ink">Aging · Receivables</p>
                  <B variant="destructive">2 over-limit</B>
                </div>
                <div className="space-y-3">
                  {[
                    ["MedPlus Pharmacy", "₹ 42,800", "0-30", "success" as const],
                    ["Franklin Medico", "₹ 18,450", "31-60", "warning" as const],
                    ["Sharda Agencies", "₹ 9,820", "90+", "destructive" as const],
                  ].map(([name, amt, bucket, variant]) => (
                    <div key={name} className="rounded-md border border-hairline p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-body font-medium text-ink">{name}</span>
                        <B variant={variant as "success" | "warning" | "destructive"}>{bucket}</B>
                      </div>
                      <p className="text-title-sm font-semibold text-ink">{amt}</p>
                    </div>
                  ))}
                </div>
              </CardCanvas>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* ── Feature card grid ──────────────────────────────────────────── */}
      <section id="how" className="container-editorial py-24">
        <div className="mx-auto max-w-2xl text-center space-y-4 mb-14">
          <h2 className="font-display tracking-tight text-display-sm md:text-display-md text-ink">
            One system for the daily essentials
          </h2>
          <p className="text-body-md text-body">
            Modules share a single data foundation — product, batches, customers, and
            suppliers are entered once and reused everywhere.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title}>
                <CardHeader>
                  <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-canvas border border-hairline text-ink">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <CardTitle>{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-body text-body leading-relaxed">
                    {f.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section id="pricing" className="container-editorial py-24">
        <div className="mx-auto max-w-2xl text-center space-y-4 mb-14">
          <h2 className="font-display tracking-tight text-display-sm md:text-display-md text-ink">
            Pricing that stays friendly until you scale
          </h2>
          <p className="text-body-md text-body">
            Start forever-free. Upgrade only when the workload and staff deserve it.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {pricing.map((p) => (
            <div
              key={p.name}
              className={
                "rounded-xl p-8 " +
                (p.featured
                  ? "bg-surface-dark text-on-dark shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
                  : "bg-canvas border border-hairline text-ink")
              }
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-title-lg font-semibold">{p.name}</h3>
                  <p
                    className={
                      "text-body-sm mt-1 " +
                      (p.featured ? "text-on-dark-soft" : "text-muted")
                    }
                  >
                    {p.description}
                  </p>
                </div>
                {p.featured && <B variant="info">Most popular</B>}
              </div>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="font-display text-display-sm tracking-tight">{p.price}</span>
                <span className={p.featured ? "text-on-dark-soft" : "text-muted"}>
                  {p.period}
                </span>
              </div>
              <ul className="space-y-3 mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check
                      className={
                        "mt-0.5 h-4 w-4 shrink-0 " +
                        (p.featured ? "text-on-dark" : "text-semantic-success")
                      }
                    />
                    <span className="text-body-sm">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className={"w-full " + (p.featured ? "bg-canvas text-ink hover:bg-surface-soft" : "")}
                variant={p.featured ? "secondary" : "default"}
                asChild
              >
                <Link href="/auth/sign-up">Get started</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA band ───────────────────────────────────────────────────── */}
      <section className="container-editorial pb-28">
        <div className="rounded-xl bg-surface-card px-8 py-16 text-center md:p-20">
          <h2 className="font-display tracking-tight text-display-sm md:text-display-md text-ink max-w-2xl mx-auto">
            Stop paying for ERP modules you never open.
          </h2>
          <p className="mt-5 text-body-md text-body max-w-xl mx-auto">
            One link, one workspace. Your pharmacy team can be billing the same afternoon
            you sign up.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link href="/auth/sign-up">
                Create your free workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/contact">Talk to sales</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
