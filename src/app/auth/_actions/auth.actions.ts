"use server";

import { Prisma, SystemRole, PermissionAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, assertPostgresConfigured } from "@/lib/db/prisma";
import { authAdapter } from "@/adapters/auth";
import {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type SignInInput,
  type SignUpInput,
  type ForgotPasswordInput,
} from "@/lib/validation/auth.schemas";
import { slugify } from "@/lib/utils";

export type ActionResult<T = unknown> = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  data?: T;
};

const ALL_PERMISSIONS = Object.values(PermissionAction);

const ROLE_PERMISSION_SETS: Record<SystemRole, PermissionAction[]> = {
  [SystemRole.ADMIN]: ALL_PERMISSIONS,
  [SystemRole.BILLING]: [
    PermissionAction.view_product,
    PermissionAction.view_customer,
    PermissionAction.view_supplier,
    PermissionAction.create_invoice,
    PermissionAction.edit_invoice,
    PermissionAction.view_invoice,
    PermissionAction.finalize_invoice,
    PermissionAction.view_customer_ledger,
    PermissionAction.view_inventory,
  ],
  [SystemRole.INVENTORY]: [
    PermissionAction.view_product,
    PermissionAction.create_product,
    PermissionAction.edit_product,
    PermissionAction.view_customer,
    PermissionAction.view_supplier,
    PermissionAction.create_purchase,
    PermissionAction.edit_purchase,
    PermissionAction.view_purchase,
    PermissionAction.finalize_purchase,
    PermissionAction.view_inventory,
    PermissionAction.adjust_stock,
    PermissionAction.manage_batches,
  ],
  [SystemRole.MANAGER]: [
    PermissionAction.view_product,
    PermissionAction.view_customer,
    PermissionAction.view_supplier,
    PermissionAction.view_purchase,
    PermissionAction.view_invoice,
    PermissionAction.view_inventory,
    PermissionAction.view_customer_ledger,
    PermissionAction.view_supplier_ledger,
    PermissionAction.view_reports,
    PermissionAction.view_audit_log,
  ],
};

export async function ensureRolePermissionsForTenant(tenantId: string): Promise<void> {
  for (const role of Object.values(SystemRole)) {
    const roleRow = await prisma.roles.upsert({
      where: { tenant_id_name: { tenant_id: tenantId, name: role } },
      update: {},
      create: {
        tenant_id: tenantId,
        name: role,
        system_role: role,
        is_default: role === SystemRole.ADMIN,
      },
    });
    const permissions = ROLE_PERMISSION_SETS[role];
    for (const action of permissions) {
      await prisma.role_permissions.upsert({
        where: { role_id_permission: { role_id: roleRow.id, permission: action } },
        update: {},
        create: { role_id: roleRow.id, permission: action },
      });
    }
  }
}

export type OnboardingTenantParams = {
  business_name: string;
  slug?: string;
  external_user_id: string;
  user_email: string;
  user_full_name?: string | null;
  user_phone?: string | null;
  business_profile?: Partial<{
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    gstin: string | null;
    pan: string | null;
    drug_license_no_1: string | null;
    drug_license_no_2: string | null;
    contact_phone: string | null;
    contact_email: string | null;
  }>;
};

export async function onboardNewTenant(params: OnboardingTenantParams) {
  const slug = params.slug ?? slugify(params.business_name).slice(0, 40);
  const existing = await prisma.tenants.findUnique({ where: { slug } });
  if (existing) {
    throw new Error("Workspace URL is already taken. Please choose a different business name.");
  }

  return prisma.$transaction(async (tx: any) => {
    const tenant = await tx.tenants.create({
      data: {
        slug,
        business_name: params.business_name,
        business_profile: {
          create: {
            address_line_1: params.business_profile?.address_line_1 ?? null,
            address_line_2: params.business_profile?.address_line_2 ?? null,
            city: params.business_profile?.city ?? null,
            state: params.business_profile?.state ?? null,
            pincode: params.business_profile?.pincode ?? null,
            gstin: params.business_profile?.gstin ?? null,
            pan: params.business_profile?.pan ?? null,
            drug_license_no_1: params.business_profile?.drug_license_no_1 ?? null,
            drug_license_no_2: params.business_profile?.drug_license_no_2 ?? null,
            contact_phone: params.business_profile?.contact_phone ?? null,
            contact_email: params.business_profile?.contact_email ?? params.user_email,
            invoice_prefix: "INV",
            invoice_next_seq: 1,
            purchase_prefix: "PUR",
            purchase_next_seq: 1,
            near_expiry_days: 60,
          },
        },
      },
      select: { id: true, slug: true, business_name: true },
    });

    for (const role of Object.values(SystemRole)) {
      const roleRow = await tx.roles.create({
        data: {
          tenant_id: tenant.id,
          name: role,
          system_role: role,
          is_default: role === SystemRole.ADMIN,
        },
        select: { id: true, name: true },
      });
      const perms = ROLE_PERMISSION_SETS[role];
      if (perms.length > 0) {
        await tx.role_permissions.createMany({
          data: perms.map((p) => ({ role_id: roleRow.id, permission: p })),
        });
      }
      if (role === SystemRole.ADMIN) {
        const user = await tx.users.upsert({
          where: { email: params.user_email },
          update: {
            external_id: params.external_user_id,
            full_name: params.user_full_name ?? undefined,
            phone: params.user_phone ?? undefined,
          },
          create: {
            external_id: params.external_user_id,
            email: params.user_email,
            full_name: params.user_full_name ?? null,
            phone: params.user_phone ?? null,
          },
          select: { id: true },
        });
        await tx.memberships.create({
          data: {
            tenant_id: tenant.id,
            user_id: user.id,
            role_id: roleRow.id,
            status: "active",
            invited_by: user.id,
            joined_at: new Date(),
          },
        });
      }
    }

    return tenant;
  });
}

