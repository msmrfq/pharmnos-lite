import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import BillingNewClientForm from "./_form";

export const metadata: Metadata = {
  title: "New invoice",
};

export default async function NewBillingPage() {
  let dbOk = isPostgresConfigured();
  let customers: any[] = [];
  let products: any[] = [];
  let batches: any[] = [];

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      const [custRes, prodRes, batchRes] = await Promise.all([
        repos.customers.list({ skip: 0, take: 25000, orderBy: { business_name: "asc" } }, ctx),
        repos.products.list({ skip: 0, take: 25000, orderBy: { name: "asc" } }, ctx),
        repos.productBatches.list({ skip: 0, take: 25000, orderBy: { expiry_date: "asc" } }, ctx),
      ]);
      customers = (custRes.items as any[]) ?? [];
      products = (prodRes.items as any[]) ?? [];
      batches = (batchRes.items as any[]) ?? [];
    } catch (_err) {
      dbOk = false;
    }
  }

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/billing" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle className="text-display-sm tracking-brand">New invoice</CardTitle>
            <CardDescription>
              Select a customer, add items by batch (FEFO picker), and save draft. Finalize from the billing list when ready.
            </CardDescription>
            {!dbOk && (
              <p className="mt-2 text-caption text-destructive">
                Database is not configured — showing empty form.
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <Suspense fallback={null}>
        <BillingNewClientForm customers={customers} products={products} batches={batches} />
      </Suspense>
    </DashboardLayout>
  );
}
