import { parseBusinessDate as parseBusinessDateStrict } from "@/lib/utils/business-date";

export const FINANCIAL_TEMPORAL_CLASSIFICATION_RULE_VERSION = "financial-temporal-evidence/1";

export type RecordingGuarantee = "application-accepted" | "transaction-time" | "commit-visible";

export type TemporalEvidence<T> = {
  value: T;
  evidenceRef: string;
  tenantId: string;
  sourceId: string;
  eventId: string;
  producerVersion: string;
  producerVerified: boolean;
  immutable: boolean;
  attestationRef: string;
  attestationVerified: boolean;
  timezoneContractVerified?: boolean;
  guarantee?: RecordingGuarantee;
  guaranteeEvidenceRef?: string;
}

export type TemporalRecordEvidence = {
  tenantId: string;
  sourceId: string;
  eventId: string;
  businessDate?: TemporalEvidence<string>[];
  eventInstant?: TemporalEvidence<string>[];
  recordingTime?: TemporalEvidence<string>[];
};

type Classification<T> = {
  status: "classified" | "unknown" | "conflict";
  value: T | null;
  evidenceRefs: string[];
  reasonCodes: string[];
};

export type FinancialTemporalClassification = {
  ruleVersion: string;
  businessDate: Classification<string>;
  eventInstant: Classification<string>;
  recordingTime: Classification<{ instant: string; guarantee: RecordingGuarantee }>;
};

type TemporalDimension = "businessDate" | "eventInstant" | "recordingTime";

const RECORDING_GUARANTEE_RANK: Record<RecordingGuarantee, number> = {
  "application-accepted": 1,
  "transaction-time": 2,
  "commit-visible": 3,
};

function isNonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function parseBusinessDate(value: string): string | null {
  if (typeof value !== "string") return null;
  try {
    return parseBusinessDateStrict(value);
  } catch {
    return null;
  }
}

