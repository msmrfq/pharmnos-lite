import { PermissionAction, SystemRole } from "@prisma/client";

export const ROLE_PERMISSIONS: Record<SystemRole, PermissionAction[]> = {
  [SystemRole.ADMIN]: Object.values(PermissionAction),
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

export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { key: "billing", label: "Billing", href: "/billing", icon: "Receipt" },
  { key: "purchases", label: "Purchases", href: "/purchases", icon: "PackagePlus" },
  { key: "inventory", label: "Inventory", href: "/inventory", icon: "Warehouse" },
  { key: "customers", label: "Customers", href: "/customers", icon: "Users" },
  { key: "suppliers", label: "Suppliers", href: "/suppliers", icon: "Truck" },
  { key: "reports", label: "Reports", href: "/reports", icon: "BarChart3" },
  { key: "audit", label: "Audit Log", href: "/audit", icon: "ClipboardList" },
  { key: "settings", label: "Settings", href: "/settings", icon: "Settings" },
] as const;

export function hasPermission(
  userPermissions: string[] | undefined | null,
  required: PermissionAction,
): boolean {
  if (!userPermissions) return false;
  return userPermissions.includes(required);
}

export function hasAnyPermission(
  userPermissions: string[] | undefined | null,
  required: PermissionAction[],
): boolean {
  if (!userPermissions) return false;
  return required.some((p) => userPermissions.includes(p));
}