export async function signInAction(
  _prevState: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const parsed = signInSchema.safeParse({
      email: form.get("email") as string | null,
      password: form.get("password") as string | null,
      remember: form.get("remember") === "on",
    });
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.flatten().fieldErrors, message: "Please check the highlighted fields." };
    }
    const input: SignInInput = parsed.data;
    await authAdapter.signIn({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      remember: input.remember,
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Sign-in failed.";
    return { ok: false, message: msg };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUpAction(
  _prevState: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const parsed = signUpSchema.safeParse({
      fullName: form.get("fullName") as string | null,
      businessName: form.get("businessName") as string | null,
      email: form.get("email") as string | null,
      password: form.get("password") as string | null,
      confirmPassword: form.get("confirmPassword") as string | null,
      phone: form.get("phone") as string | null,
    });
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.flatten().fieldErrors, message: "Please check the highlighted fields." };
    }
    const input: SignUpInput = parsed.data;
    const normalizedEmail = input.email.trim().toLowerCase();

    const redirectBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { user, needsVerification } = await authAdapter.signUp({
      email: normalizedEmail,
      password: input.password,
      fullName: input.fullName.trim(),
      phone: input.phone,
      redirectTo: `${redirectBase}/auth/confirm`,
    });

    try {
      assertPostgresConfigured("sign-up onboarding");
      await onboardNewTenant({
        business_name: input.businessName.trim(),
        external_user_id: user.externalId ?? user.id,
        user_email: normalizedEmail,
        user_full_name: user.fullName ?? input.fullName.trim(),
        user_phone: user.phone ?? input.phone,
      });
    } catch (e: any) {
      return { ok: false, message: typeof e?.message === "string" ? e.message : "Could not create workspace." };
    }

    if (needsVerification) {
      revalidatePath("/", "layout");
      return {
        ok: true,
        message: "Workspace created. Check your email to confirm the sign-in link.",
        data: { needsVerification: true },
      };
    }
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Sign-up failed.";
    return { ok: false, message: msg };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function forgotPasswordAction(
  _prevState: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const parsed = forgotPasswordSchema.safeParse({
      email: form.get("email") as string | null,
    });
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.flatten().fieldErrors, message: "Please enter a valid email." };
    }
    const input: ForgotPasswordInput = parsed.data;
    const redirectBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await authAdapter.sendPasswordReset({
      email: input.email.trim().toLowerCase(),
      redirectTo: `${redirectBase}/auth/reset-password`,
    });
    return {
      ok: true,
      message:
        "If that email is registered, we sent a password reset link. Please check your inbox.",
    };
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Could not send reset link.";
    return { ok: false, message: msg };
  }
}

export async function resetPasswordAction(
  _prevState: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const parsed = resetPasswordSchema.safeParse({
      newPassword: form.get("newPassword") as string | null,
      confirmPassword: form.get("confirmPassword") as string | null,
    });
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.flatten().fieldErrors, message: "Passwords must match and be at least 8 characters." };
    }
    await authAdapter.updatePassword({ newPassword: parsed.data.newPassword });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Could not update password.";
    return { ok: false, message: msg };
  }
  revalidatePath("/", "layout");
  redirect("/auth/sign-in");
}

export async function signOutAction(): Promise<ActionResult> {
  try {
    await authAdapter.signOut();
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Sign-out failed.";
    return { ok: false, message: msg };
  }
  revalidatePath("/", "layout");
  redirect("/");
}
