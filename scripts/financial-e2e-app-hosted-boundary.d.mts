import type { PermissionAction } from "@prisma/client";

export type ApplicationHostedFinancialE2eBoundaryOptions = {
    resolveTenantContext: () => Promise<{
        tenantId: string;
        userId: string;
        roles: string[];
        permissions: string[];
    }>;
    requirePermission: (context: {
        tenantId: string;
        userId: string;
        roles: string[];
        permissions: string[];
    }, permission: PermissionAction) => void;
    canStartScenario: (gate: unknown) => Promise<boolean>;
    scenarioOperations?: Record<string, (request: {
        context: {
            tenantId: string;
            userId: string;
            roles: string[];
            permissions: string[];
        };
        input?: unknown;
    }) => Promise<unknown>>;
};

export function createApplicationHostedFinancialE2eBoundary(
    options: ApplicationHostedFinancialE2eBoundaryOptions,
): {
    dispatch(request: {
        scenario: string;
        requiredPermission: string;
        gate: unknown;
        input?: unknown;
        requestedTenantId?: string | null;
    }): Promise<{
        status: string;
        code?: string;
        message?: string;
        scenario?: string;
        result?: unknown;
    }>;
};
