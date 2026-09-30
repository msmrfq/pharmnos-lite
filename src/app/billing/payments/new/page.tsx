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
import BillingPaymentNewClientForm from "./_form";

export const metadata: Metadata = {
  title: "Record customer payment",
};

export default async function NewBillingPaymentPage({
  searchParams,
}: {
  searchParams?: { customer_id?: string };
}) {
  const prefillCustomerId = searchParams?.customer_id ?? "";
  let dbOk = isPostgresConfigured();
  let customers: any[] = [];

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      const res = await repos.customers.list(
        { skip: 0, take: 25000, orderBy: { business_name: "asc" } },
        ctx,
      );
      customers = (res.items as any[]) ?? [];
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
            <CardTitle className="text-display-sm tracking-brand">Record payment received</CardTitle>
            <CardDescription>
              Record a customer payment against their outstanding balance. Dues are automatically reduced; overpayments are clamped to 0.
            </CardDescription>
            {!dbOk && (
              <p className="mt-2 text-caption text-destructive">
                Database is not configured — showing empty form.
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <BillingPaymentNewClientForm
        customers={customers}
        prefillCustomerId={prefillCustomerId}
      />
    </DashboardLayout>
  );
}
