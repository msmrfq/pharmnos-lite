export type GstRuleApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type GstRuleRecord = {
  id: string;
  rule_version: string;
  tax_rate: number | null;
  component_policy: string;
  approval_status: GstRuleApprovalStatus;
  source_reference: string | null;
  effective_from: Date;
  effective_to: Date | null;
  is_active: boolean;
  hsn_sac_catalog_id?: string | null;
};

export type GstClassificationRecord = {
  id: string;
  code: string;
  classification_status: GstRuleApprovalStatus;
  effective_from: Date | null;
  effective_to: Date | null;
  is_active: boolean;
  source_reference: string | null;
};

export function isApprovedGstClassification(
  classification: GstClassificationRecord | null | undefined,
  effectiveAt: Date,
): boolean {
  return Boolean(
    classification &&
    classification.is_active &&
    classification.classification_status === "APPROVED" &&
    classification.source_reference?.trim() &&
    (!classification.effective_from || classification.effective_from <= effectiveAt) &&
    (!classification.effective_to || classification.effective_to > effectiveAt),
  );
}

export type GstRuleResolution =
  | { ok: true; rule: GstRuleRecord }
  | { ok: false; error: string };

export function resolveApprovedGstRule(
  rules: readonly GstRuleRecord[],
  effectiveAt: Date,
  hsnSacCatalogId?: string | null,
): GstRuleResolution {
  const candidates = rules.filter((rule) =>
    rule.is_active &&
    rule.approval_status === "APPROVED" &&
    rule.source_reference?.trim() &&
    rule.effective_from <= effectiveAt &&
    (!rule.effective_to || rule.effective_to > effectiveAt) &&
    (hsnSacCatalogId === undefined || rule.hsn_sac_catalog_id === hsnSacCatalogId),
  );
  if (candidates.length === 0) {
    return { ok: false, error: "No approved GST rule is effective for this transaction." };
  }
  if (candidates.length > 1) {
    return { ok: false, error: "Multiple approved GST rules are effective for this transaction." };
  }
  const [rule] = candidates;
  if (!rule) {
    return { ok: false, error: "No approved GST rule is effective for this transaction." };
  }
  return { ok: true, rule };
}
