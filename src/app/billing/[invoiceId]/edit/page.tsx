import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CardCanvas, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import { PrintToolbar } from "@/components/print/print-toolbar";

export const metadata: Metadata = {
  title: "Edit invoice",
};

export default async function BillingInvoiceEditPage({
  params,
}: {
  params: { invoiceId: string };
}) {
  let dbOk = isPostgresConfigured();
  let invoice: any = null;
  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      invoice = await repos.salesInvoices.getById(params.invoiceId, ctx);
    } catch {
      dbOk = false;
    }
  }
  if (invoice && invoice.status === "DRAFT") {
    redirect(`/billing/new?draft=${encodeURIComponent(params.invoiceId)}`);
  }
  return (
    <DashboardLayout>
      <PrintToolbar
        backHref={`/billing/${encodeURIComponent(params.invoiceId)}`}
        backLabel="Back to invoice"
        title={`Edit invoice ${invoice?.invoice_no ?? params.invoiceId.slice(0, 8)}`}
      />
      <CardCanvas>
        <CardContent className="py-10 space-y-4">
          <h2 className="font-display text-display-sm text-ink">Invoice editing</h2>
          <p className="text-body-md text-body">
            {invoice?.status === "FINALIZED"
              ? "Finalized invoices are immutable. To correct, cancel this invoice in billing list and create a new one."
              : invoice?.status === "CANCELLED"
                ? "Cancelled invoices cannot be edited. Create a new invoice."
                : "Drafts can be modified by updating the row in the billing list or cancel & recreate."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link href="/billing">Open billing list</Link>
            </Button>
            {invoice && (
              <Button asChild>
                <Link href={`/billing/${encodeURIComponent(params.invoiceId)}`}>View invoice</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </CardCanvas>
    </DashboardLayout>
  );
}
