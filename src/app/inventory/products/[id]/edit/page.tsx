import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  CardCanvas,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, FileSpreadsheet, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProductForEdit, updateProductAction } from "@/app/_actions/masters.actions";
import ProductEditForm from "./_form";
import { repos } from "@/repositories";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";

export const metadata: Metadata = {
  title: "Edit product",
};

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  let product: any = null;
  let batches: any[] = [];
  try {
    product = await getProductForEdit(params.id);
  } catch (_e) {
    product = null;
  }
  let dbOk = isPostgresConfigured() && product !== null;
  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      batches = await repos.productBatches.listForProduct(params.id, ctx, true);
    } catch (_e) {
      batches = [];
    }
  }

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/inventory" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle className="text-display-sm tracking-brand">Edit product</CardTitle>
            <CardDescription>
              Update product master details. Batch stock and expiry adjusted via purchases and adjustments.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {!product ? (
        <CardCanvas>
          <CardContent className="py-10 text-center">
            <p className="text-body-md text-destructive">Product not found or you do not have access.</p>
            <div className="mt-4">
              <Button asChild variant="secondary">
                <Link href="/inventory">Back to inventory</Link>
              </Button>
            </div>
          </CardContent>
        </CardCanvas>
      ) : (
        <ProductEditForm productId={params.id} existing={product as any} batches={batches} />
      )}
    </DashboardLayout>
  );
}