function parseZonedInstant(value: string): string | null {
  if (typeof value !== "string") return null;
  const timestampPattern =
    /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/i;
  if (!timestampPattern.test(value) || !parseBusinessDate(value.slice(0, 10))) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function isRecordingGuarantee(value: unknown): value is RecordingGuarantee {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(RECORDING_GUARANTEE_RANK, value);
}

function evidenceReasons<T>(
  record: Pick<TemporalRecordEvidence, "tenantId" | "sourceId" | "eventId">,
  evidence: TemporalEvidence<T>,
  dimension: TemporalDimension,
): string[] {
  const reasons = new Set<string>();
  if (!isNonEmpty(record.tenantId) || !isNonEmpty(record.sourceId) || !isNonEmpty(record.eventId)) {
    reasons.add("record_identity_missing");
  }
  if (
    evidence.tenantId !== record.tenantId ||
    evidence.sourceId !== record.sourceId ||
    evidence.eventId !== record.eventId
  ) {
    reasons.add("evidence_identity_mismatch");
  }
  if (!isNonEmpty(evidence.evidenceRef) || !isNonEmpty(evidence.producerVersion)) {
    reasons.add("missing_evidence_reference_or_producer_version");
  }
  if (!isNonEmpty(evidence.attestationRef) || evidence.attestationVerified !== true) {
    reasons.add("trusted_attestation_not_verified");
  }
  if (evidence.producerVerified !== true) reasons.add("producer_not_verified");
  if (evidence.immutable !== true) reasons.add("evidence_not_immutable");
  if (dimension === "eventInstant" && evidence.timezoneContractVerified !== true) {
    reasons.add("timezone_contract_not_verified");
  }
  if (
    dimension === "recordingTime" &&
    !isRecordingGuarantee(evidence.guarantee)
  ) {
    reasons.add("recording_guarantee_not_verified");
  }
  if (dimension === "recordingTime" && !isNonEmpty(evidence.guaranteeEvidenceRef)) {
    reasons.add("recording_guarantee_evidence_missing");
  }
  return [...reasons].sort();
}

function classify<T>(
  record: Pick<TemporalRecordEvidence, "tenantId" | "sourceId" | "eventId">,
  candidates: TemporalEvidence<string>[] | undefined,
  dimension: TemporalDimension,
  parse: (value: string) => string | null,
): Classification<T> {
  if (!candidates || candidates.length === 0) {
    return { status: "unknown", value: null, evidenceRefs: [], reasonCodes: ["no_evidence"] };
  }

  const parsed = candidates.map((candidate) => {
    const wellFormed = candidate !== null && typeof candidate === "object";
    return {
      candidate,
      wellFormed,
      identityMatches:
        wellFormed &&
        candidate.tenantId === record.tenantId &&
        candidate.sourceId === record.sourceId &&
        candidate.eventId === record.eventId,
      value: wellFormed ? parse(candidate.value) : null,
      reasons: wellFormed ? evidenceReasons(record, candidate, dimension) : ["evidence_identity_mismatch"],
    };
  });
  // Evidence that does not belong to this record (for example another tenant's) is never
  // accepted, never takes part in conflict detection, and its reference is never echoed.
  const owned = parsed.filter((item) => item.identityMatches);
  const hasForeignEvidence = owned.length !== parsed.length;
  const ownedRefs = [
    ...new Set(owned.map((item) => item.candidate.evidenceRef).filter(isNonEmpty)),
  ].sort();
  const candidateValues = [...new Set(owned.flatMap((item) => item.value === null ? [] : [item.value]))];
  if (candidateValues.length > 1) {
    return {
      status: "conflict",
      value: null,
      evidenceRefs: ownedRefs,
      reasonCodes: hasForeignEvidence
        ? ["conflicting_values", "evidence_identity_mismatch"]
        : ["conflicting_values"],
    };
  }

  const supported = owned.filter((item) => item.value !== null && item.reasons.length === 0);
  if (supported.length === 0 || hasForeignEvidence) {
    const reasonCodes = new Set<string>();
    for (const item of parsed) {
      for (const reason of item.reasons) reasonCodes.add(reason);
      if (item.wellFormed && item.value === null) reasonCodes.add("invalid_temporal_value");
    }
    return {
      status: "unknown",
      value: null,
      evidenceRefs: ownedRefs,
      reasonCodes: [...reasonCodes].sort(),
    };
  }

  const firstSupported = supported[0];
  if (!firstSupported || firstSupported.value === null) {
    return {
      status: "unknown",
      value: null,
      evidenceRefs: [],
      reasonCodes: ["no_supported_evidence"],
    };
  }
  const value = firstSupported.value;
  let classifiedValue: T;
  if (dimension === "recordingTime") {
    const strongest = supported
      .filter((item) => item.value === value)
      .sort((left, right) =>
        RECORDING_GUARANTEE_RANK[right.candidate.guarantee as RecordingGuarantee] -
        RECORDING_GUARANTEE_RANK[left.candidate.guarantee as RecordingGuarantee],
      )[0];
    if (!strongest) {
      return {
        status: "unknown",
        value: null,
        evidenceRefs: [],
        reasonCodes: ["no_supported_evidence"],
      };
    }
    classifiedValue = {
      instant: value,
      guarantee: strongest.candidate.guarantee as RecordingGuarantee,
    } as T;
  } else {
    classifiedValue = value as T;
  }

  return {
    status: "classified",
    value: classifiedValue,
    evidenceRefs: [...new Set(supported.map((item) => item.candidate.evidenceRef))].sort(),
    reasonCodes: [],
  };
}

/**
 * Classifies supplied evidence; it does not verify its authenticity or establish report eligibility.
 * Callers must provide independently verified, trusted attestations and must not use a classified
 * recording time for strict knowledge-as-of inclusion unless its commit-visible guarantee is
 * independently proven. A caller-provided guarantee label alone is not proof.
 */
export function classifyFinancialTemporalEvidence(
  record: TemporalRecordEvidence,
): FinancialTemporalClassification {
  return {
    ruleVersion: FINANCIAL_TEMPORAL_CLASSIFICATION_RULE_VERSION,
    businessDate: classify<string>(record, record.businessDate, "businessDate", parseBusinessDate),
    eventInstant: classify<string>(record, record.eventInstant, "eventInstant", parseZonedInstant),
    recordingTime: classify<{ instant: string; guarantee: RecordingGuarantee }>(
      record,
      record.recordingTime,
      "recordingTime",
      parseZonedInstant,
    ),
  };
}

export type FinancialTemporalAccountingRow = TemporalRecordEvidence & {
  rowId: string;
  debit: string;
  credit: string;
};

type ExactMoney = {
  rows: number;
  debit: string;
  credit: string;
  signed: string;
};

export type FinancialTemporalExceptionAccounting = {
  ruleVersion: string;
  total: ExactMoney;
  exceptions: ExactMoney;
  byDimension: Record<
    TemporalDimension,
    { classified: ExactMoney; unknown: ExactMoney; conflict: ExactMoney }
  >;
};

function parseCents(value: string): bigint {
  if (typeof value !== "string" || !/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) {
    throw new RangeError("Ledger debit and credit must be non-negative decimal amounts with at most two places.");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function formatCents(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function emptyMoney(): { rows: number; debit: bigint; credit: bigint; signed: bigint } {
  return { rows: 0, debit: 0n, credit: 0n, signed: 0n };
}

function publicMoney(value: { rows: number; debit: bigint; credit: bigint; signed: bigint }): ExactMoney {
  return {
    rows: value.rows,
    debit: formatCents(value.debit),
    credit: formatCents(value.credit),
    signed: formatCents(value.signed),
  };
}

export function accountFinancialTemporalExceptions(
  rows: FinancialTemporalAccountingRow[],
): FinancialTemporalExceptionAccounting {
  const rowIds = new Set<string>();
  const total = emptyMoney();
  const exceptions = emptyMoney();
  const byDimension = {
    businessDate: { classified: emptyMoney(), unknown: emptyMoney(), conflict: emptyMoney() },
    eventInstant: { classified: emptyMoney(), unknown: emptyMoney(), conflict: emptyMoney() },
    recordingTime: { classified: emptyMoney(), unknown: emptyMoney(), conflict: emptyMoney() },
  };

  for (const row of rows) {
    if (!isNonEmpty(row.rowId) || rowIds.has(row.rowId)) {
      throw new RangeError("Accounting rows require unique, non-empty row IDs.");
    }
    rowIds.add(row.rowId);
    const debit = parseCents(row.debit);
    const credit = parseCents(row.credit);
    const amount = { rows: 1, debit, credit, signed: debit - credit };
    total.rows += 1;
    total.debit += debit;
    total.credit += credit;
    total.signed += debit - credit;

    const classification = classifyFinancialTemporalEvidence(row);
    let hasException = false;
    for (const dimension of ["businessDate", "eventInstant", "recordingTime"] as const) {
      const result = classification[dimension];
      byDimension[dimension][result.status].rows += 1;
      byDimension[dimension][result.status].debit += debit;
      byDimension[dimension][result.status].credit += credit;
      byDimension[dimension][result.status].signed += debit - credit;
      if (result.status !== "classified") hasException = true;
    }
    if (hasException) {
      exceptions.rows += amount.rows;
      exceptions.debit += amount.debit;
      exceptions.credit += amount.credit;
      exceptions.signed += amount.signed;
    }
  }

  return {
    ruleVersion: FINANCIAL_TEMPORAL_CLASSIFICATION_RULE_VERSION,
    total: publicMoney(total),
    exceptions: publicMoney(exceptions),
    byDimension: {
      businessDate: {
        classified: publicMoney(byDimension.businessDate.classified),
        unknown: publicMoney(byDimension.businessDate.unknown),
        conflict: publicMoney(byDimension.businessDate.conflict),
      },
      eventInstant: {
        classified: publicMoney(byDimension.eventInstant.classified),
        unknown: publicMoney(byDimension.eventInstant.unknown),
        conflict: publicMoney(byDimension.eventInstant.conflict),
      },
      recordingTime: {
        classified: publicMoney(byDimension.recordingTime.classified),
        unknown: publicMoney(byDimension.recordingTime.unknown),
        conflict: publicMoney(byDimension.recordingTime.conflict),
      },
    },
  };
}
