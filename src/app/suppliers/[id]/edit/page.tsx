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
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupplierForEdit } from "@/app/_actions/masters.actions";
import SupplierEditForm from "./_form";

export const metadata: Metadata = {
  title: "Edit supplier",
};

export default async function EditSupplierPage({
  params,
}: {
  params: { id: string };
}) {
  let supplier: any = null;
  try {
    supplier = await getSupplierForEdit(params.id);
  } catch (_e) {
    supplier = null;
  }

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/suppliers" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle className="text-display-sm tracking-brand">Edit supplier</CardTitle>
            <CardDescription>
              Update supplier master and contact details. Opening balance adjustments via Payments (Phase 5).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {!supplier ? (
        <CardCanvas>
          <CardContent className="py-10 text-center">
            <p className="text-body-md text-destructive">Supplier not found or you do not have access.</p>
            <div className="mt-4">
              <Button asChild variant="secondary">
                <Link href="/suppliers">Back to suppliers</Link>
              </Button>
            </div>
          </CardContent>
        </CardCanvas>
      ) : (
        <SupplierEditForm supplierId={params.id} existing={supplier as any} />
      )}
    </DashboardLayout>
  );
}
