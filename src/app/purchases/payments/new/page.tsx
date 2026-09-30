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
import PurchasePaymentNewClientForm from "./_form";

export const metadata: Metadata = {
  title: "Record supplier payment",
};

export default async function NewPurchasePaymentPage({
  searchParams,
}: {
  searchParams?: { supplier_id?: string };
}) {
  const prefillSupplierId = searchParams?.supplier_id ?? "";
  let dbOk = isPostgresConfigured();
  let suppliers: any[] = [];

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      const res = await repos.suppliers.list(
        { skip: 0, take: 25000, orderBy: { business_name: "asc" } },
        ctx,
      );
      suppliers = (res.items as any[]) ?? [];
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
            <CardTitle className="text-display-sm tracking-brand">Record supplier payment</CardTitle>
            <CardDescription>
              Record a payment made to a supplier against their outstanding payable balance.
            </CardDescription>
            {!dbOk && (
              <p className="mt-2 text-caption text-destructive">
                Database is not configured — showing empty form.
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <PurchasePaymentNewClientForm
        suppliers={suppliers}
        prefillSupplierId={prefillSupplierId}
      />
    </DashboardLayout>
  );
}
