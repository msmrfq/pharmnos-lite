"use server";

import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma, assertPostgresConfigured } from "@/lib/db/prisma";
import { requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import type { PermissionAction } from "@prisma/client";

type CatalogInput = {
  code: string;
  description?: string | null;
  classification_type?: string | null;
  source_reference?: string | null;
  effective_from?: Date | null;
  effective_to?: Date | null;
};

function formText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function formDate(formData: FormData, key: string, required = false): Date | null {
  const value = formText(formData, key);
  if (!value) {
    if (required) throw new Error(`${key} is required.`);
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${key} must be a valid date.`);
  return date;
}

type RuleInput = {
  hsn_sac_catalog_id?: string | null;
  rule_version: string;
  tax_rate?: number | null;
  component_policy: string;
  source_reference?: string | null;
  effective_from: Date;
  effective_to?: Date | null;
};

function requireDateOrder(from: Date, to: Date | null | undefined): void {
  if (to && to <= from) throw new Error("Effective end must be after effective start.");
}

export async function getGstCatalogAdminData() {
  assertPostgresConfigured("getGstCatalogAdminData");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, "manage_hsn_catalog" as PermissionAction);
  const [catalog, rules] = await Promise.all([
    prisma.hsn_sac_catalog.findMany({
      where: { tenant_id: ctx.tenantId },
      orderBy: { code: "asc" },
    }),
    prisma.gst_rate_rules.findMany({
      where: { tenant_id: ctx.tenantId },
      orderBy: { effective_from: "desc" },
    }),
  ]);
  return {
    catalog: catalog.map((record) => ({
      ...record,
      effective_from: record.effective_from?.toISOString() ?? null,
      effective_to: record.effective_to?.toISOString() ?? null,
    })),
    rules: rules.map((rule) => ({
      ...rule,
      tax_rate: rule.tax_rate === null ? null : Number(rule.tax_rate),
      effective_from: rule.effective_from.toISOString(),
      effective_to: rule.effective_to?.toISOString() ?? null,
    })),
  };
}

async function activeMembershipId(tenantId: string, userId: string): Promise<string> {
  const membership = await prisma.memberships.findFirst({
    where: { tenant_id: tenantId, user_id: userId, status: "active" },
    select: { id: true },
  });
  if (!membership) throw new Error("Active tenant membership is required.");
  return membership.id;
}

export async function createHsnSacCatalogRecord(input: CatalogInput): Promise<{ id: string }> {
  assertPostgresConfigured("createHsnSacCatalogRecord");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, "manage_hsn_catalog" as PermissionAction);
  const membershipId = await activeMembershipId(ctx.tenantId, ctx.userId);
  const code = input.code.trim();
  if (!code) throw new Error("HSN/SAC code is required.");
  if (input.effective_from) requireDateOrder(input.effective_from, input.effective_to);

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.hsn_sac_catalog.create({
      data: {
        tenant_id: ctx.tenantId,
        code,
        description: input.description?.trim() || null,
        source_reference: input.source_reference?.trim() || null,
        effective_from: input.effective_from ?? null,
        effective_to: input.effective_to ?? null,
        is_active: false,
        created_by_membership_id: membershipId,
      },
    });
    await tx.$executeRaw(Prisma.sql`
      UPDATE "hsn_sac_catalog"
      SET "classification_type" = ${input.classification_type?.trim() || null}
      WHERE "tenant_id" = ${ctx.tenantId} AND "id" = ${created.id}
    `);
    await tx.hsn_sac_catalog_history.create({
      data: {
        tenant_id: ctx.tenantId,
        catalog_id: created.id,
        action: "CREATED_PENDING",
        snapshot: {
          ...created,
          classification_type: input.classification_type?.trim() || null,
        } as unknown as Prisma.InputJsonValue,
        actor_membership_id: membershipId,
      },
    });
    return created;
  });
  return { id: record.id };
}

export async function createGstRateRuleFromForm(formData: FormData): Promise<void> {
  await createGstRateRule({
    hsn_sac_catalog_id: formText(formData, "hsn_sac_catalog_id") || null,
    rule_version: formText(formData, "rule_version"),
    tax_rate: Number(formText(formData, "tax_rate")),
    component_policy: formText(formData, "component_policy"),
    source_reference: formText(formData, "source_reference"),
    effective_from: formDate(formData, "effective_from", true) as Date,
    effective_to: formDate(formData, "effective_to"),
  });
  revalidatePath("/settings");
}

export async function createHsnSacCatalogRecordFromForm(formData: FormData): Promise<void> {
  await createHsnSacCatalogRecord({
    code: formText(formData, "code"),
    description: formText(formData, "description"),
    classification_type: formText(formData, "classification_type"),
    source_reference: formText(formData, "source_reference"),
    effective_from: formDate(formData, "effective_from"),
    effective_to: formDate(formData, "effective_to"),
  });
  revalidatePath("/settings");
}

export async function updateHsnSacCatalogRecord(
  catalogId: string,
  input: Omit<CatalogInput, "code">,
): Promise<{ id: string }> {
  assertPostgresConfigured("updateHsnSacCatalogRecord");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, "manage_hsn_catalog" as PermissionAction);
  const membershipId = await activeMembershipId(ctx.tenantId, ctx.userId);
  if (input.effective_from) requireDateOrder(input.effective_from, input.effective_to);
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.hsn_sac_catalog.findFirst({
      where: { id: catalogId, tenant_id: ctx.tenantId },
    });
    if (!existing) throw new Error("Catalog record not found.");
    await tx.hsn_sac_catalog.update({
      where: { id: catalogId },
      data: {
        description: input.description?.trim() || null,
        source_reference: input.source_reference?.trim() || null,
        effective_from: input.effective_from ?? null,
        effective_to: input.effective_to ?? null,
        updated_by_membership_id: membershipId,
        updated_at: new Date(),
      },
    });
    await tx.$executeRaw(Prisma.sql`
      UPDATE "hsn_sac_catalog"
      SET
        "classification_type" = ${input.classification_type?.trim() || null},
        "classification_status" = 'PENDING',
        "is_active" = false,
        "rate_approval_status" = 'PENDING',
        "classification_approved_by_membership_id" = NULL,
        "classification_approved_at" = NULL
      WHERE "tenant_id" = ${ctx.tenantId} AND "id" = ${catalogId}
    `);
    const record = await tx.hsn_sac_catalog.findUnique({
      where: { id: catalogId },
    });
    if (!record) throw new Error("Updated catalog record could not be reloaded.");
    await tx.hsn_sac_catalog_history.create({
      data: {
        tenant_id: ctx.tenantId,
        catalog_id: record.id,
        action: "UPDATED_PENDING",
        snapshot: record as unknown as Prisma.InputJsonValue,
        actor_membership_id: membershipId,
      },
    });
    return record;
  });
  revalidatePath("/settings");
  return { id: updated.id };
}

export async function approveHsnSacClassification(
  catalogId: string,
  sourceReference: string,
): Promise<{ id: string }> {
  assertPostgresConfigured("approveHsnSacClassification");
  const ctx = await requireServerTenantContext();
  const membershipId = await activeMembershipId(ctx.tenantId, ctx.userId);
  requirePermission(ctx, "approve_hsn_catalog" as PermissionAction);
  const source = sourceReference.trim();
  if (!source) throw new Error("Classification source reference is required.");
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.hsn_sac_catalog.updateMany({
      where: { id: catalogId, tenant_id: ctx.tenantId, classification_status: "PENDING" },
      data: {
        classification_status: "APPROVED",
        source_reference: source,
        is_active: true,
        updated_by_membership_id: membershipId,
        updated_at: new Date(),
      },
    });
    await tx.$executeRaw(Prisma.sql`
      UPDATE "hsn_sac_catalog"
      SET
        "classification_approved_by_membership_id" = ${membershipId},
        "classification_approved_at" = NOW()
      WHERE "tenant_id" = ${ctx.tenantId} AND "id" = ${catalogId}
    `);
    if (result.count !== 1) return result;
    const record = await tx.hsn_sac_catalog.findUnique({
      where: { id: catalogId },
    });
    if (!record) throw new Error("Approved catalog record could not be reloaded.");
    await tx.hsn_sac_catalog_history.create({
      data: {
        tenant_id: ctx.tenantId,
        catalog_id: record.id,
        action: "CLASSIFICATION_APPROVED",
        snapshot: record as unknown as Prisma.InputJsonValue,
        actor_membership_id: membershipId,
      },
    });
    return result;
  });
  if (updated.count !== 1) throw new Error("Catalog record is missing, cross-tenant, or already reviewed.");
  revalidatePath("/settings");
  return { id: catalogId };
}

export async function approveHsnSacClassificationFromForm(formData: FormData): Promise<void> {
  await approveHsnSacClassification(
    formText(formData, "catalog_id"),
    formText(formData, "source_reference"),
  );
}

export async function createGstRateRule(input: RuleInput): Promise<{ id: string }> {
  assertPostgresConfigured("createGstRateRule");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, "manage_hsn_catalog" as PermissionAction);
  const membershipId = await activeMembershipId(ctx.tenantId, ctx.userId);
  const version = input.rule_version.trim();
  const policy = input.component_policy.trim();
  if (!version || !policy) throw new Error("Rule version and component policy are required.");
  if (input.tax_rate === null || input.tax_rate === undefined || !Number.isFinite(input.tax_rate) || input.tax_rate < 0) {
    throw new Error("A finite non-negative GST rate is required.");
  }
  requireDateOrder(input.effective_from, input.effective_to);

  const created = await prisma.$transaction(async (tx) => {
    const rule = await tx.gst_rate_rules.create({
      data: {
        tenant_id: ctx.tenantId,
        hsn_sac_catalog_id: input.hsn_sac_catalog_id ?? null,
        rule_version: version,
        tax_rate: input.tax_rate,
        component_policy: policy,
        source_reference: input.source_reference?.trim() || null,
        effective_from: input.effective_from,
        effective_to: input.effective_to ?? null,
        is_active: false,
        created_by_membership_id: membershipId,
      },
    });
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "gst_rate_rule_history"
        ("id", "tenant_id", "rule_id", "action", "snapshot", "actor_membership_id")
      VALUES (
        ${randomUUID()},
        ${ctx.tenantId},
        ${rule.id},
        'CREATED_PENDING',
        CAST(${JSON.stringify(rule)} AS jsonb),
        ${membershipId}
      )
    `);
    return rule;
  });
  return { id: created.id };
}

