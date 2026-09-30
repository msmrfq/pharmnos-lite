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
import { getCustomerForEdit } from "@/app/_actions/masters.actions";
import CustomerEditForm from "./_form";

export const metadata: Metadata = {
  title: "Edit customer",
};

export default async function EditCustomerPage({
  params,
}: {
  params: { customerId: string };
}) {
  let customer: any = null;
  try {
    customer = await getCustomerForEdit(params.customerId);
  } catch (_e) {
    customer = null;
  }

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/customers" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle className="text-display-sm tracking-brand">Edit customer</CardTitle>
            <CardDescription>
              Update customer master and credit profile. Opening balance adjustments handled via Payments (Phase 5).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {!customer ? (
        <CardCanvas>
          <CardContent className="py-10 text-center">
            <p className="text-body-md text-destructive">Customer not found or you do not have access.</p>
            <div className="mt-4">
              <Button asChild variant="secondary">
                <Link href="/customers">Back to customers</Link>
              </Button>
            </div>
          </CardContent>
        </CardCanvas>
      ) : (
        <CustomerEditForm customerId={params.customerId} existing={customer as any} />
      )}
    </DashboardLayout>
  );
}
