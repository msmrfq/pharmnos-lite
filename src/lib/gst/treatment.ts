export const GST_TREATMENT_LABELS = [
  "Registered Business – Regular",
  "Registered Business – Composition",
  "Unregistered Business",
  "Consumer",
  "Overseas",
  "Special Economic Zone",
  "Deemed Export",
  "UIN Holders",
] as const;

export type GstTreatmentLabel = (typeof GST_TREATMENT_LABELS)[number];
export type GstTaxMode = "EXCLUSIVE" | "INCLUSIVE";

export const GST_TREATMENT_VALUES = {
  REGULAR: GST_TREATMENT_LABELS[0],
  COMPOSITION: GST_TREATMENT_LABELS[1],
  UNREGISTERED: GST_TREATMENT_LABELS[2],
  CONSUMER: GST_TREATMENT_LABELS[3],
  OVERSEAS: GST_TREATMENT_LABELS[4],
  SEZ: GST_TREATMENT_LABELS[5],
  DEEMED_EXPORT: GST_TREATMENT_LABELS[6],
  UIN: GST_TREATMENT_LABELS[7],
} as const;

const SUPPORTED_TREATMENTS = new Set<GstTreatmentLabel>([
  GST_TREATMENT_VALUES.REGULAR,
]);

export function isGstTreatmentLabel(value: unknown): value is GstTreatmentLabel {
  return typeof value === "string" &&
    (GST_TREATMENT_LABELS as readonly string[]).includes(value);
}

export function validateGstTreatment(value: unknown): {
  ok: boolean;
  treatment?: GstTreatmentLabel;
  error?: string;
} {
  if (!isGstTreatmentLabel(value)) {
    return { ok: false, error: "Select a valid GST treatment." };
  }
  if (!SUPPORTED_TREATMENTS.has(value)) {
    return {
      ok: false,
      error: `${value} is visible for classification but is not enabled for this workflow yet.`,
    };
  }
  return { ok: true, treatment: value };
}

export function isSupportedGstTreatment(value: unknown): value is GstTreatmentLabel {
  return isGstTreatmentLabel(value) && SUPPORTED_TREATMENTS.has(value);
}
