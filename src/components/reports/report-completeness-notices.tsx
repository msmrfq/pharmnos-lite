import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  EXCLUSION_REASONS,
  EXCLUSION_REASON_LABELS,
  QUALIFIED_BANNER_TITLE,
  type ExclusionReason,
} from "@/domain/services/financial-report-completeness";

export function ReportUnavailableNotice({
  title,
  reason,
  qualifiedHref,
}: {
  title: string;
  reason: string;
  qualifiedHref?: string | null;
}) {
  return (
    <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
      <div>
        <strong className="font-semibold">{title}</strong>
        <span className="ml-1">{reason}</span>
        {qualifiedHref ? (
          <p className="mt-2">
            <Link href={qualifiedHref} className="font-medium underline">
              View qualified (exploratory, incomplete) report
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function QualifiedReportBanner({
  excludedLabel,
  excludedCount,
  amounts,
  byReason,
  completeHref,
  note,
}: {
  excludedLabel: string;
  excludedCount: number;
  amounts: { label: string; value: string }[];
  byReason: Record<ExclusionReason, number>;
  completeHref: string;
  note?: string;
}) {
  return (
    <div role="alert" data-report-mode="qualified" className="mb-4 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
        <div className="space-y-1">
          <p className="font-bold uppercase tracking-wide">{QUALIFIED_BANNER_TITLE}</p>
          <p>
            Only {excludedLabel} with a trusted effective date are shown. Excluded {excludedLabel} are not assigned to any period.
            {note ? ` ${note}` : ""}
          </p>
          <p data-testid="qualified-exclusions">
            <strong>Excluded {excludedLabel}: {excludedCount}</strong>
            {amounts.map((item) => ` · ${item.label}: ${item.value}`)}
          </p>
          {EXCLUSION_REASONS.some((reason) => byReason[reason] > 0) ? (
            <p>
              By reason:{" "}
              {EXCLUSION_REASONS.filter((reason) => byReason[reason] > 0)
                .map((reason) => `${byReason[reason]} ${EXCLUSION_REASON_LABELS[reason]}`).join(", ")}
            </p>
          ) : null}
          <p>
            <Link href={completeHref} className="font-medium underline">
              Back to the complete report
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
