export const CLEANUP_TABLES = Object.freeze({
  payments: "payments",
  customer_ledgers: "customer_ledgers",
  supplier_ledgers: "supplier_ledgers",
  stock_movements: "stock_movements",
  purchase_gst_reconciliation_event_lines: "purchase_gst_reconciliation_event_lines",
  purchase_gst_accounting_decisions: "purchase_gst_accounting_decisions",
  purchase_gst_calculations: "purchase_gst_calculations",
  purchase_gst_line_evidence: "purchase_gst_line_evidence",
  purchase_gst_reconciliation_events: "purchase_gst_reconciliation_events",
  purchase_posting_operations: "purchase_posting_operations",
  purchase_gst_evidence_revisions: "purchase_gst_evidence_revisions",
  sales_invoice_items: "sales_invoice_items",
  purchase_invoice_items: "purchase_invoice_items",
  sales_invoices: "sales_invoices",
  product_batches: "product_batches",
  purchase_invoices: "purchase_invoices",
  customers: "customers",
  suppliers: "suppliers",
  products: "products",
  audit_logs: "audit_logs",
  business_profiles: "business_profiles",
  role_permissions: "role_permissions",
  memberships: "memberships",
  roles: "roles",
  users: "users",
  tenants: "tenants",
});

const DIRECT_TENANT_OWNERSHIP = new Set([
  "payments",
  "customer_ledgers",
  "supplier_ledgers",
  "stock_movements",
  "purchase_gst_reconciliation_event_lines",
  "purchase_gst_accounting_decisions",
  "purchase_gst_calculations",
  "purchase_gst_line_evidence",
  "purchase_gst_reconciliation_events",
  "purchase_posting_operations",
  "purchase_gst_evidence_revisions",
  "sales_invoice_items",
  "purchase_invoice_items",
  "sales_invoices",
  "product_batches",
  "purchase_invoices",
  "customers",
  "suppliers",
  "products",
  "audit_logs",
  "business_profiles",
  "memberships",
  "roles",
]);

export function ownershipQuery(resourceType) {
  const table = CLEANUP_TABLES[resourceType];
  if (!table) throw new Error(`Unknown cleanup resource ownership: ${resourceType}.`);
  if (resourceType === "tenants") return `SELECT id FROM ${table} WHERE id = ANY($1::text[])`;
  if (resourceType === "users") {
    return `
      SELECT users.id FROM users
      WHERE EXISTS (
        SELECT 1 FROM memberships
        WHERE memberships.user_id = users.id
          AND memberships.tenant_id = ANY($1::text[])
      )
      AND NOT EXISTS (
        SELECT 1 FROM memberships
        WHERE memberships.user_id = users.id
          AND memberships.tenant_id <> ALL($1::text[])
      )
    `;
  }
  if (resourceType === "role_permissions") {
    return `
      SELECT permission.id
      FROM role_permissions permission
      JOIN roles role ON role.id = permission.role_id
      WHERE role.tenant_id = ANY($1::text[])
    `;
  }
  if (!DIRECT_TENANT_OWNERSHIP.has(resourceType)) {
    throw new Error(`No verified cleanup ownership relationship exists for ${resourceType}.`);
  }
  return `SELECT id FROM ${table} WHERE tenant_id = ANY($1::text[])`;
}

export async function collectOwnedResources(client, tenants, runId) {
  if (!Array.isArray(tenants) || tenants.length === 0 || tenants.some((tenant) => !String(tenant).trim())) {
    throw new Error("Cleanup ownership requires one or more verified run-owned tenants.");
  }
  const resources = [];
  for (const resourceType of Object.keys(CLEANUP_TABLES)) {
    const result = await client.query(ownershipQuery(resourceType), [tenants]);
    resources.push(...result.rows.map((row) => ({ resourceType, id: row.id, runId })));
  }
  return resources;
}
