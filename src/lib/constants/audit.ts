import type { AuditEventType } from "@prisma/client";
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export const AUDIT_BADGE_MAP: Record<AuditEventType, BadgeVariant> = {
  AUTH_LOGIN: "success",
  AUTH_LOGOUT: "secondary",
  USER_INVITED: "default",
  USER_ROLE_CHANGED: "default",
  BUSINESS_PROFILE_UPDATED: "default",
  INVOICE_CREATED: "success",
  INVOICE_FINALIZED: "success",
  INVOICE_CANCELLED: "destructive",
  PURCHASE_CREATED: "success",
  PURCHASE_FINALIZED: "success",
  STOCK_ADJUSTED: "warning",
  PRICE_UPDATED: "success",
  PRODUCT_CREATED: "success",
  PRODUCT_UPDATED: "success",
};

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  AUTH_LOGIN: "Login",
  AUTH_LOGOUT: "Logout",
  USER_INVITED: "User invited",
  USER_ROLE_CHANGED: "User role changed",
  BUSINESS_PROFILE_UPDATED: "Business profile updated",
  INVOICE_CREATED: "Invoice created",
  INVOICE_FINALIZED: "Invoice finalized",
  INVOICE_CANCELLED: "Invoice cancelled",
  PURCHASE_CREATED: "Purchase created",
  PURCHASE_FINALIZED: "Purchase finalized",
  STOCK_ADJUSTED: "Stock adjusted",
  PRICE_UPDATED: "Price updated",
  PRODUCT_CREATED: "Product created",
  PRODUCT_UPDATED: "Product updated",
};
