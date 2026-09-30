import Link from "next/link";
import type { Metadata } from "next";
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
import PurchasesNewClientForm from "./_form";

export const metadata: Metadata = {
  title: "New purchase",
};

export default async function NewPurchasePage() {
  let dbOk = isPostgresConfigured();
  let suppliers: any[] = [];
  let products: any[] = [];

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      const [supRes, prodRes] = await Promise.all([
        repos.suppliers.list({ skip: 0, take: 25000, orderBy: { business_name: "asc" } }, ctx),
        repos.products.list({ skip: 0, take: 25000, orderBy: { name: "asc" } }, ctx),
      ]);
      suppliers = (supRes.items as any[]) ?? [];
      products = (prodRes.items as any[]) ?? [];
    } catch (_err) {
      dbOk = false;
    }
  }

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/purchases" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle className="text-display-sm tracking-brand">New purchase entry</CardTitle>
            <CardDescription>
              Record stock received from a supplier. Batches are created when you confirm inward (finalize).
            </CardDescription>
            {!dbOk && (
              <p className="mt-2 text-caption text-destructive">
                Database is not configured — showing empty form.
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <PurchasesNewClientForm suppliers={suppliers} products={products} />
    </DashboardLayout>
  );
}
