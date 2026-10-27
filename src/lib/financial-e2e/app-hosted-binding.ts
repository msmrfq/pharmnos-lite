import {
  createApplicationHostedFinancialE2eBoundary,
  type ApplicationHostedFinancialE2eBoundaryOptions,
} from "../../../scripts/financial-e2e-app-hosted-boundary.mjs";
import { requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";

export type { ApplicationHostedFinancialE2eBoundaryOptions };

export type FinancialE2eInternalInvocation = {
  scenario: string;
  requiredPermission: string;
  gate: unknown;
  requestedTenantId?: string | null;
};

export function createRequestScopedFinancialE2eBoundary(
  options: Omit<ApplicationHostedFinancialE2eBoundaryOptions, "resolveTenantContext" | "requirePermission">,
) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Financial E2E application binding is disabled in production.");
  }

  return createApplicationHostedFinancialE2eBoundary({
    ...options,
    resolveTenantContext: requireServerTenantContext,
    requirePermission,
  });
}

export async function invokeRequestScopedFinancialE2e(
  request: FinancialE2eInternalInvocation,
  canStartScenario: ApplicationHostedFinancialE2eBoundaryOptions["canStartScenario"],
) {
  const boundary = createRequestScopedFinancialE2eBoundary({
    canStartScenario,
    scenarioOperations: {},
  });
  return boundary.dispatch(request);
}
