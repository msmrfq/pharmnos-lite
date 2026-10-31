"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { CardCanvas, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveGstRateRuleFromForm,
  approveHsnSacClassificationFromForm,
  createGstRateRuleFromForm,
  createHsnSacCatalogRecordFromForm,
} from "@/app/_actions/gst-catalog.actions";

type CatalogRecord = {
  id: string;
  code: string;
  description: string | null;
  classification_status: string;
  rate_approval_status: string;
  is_active: boolean;
};

type RateRule = {
  id: string;
  hsn_sac_catalog_id: string | null;
  rule_version: string;
  tax_rate: number | null;
  component_policy: string;
  approval_status: string;
  is_active: boolean;
};

function ActionButton({ label }: { label: string }) {
  return <Button type="submit" size="sm">{label}</Button>;
}

function ActionForm({
  action,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  const [message, formAction] = useFormState(async (_: string, formData: FormData) => {
    try {
      await action(formData);
      return "Saved.";
    } catch (error) {
      return error instanceof Error ? error.message : "The request could not be completed.";
    }
  }, "");
  return (
    <form action={formAction} className="space-y-3">
      {children}
      {message ? <p className="text-caption text-body">{message}</p> : null}
    </form>
  );
}

export default function GstCatalogPanel({
  catalog,
  rules,
}: {
  catalog: CatalogRecord[];
  rules: RateRule[];
}) {
  return (
    <CardCanvas className="mt-6">
      <CardHeader>
        <CardTitle className="text-title-md">HSN/SAC and GST rate governance</CardTitle>
        <p className="text-body-sm text-body">
          New records stay inactive and pending until separately approved with source evidence.
        </p>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-3">
        <ActionForm action={createHsnSacCatalogRecordFromForm}>
          <div className="space-y-2">
            <Label htmlFor="catalog-code">HSN/SAC code</Label>
            <Input id="catalog-code" name="code" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-description">Description</Label>
            <Input id="catalog-description" name="description" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-type">Classification type</Label>
            <Input id="catalog-type" name="classification_type" placeholder="Product or service" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-source">Source reference</Label>
            <Input id="catalog-source" name="source_reference" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="effective_from" type="date" aria-label="Classification effective from" />
            <Input name="effective_to" type="date" aria-label="Classification effective to" />
          </div>
          <ActionButton label="Create pending classification" />
        </ActionForm>

        <div className="space-y-3">
          <p className="text-nav-link font-semibold text-ink">Classification approvals</p>
          {catalog.length === 0 ? <p className="text-body-sm text-body">No catalog records.</p> : null}
          {catalog.map((record) => (
            <div key={record.id} className="rounded-md border border-hairline p-3">
              <p className="font-medium text-ink">{record.code}</p>
              <p className="text-caption text-body">{record.description ?? "No description"}</p>
              <p className="text-caption text-muted">
                Classification: {record.classification_status} · Rate: {record.rate_approval_status}
              </p>
              {record.classification_status === "PENDING" ? (
                <ActionForm action={approveHsnSacClassificationFromForm}>
                  <input type="hidden" name="catalog_id" value={record.id} />
                  <Input name="source_reference" placeholder="Approval source reference" required />
                  <ActionButton label="Approve classification" />
                </ActionForm>
              ) : null}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-nav-link font-semibold text-ink">GST rate rules</p>
          <ActionForm action={createGstRateRuleFromForm}>
            <select name="hsn_sac_catalog_id" className="h-10 w-full rounded-md border border-hairline bg-white px-3 text-sm">
              <option value="">All classifications</option>
              {catalog.map((record) => <option key={record.id} value={record.id}>{record.code}</option>)}
            </select>
            <Input name="rule_version" placeholder="Rule version" required />
            <Input name="tax_rate" type="number" step="0.0001" min="0" placeholder="Tax rate %" required />
            <Input name="component_policy" placeholder="CGST_SGST or IGST" required />
            <Input name="source_reference" placeholder="Source reference" />
            <Input name="effective_from" type="date" aria-label="Rule effective from" required />
            <Input name="effective_to" type="date" aria-label="Rule effective to" />
            <ActionButton label="Create pending rate rule" />
          </ActionForm>
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-md border border-hairline p-3">
              <p className="font-medium text-ink">
                {rule.tax_rate ?? "Unset"}% · {rule.rule_version}
              </p>
              <p className="text-caption text-body">
                {rule.component_policy} · {rule.approval_status}
              </p>
              {rule.approval_status === "PENDING" ? (
                <ActionForm action={approveGstRateRuleFromForm}>
                  <input type="hidden" name="rule_id" value={rule.id} />
                  <Input name="source_reference" placeholder="Approval source reference" required />
                  <ActionButton label="Approve GST rate" />
                </ActionForm>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </CardCanvas>
  );
}