export async function createGstRateRuleRevision(
  ruleId: string,
  input: RuleInput,
): Promise<{ id: string }> {
  assertPostgresConfigured("createGstRateRuleRevision");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, "manage_hsn_catalog" as PermissionAction);
  const membershipId = await activeMembershipId(ctx.tenantId, ctx.userId);
  const version = input.rule_version.trim();
  const policy = input.component_policy.trim();
  if (!version || !policy) throw new Error("Rule version and component policy are required.");
  if (input.tax_rate === null || input.tax_rate === undefined || !Number.isFinite(input.tax_rate) || input.tax_rate < 0) {
    throw new Error("A finite non-negative GST rate is required.");
  }
  requireDateOrder(input.effective_from, input.effective_to);

  const created = await prisma.$transaction(async (tx) => {
    const prior = await tx.gst_rate_rules.findFirst({
      where: {
        id: ruleId,
        tenant_id: ctx.tenantId,
        approval_status: "APPROVED",
        is_active: true,
      },
    });
    if (!prior) throw new Error("Only an approved active GST rate can be revised.");
    const revision = await tx.gst_rate_rules.create({
      data: {
        tenant_id: ctx.tenantId,
        hsn_sac_catalog_id: input.hsn_sac_catalog_id === undefined
          ? prior.hsn_sac_catalog_id
          : input.hsn_sac_catalog_id,
        rule_version: version,
        tax_rate: input.tax_rate,
        component_policy: policy,
        source_reference: input.source_reference?.trim() || null,
        effective_from: input.effective_from,
        effective_to: input.effective_to ?? null,
        is_active: false,
        created_by_membership_id: membershipId,
      },
    });
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "gst_rate_rule_history"
        ("id", "tenant_id", "rule_id", "action", "snapshot", "actor_membership_id")
      VALUES (
        ${randomUUID()},
        ${ctx.tenantId},
        ${revision.id},
        'REVISION_CREATED',
        CAST(${JSON.stringify({ ...revision, supersedes_rule_id: prior.id })} AS jsonb),
        ${membershipId}
      )
    `);
    return revision;
  });
  return { id: created.id };
}

export async function approveGstRateRule(
  ruleId: string,
  sourceReference: string,
): Promise<{ id: string }> {
  assertPostgresConfigured("approveGstRateRule");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, "approve_gst_rates" as PermissionAction);
  const membershipId = await activeMembershipId(ctx.tenantId, ctx.userId);
  const source = sourceReference.trim();
  if (!source) throw new Error("GST rate source reference is required.");
  const updated = await prisma.$transaction(async (tx) => {
    const pending = await tx.gst_rate_rules.findFirst({
      where: { id: ruleId, tenant_id: ctx.tenantId, approval_status: "PENDING", is_active: false },
    });
    if (!pending) return { count: 0 };
    if (pending.tax_rate === null || !Number.isFinite(Number(pending.tax_rate)) || Number(pending.tax_rate) < 0) {
      throw new Error("GST rate approval is blocked: a finite non-negative rate is required.");
    }
    if (pending.hsn_sac_catalog_id) {
      const classification = await tx.hsn_sac_catalog.findFirst({
        where: { id: pending.hsn_sac_catalog_id, tenant_id: ctx.tenantId },
      });
      if (!classification || classification.classification_status !== "APPROVED" || !classification.is_active) {
        throw new Error("GST rate approval is blocked until its classification is approved and active.");
      }
    }
    const existingRules = await tx.gst_rate_rules.findMany({
      where: {
        tenant_id: ctx.tenantId,
        hsn_sac_catalog_id: pending.hsn_sac_catalog_id,
        component_policy: pending.component_policy,
        approval_status: "APPROVED",
        is_active: true,
        id: { not: pending.id },
      },
      select: { effective_from: true, effective_to: true },
    });
    const pendingEnd = pending.effective_to?.getTime() ?? Number.POSITIVE_INFINITY;
    if (existingRules.some((rule) =>
      rule.effective_from.getTime() < pendingEnd &&
      (rule.effective_to?.getTime() ?? Number.POSITIVE_INFINITY) > pending.effective_from.getTime()
    )) {
      throw new Error("GST rate approval is blocked: an overlapping approved rule already exists.");
    }
    const result = await tx.gst_rate_rules.updateMany({
      where: {
        id: ruleId,
        tenant_id: ctx.tenantId,
        approval_status: "PENDING",
        is_active: false,
      },
      data: {
        approval_status: "APPROVED",
        source_reference: source,
        is_active: true,
        approved_by_membership_id: membershipId,
        approved_at: new Date(),
        updated_at: new Date(),
      },
    });
    if (result.count !== 1) return result;
    const rule = await tx.gst_rate_rules.findUnique({
      where: { id: ruleId },
      select: { hsn_sac_catalog_id: true },
    });
    if (rule?.hsn_sac_catalog_id) {
      await tx.hsn_sac_catalog.updateMany({
        where: { id: rule.hsn_sac_catalog_id, tenant_id: ctx.tenantId },
        data: { rate_approval_status: "APPROVED", updated_by_membership_id: membershipId },
      });
    }
    const approved = await tx.gst_rate_rules.findUnique({ where: { id: ruleId } });
    if (!approved) throw new Error("Approved GST rate rule could not be reloaded.");
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "gst_rate_rule_history"
        ("id", "tenant_id", "rule_id", "action", "snapshot", "actor_membership_id")
      VALUES (
        ${randomUUID()},
        ${ctx.tenantId},
        ${ruleId},
        'RATE_APPROVED',
        CAST(${JSON.stringify(approved)} AS jsonb),
        ${membershipId}
      )
    `);
    return result;
  });
  if (updated.count !== 1) throw new Error("Rate rule is missing, cross-tenant, or already approved.");
  revalidatePath("/settings");
  return { id: ruleId };
}

export async function approveGstRateRuleFromForm(formData: FormData): Promise<void> {
  await approveGstRateRule(
    formText(formData, "rule_id"),
    formText(formData, "source_reference"),
  );
}
