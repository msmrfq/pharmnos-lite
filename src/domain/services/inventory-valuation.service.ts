export type InventoryEligibilityStatus =
  | "PENDING"
  | "RECOVERABLE"
  | "NON_RECOVERABLE"
  | "PARTIALLY_RECOVERABLE"
  | "REJECTED";

export type InventoryValuationInput = {
  acceptedTaxableValue: number;
  acceptedGst: number;
  eligibilityStatus: InventoryEligibilityStatus;
  recoverableItc?: number | null;
  nonRecoverableGst?: number | null;
  approvedDirectAcquisitionCost?: number | null;
  policyVersion?: string | null;
  decisionReference?: string | null;
  decidedByMembershipId?: string | null;
};

export type InventoryValuationResult = {
  status: "PENDING" | "REJECTED" | "APPROVED";
  recoverableItc: number | null;
  nonRecoverableGst: number | null;
  inventoryAcquisitionCost: number | null;
  policyVersion: string | null;
  decisionReference: string | null;
  decidedByMembershipId: string | null;
  reason?: string;
};

export type InventoryValuationSnapshot = {
  recoverableItc: number;
  nonRecoverableGst: number;
  inventoryAcquisitionCost: number;
};

const EPSILON = 0.0001;

function isNonNegative(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value >= 0;
}

function isClose(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON;
}

function pendingResult(reason: string): InventoryValuationResult {
  return {
    status: "PENDING",
    recoverableItc: null,
    nonRecoverableGst: null,
    inventoryAcquisitionCost: null,
    policyVersion: null,
    decisionReference: null,
    decidedByMembershipId: null,
    reason,
  };
}

export function resolveInventoryValuation(
  input: InventoryValuationInput,
): InventoryValuationResult {
  if (!isNonNegative(input.acceptedTaxableValue) || !isNonNegative(input.acceptedGst)) {
    return pendingResult("Accepted taxable value and GST must be non-negative finite amounts.");
  }

  if (input.eligibilityStatus === "PENDING") {
    return pendingResult("ITC eligibility has not been explicitly decided.");
  }

  if (input.eligibilityStatus === "REJECTED") {
    return {
      ...pendingResult("The valuation decision was rejected."),
      status: "REJECTED",
    };
  }

  const recoverableItc = input.recoverableItc;
  const nonRecoverableGst = input.nonRecoverableGst;
  const directAcquisitionCost = input.approvedDirectAcquisitionCost;

  if (
    !isNonNegative(recoverableItc) ||
    !isNonNegative(nonRecoverableGst) ||
    !isNonNegative(directAcquisitionCost) ||
    !input.policyVersion?.trim() ||
    !input.decisionReference?.trim() ||
    !input.decidedByMembershipId?.trim()
  ) {
    return pendingResult("An approved valuation requires explicit amounts, policy, reference, and actor.");
  }

  if (!isClose(recoverableItc + nonRecoverableGst, input.acceptedGst)) {
    return pendingResult("Recoverable and non-recoverable GST must reconcile to accepted GST.");
  }

  if (
    (input.eligibilityStatus === "RECOVERABLE" && nonRecoverableGst > EPSILON) ||
    (input.eligibilityStatus === "NON_RECOVERABLE" && recoverableItc > EPSILON) ||
    (input.eligibilityStatus === "PARTIALLY_RECOVERABLE" &&
      recoverableItc <= EPSILON &&
      nonRecoverableGst <= EPSILON)
  ) {
    return pendingResult("Eligibility status does not match the explicit GST split.");
  }

  return {
    status: "APPROVED",
    recoverableItc,
    nonRecoverableGst,
    inventoryAcquisitionCost: input.acceptedTaxableValue + nonRecoverableGst + directAcquisitionCost,
    policyVersion: input.policyVersion,
    decisionReference: input.decisionReference,
    decidedByMembershipId: input.decidedByMembershipId,
  };
}

export function calculateInventoryValuationAdjustment(
  previous: InventoryValuationSnapshot,
  next: InventoryValuationSnapshot,
) {
  if (
    !Object.values(previous).every((value) => isNonNegative(value)) ||
    !Object.values(next).every((value) => isNonNegative(value))
  ) {
    throw new Error("Valuation adjustments require finite non-negative snapshots.");
  }

  return {
    recoverableItcDelta: next.recoverableItc - previous.recoverableItc,
    nonRecoverableGstDelta: next.nonRecoverableGst - previous.nonRecoverableGst,
    inventoryAcquisitionCostDelta:
      next.inventoryAcquisitionCost - previous.inventoryAcquisitionCost,
  };
}
