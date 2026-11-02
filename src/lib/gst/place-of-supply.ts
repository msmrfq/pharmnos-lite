import {
  determinePlaceOfSupply,
  getStateName,
  normalizeState,
} from "@/lib/constants/indian-states";

export type PurchaseSupplyFactsInput = {
  supplier_state_at_transaction?: unknown;
  recipient_state_at_transaction?: unknown;
  delivery_state_at_transaction?: unknown;
  supply_scenario?: unknown;
};

export type ResolvedPurchaseSupplyFacts = {
  supplier_state_at_transaction: string;
  recipient_state_at_transaction: string;
  delivery_state_at_transaction: string;
  supply_scenario: "INTRA_STATE" | "INTER_STATE";
  supplier_state_name: string;
  recipient_state_name: string;
  delivery_state_name: string;
};

export function resolvePurchaseSupplyFacts(
  input: PurchaseSupplyFactsInput,
): { ok: true; facts: ResolvedPurchaseSupplyFacts } | { ok: false; error: string } {
  const supplier = normalizeState(String(input.supplier_state_at_transaction ?? ""));
  const recipient = normalizeState(String(input.recipient_state_at_transaction ?? ""));
  const delivery = normalizeState(String(input.delivery_state_at_transaction ?? ""));
  const scenario = String(input.supply_scenario ?? "").trim();

  if (!supplier || !recipient || !delivery) {
    return { ok: false, error: "Supplier, recipient, and delivery states are required." };
  }
  if (delivery !== recipient) {
    return {
      ok: false,
      error: "Delivery state must match the captured recipient state for this domestic workflow.",
    };
  }

  const resolved = determinePlaceOfSupply(supplier, recipient);
  if (resolved.type === "UNKNOWN" && resolved.reason === "UNSUPPORTED_UTGST") {
    return {
      ok: false,
      error: "Intra-UT supply is blocked until an approved UTGST treatment is available.",
    };
  }
  const expectedScenario =
    resolved.type === "INTRA" ? "INTRA_STATE" :
    resolved.type === "INTER" ? "INTER_STATE" : null;
  if (!expectedScenario || scenario !== expectedScenario) {
    return {
      ok: false,
      error: "Supply scenario does not match the captured transaction states.",
    };
  }

  return {
    ok: true,
    facts: {
      supplier_state_at_transaction: supplier,
      recipient_state_at_transaction: recipient,
      delivery_state_at_transaction: delivery,
      supply_scenario: expectedScenario,
      supplier_state_name: getStateName(supplier) ?? supplier,
      recipient_state_name: getStateName(recipient) ?? recipient,
      delivery_state_name: getStateName(delivery) ?? delivery,
    },
  };
}
