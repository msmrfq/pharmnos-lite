---
title: GST Live Supabase Metadata Baseline
date: 2026-10-24
status: Read-only evidence; rollout not authorized
---

# GST Live Supabase Metadata Baseline

## Capture scope and safety

- Capture timestamp: 24-10-2026, 20:41:51 IST.
- This artifact contains PostgreSQL catalog metadata only. No business rows were queried.
- No DDL, DML, migration, synchronization, grant change, policy change, or object mutation was performed.
- Existing local DATABASE_URL runtime configuration was used; credentials, connection strings, and endpoint secrets are omitted.
- Approved project marker matched in the non-secret endpoint username shape: lizyjqkckysgvffwcqvb. The endpoint was a Supavisor pooler endpoint; it was not printed.

## Directly observed identity

```json
{
  "database_name": "postgres",
  "connected_role": "postgres",
  "server_address": "2406:da1a:82a:9d01:121a:ca53:3ebd:5288/128",
  "server_port": 5432,
  "server_version": "17.6",
  "rolsuper": false,
  "rolbypassrls": true
}
```

Interpretation: rolsuper=false and rolbypassrls=true. This role cannot establish ordinary-role tenant isolation.

## Object inventory

### Parent and GST/posting tables

| schema_name | table_name | relkind | owner | rls_enabled | rls_forced |
| --- | --- | --- | --- | --- | --- |
| public | memberships | r | postgres | true | false |
| public | purchase_invoice_items | r | postgres | true | false |
| public | purchase_invoices | r | postgres | true | false |
| public | tenants | r | postgres | true | false |

### Relevant columns

| table_name | column_name | data_type | udt_name | is_nullable | column_default | numeric_precision | numeric_scale | datetime_precision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| memberships | id | text | text | NO |  |  |  |  |
| memberships | tenant_id | text | text | NO |  |  |  |  |
| memberships | user_id | text | text | NO |  |  |  |  |
| memberships | role_id | text | text | NO |  |  |  |  |
| memberships | status | text | text | NO | 'active'::text |  |  |  |
| memberships | invited_by | text | text | YES |  |  |  |  |
| memberships | invited_at | timestamp without time zone | timestamp | YES |  |  |  | 3 |
| memberships | joined_at | timestamp without time zone | timestamp | YES |  |  |  | 3 |
| memberships | created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP |  |  | 3 |
| memberships | updated_at | timestamp without time zone | timestamp | NO |  |  |  | 3 |
| purchase_invoice_items | id | text | text | NO |  |  |  |  |
| purchase_invoice_items | tenant_id | text | text | NO |  |  |  |  |
| purchase_invoice_items | purchase_id | text | text | NO |  |  |  |  |
| purchase_invoice_items | product_id | text | text | NO |  |  |  |  |
| purchase_invoice_items | batch_no | text | text | NO |  |  |  |  |
| purchase_invoice_items | expiry_date | timestamp without time zone | timestamp | YES |  |  |  | 3 |
| purchase_invoice_items | quantity | integer | int4 | NO |  | 32 | 0 |  |
| purchase_invoice_items | free_qty | integer | int4 | NO | 0 | 32 | 0 |  |
| purchase_invoice_items | purchase_rate | numeric | numeric | NO |  | 12 | 2 |  |
| purchase_invoice_items | discount_pct | numeric | numeric | YES |  | 5 | 2 |  |
| purchase_invoice_items | discount_amount | numeric | numeric | NO | 0 | 12 | 2 |  |
| purchase_invoice_items | gst_rate | numeric | numeric | NO |  | 5 | 2 |  |
| purchase_invoice_items | gst_amount | numeric | numeric | NO | 0 | 12 | 2 |  |
| purchase_invoice_items | mrp | numeric | numeric | YES |  | 12 | 2 |  |
| purchase_invoice_items | sale_rate | numeric | numeric | YES |  | 12 | 2 |  |
| purchase_invoice_items | line_total | numeric | numeric | NO |  | 14 | 2 |  |
| purchase_invoice_items | created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP |  |  | 3 |
| purchase_invoices | id | text | text | NO |  |  |  |  |
| purchase_invoices | tenant_id | text | text | NO |  |  |  |  |
| purchase_invoices | invoice_no | text | text | NO |  |  |  |  |
| purchase_invoices | supplier_id | text | text | NO |  |  |  |  |
| purchase_invoices | supplier_invoice_no | text | text | YES |  |  |  |  |
| purchase_invoices | invoice_date | timestamp without time zone | timestamp | NO |  |  |  | 3 |
| purchase_invoices | status | USER-DEFINED | InvoiceStatus | NO | 'DRAFT'::"InvoiceStatus" |  |  |  |
| purchase_invoices | gross_amount | numeric | numeric | NO |  | 14 | 2 |  |
| purchase_invoices | total_discount | numeric | numeric | NO | 0 | 14 | 2 |  |
| purchase_invoices | total_tax | numeric | numeric | NO | 0 | 14 | 2 |  |
| purchase_invoices | round_off | numeric | numeric | NO | 0 | 10 | 2 |  |
| purchase_invoices | net_amount | numeric | numeric | NO |  | 14 | 2 |  |
| purchase_invoices | notes | text | text | YES |  |  |  |  |
| purchase_invoices | created_by | text | text | YES |  |  |  |  |
| purchase_invoices | finalized_at | timestamp without time zone | timestamp | YES |  |  |  | 3 |
| purchase_invoices | cancelled_at | timestamp without time zone | timestamp | YES |  |  |  | 3 |
| purchase_invoices | cancelled_by | text | text | YES |  |  |  |  |
| purchase_invoices | created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP |  |  | 3 |
| purchase_invoices | updated_at | timestamp without time zone | timestamp | NO |  |  |  | 3 |
| tenants | id | text | text | NO |  |  |  |  |
| tenants | slug | text | text | NO |  |  |  |  |
| tenants | business_name | text | text | NO |  |  |  |  |
| tenants | created_at | timestamp without time zone | timestamp | NO | CURRENT_TIMESTAMP |  |  | 3 |
| tenants | updated_at | timestamp without time zone | timestamp | NO |  |  |  | 3 |

### Constraints

```json
[
  {
    "table_name": "memberships",
    "constraint_name": "memberships_pkey",
    "constraint_type": "PRIMARY KEY",
    "definition": "PRIMARY KEY (id)"
  },
  {
    "table_name": "memberships",
    "constraint_name": "memberships_role_id_fkey",
    "constraint_type": "FOREIGN KEY",
    "definition": "FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT"
  },
  {
    "table_name": "memberships",
    "constraint_name": "memberships_tenant_id_fkey",
    "constraint_type": "FOREIGN KEY",
    "definition": "FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE"
  },
  {
    "table_name": "memberships",
    "constraint_name": "memberships_user_id_fkey",
    "constraint_type": "FOREIGN KEY",
    "definition": "FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE"
  },
  {
    "table_name": "purchase_invoice_items",
    "constraint_name": "purchase_invoice_items_pkey",
    "constraint_type": "PRIMARY KEY",
    "definition": "PRIMARY KEY (id)"
  },
  {
    "table_name": "purchase_invoice_items",
    "constraint_name": "purchase_invoice_items_product_id_fkey",
    "constraint_type": "FOREIGN KEY",
    "definition": "FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT"
  },
  {
    "table_name": "purchase_invoice_items",
    "constraint_name": "purchase_invoice_items_purchase_id_fkey",
    "constraint_type": "FOREIGN KEY",
    "definition": "FOREIGN KEY (purchase_id) REFERENCES purchase_invoices(id) ON UPDATE CASCADE ON DELETE CASCADE"
  },
  {
    "table_name": "purchase_invoice_items",
    "constraint_name": "purchase_invoice_items_tenant_id_fkey",
    "constraint_type": "FOREIGN KEY",
    "definition": "FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE"
  },
  {
    "table_name": "purchase_invoices",
    "constraint_name": "purchase_invoices_pkey",
    "constraint_type": "PRIMARY KEY",
    "definition": "PRIMARY KEY (id)"
  },
  {
    "table_name": "purchase_invoices",
    "constraint_name": "purchase_invoices_supplier_id_fkey",
    "constraint_type": "FOREIGN KEY",
    "definition": "FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT"
  },
  {
    "table_name": "purchase_invoices",
    "constraint_name": "purchase_invoices_tenant_id_fkey",
    "constraint_type": "FOREIGN KEY",
    "definition": "FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE"
  },
  {
    "table_name": "tenants",
    "constraint_name": "tenants_pkey",
    "constraint_type": "PRIMARY KEY",
    "definition": "PRIMARY KEY (id)"
  }
]
```

### Indexes

```json
[
  {
    "schemaname": "public",
    "tablename": "memberships",
    "indexname": "memberships_pkey",
    "indexdef": "CREATE UNIQUE INDEX memberships_pkey ON public.memberships USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "memberships",
    "indexname": "memberships_tenant_id_idx",
    "indexdef": "CREATE INDEX memberships_tenant_id_idx ON public.memberships USING btree (tenant_id)"
  },
  {
    "schemaname": "public",
    "tablename": "memberships",
    "indexname": "memberships_tenant_id_user_id_key",
    "indexdef": "CREATE UNIQUE INDEX memberships_tenant_id_user_id_key ON public.memberships USING btree (tenant_id, user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "memberships",
    "indexname": "memberships_user_id_idx",
    "indexdef": "CREATE INDEX memberships_user_id_idx ON public.memberships USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoice_items",
    "indexname": "purchase_invoice_items_pkey",
    "indexdef": "CREATE UNIQUE INDEX purchase_invoice_items_pkey ON public.purchase_invoice_items USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoice_items",
    "indexname": "purchase_invoice_items_product_id_idx",
    "indexdef": "CREATE INDEX purchase_invoice_items_product_id_idx ON public.purchase_invoice_items USING btree (product_id)"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoice_items",
    "indexname": "purchase_invoice_items_purchase_id_idx",
    "indexdef": "CREATE INDEX purchase_invoice_items_purchase_id_idx ON public.purchase_invoice_items USING btree (purchase_id)"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoice_items",
    "indexname": "purchase_invoice_items_tenant_id_idx",
    "indexdef": "CREATE INDEX purchase_invoice_items_tenant_id_idx ON public.purchase_invoice_items USING btree (tenant_id)"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoices",
    "indexname": "purchase_invoices_pkey",
    "indexdef": "CREATE UNIQUE INDEX purchase_invoices_pkey ON public.purchase_invoices USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoices",
    "indexname": "purchase_invoices_tenant_id_idx",
    "indexdef": "CREATE INDEX purchase_invoices_tenant_id_idx ON public.purchase_invoices USING btree (tenant_id)"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoices",
    "indexname": "purchase_invoices_tenant_id_invoice_date_idx",
    "indexdef": "CREATE INDEX purchase_invoices_tenant_id_invoice_date_idx ON public.purchase_invoices USING btree (tenant_id, invoice_date)"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoices",
    "indexname": "purchase_invoices_tenant_id_invoice_no_key",
    "indexdef": "CREATE UNIQUE INDEX purchase_invoices_tenant_id_invoice_no_key ON public.purchase_invoices USING btree (tenant_id, invoice_no)"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoices",
    "indexname": "purchase_invoices_tenant_id_status_idx",
    "indexdef": "CREATE INDEX purchase_invoices_tenant_id_status_idx ON public.purchase_invoices USING btree (tenant_id, status)"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoices",
    "indexname": "purchase_invoices_tenant_id_supplier_id_idx",
    "indexdef": "CREATE INDEX purchase_invoices_tenant_id_supplier_id_idx ON public.purchase_invoices USING btree (tenant_id, supplier_id)"
  },
  {
    "schemaname": "public",
    "tablename": "tenants",
    "indexname": "tenants_pkey",
    "indexdef": "CREATE UNIQUE INDEX tenants_pkey ON public.tenants USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "tenants",
    "indexname": "tenants_slug_idx",
    "indexdef": "CREATE INDEX tenants_slug_idx ON public.tenants USING btree (slug)"
  },
  {
    "schemaname": "public",
    "tablename": "tenants",
    "indexname": "tenants_slug_key",
    "indexdef": "CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug)"
  }
]
```

## GST enum inventory

Observed enum labels and order:

```json
[]
```

Expected repository enum labels and order:

```json
{
  "PurchaseGstReconciliationStatus": [
    "NOT_RECONCILED",
    "MATCHED",
    "DISCREPANCY_REQUIRES_REVIEW",
    "RESOLVED"
  ],
  "PurchaseGstAccountingAcceptanceStatus": [
    "NOT_ACCEPTED",
    "ACCEPTED"
  ],
  "PurchaseGstEvidenceRevisionKind": [
    "INITIAL",
    "CORRECTION"
  ],
  "PurchaseGstReconciliationEventKind": [
    "EVIDENCE_CAPTURED",
    "CALCULATION_RECORDED",
    "MATCHED",
    "DISCREPANCY_REQUIRES_REVIEW",
    "RESOLVED",
    "ACCOUNTING_ACCEPTED",
    "CORRECTED"
  ]
}
```

## Policies and privileges

### Policies

```json
[
  {
    "schemaname": "public",
    "tablename": "memberships",
    "policyname": "tenant_isolation_policy",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(tenant_id = jwt_tenant_id())",
    "with_check_expression": "(tenant_id = jwt_tenant_id())"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoice_items",
    "policyname": "tenant_isolation_policy",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(tenant_id = jwt_tenant_id())",
    "with_check_expression": "(tenant_id = jwt_tenant_id())"
  },
  {
    "schemaname": "public",
    "tablename": "purchase_invoices",
    "policyname": "tenant_isolation_policy",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(tenant_id = jwt_tenant_id())",
    "with_check_expression": "(tenant_id = jwt_tenant_id())"
  },
  {
    "schemaname": "public",
    "tablename": "tenants",
    "policyname": "tenant_isolation_policy",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "using_expression": "(id = jwt_tenant_id())",
    "with_check_expression": "(id = jwt_tenant_id())"
  }
]
```

### Table grants

```json
[
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "anon",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "anon",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "anon",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "anon",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "anon",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "anon",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "anon",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "authenticated",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "authenticated",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "authenticated",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "authenticated",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "authenticated",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "authenticated",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "authenticated",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "postgres",
    "privilege_type": "DELETE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "postgres",
    "privilege_type": "INSERT",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "postgres",
    "privilege_type": "REFERENCES",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "postgres",
    "privilege_type": "SELECT",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "postgres",
    "privilege_type": "TRIGGER",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "postgres",
    "privilege_type": "TRUNCATE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "memberships",
    "grantee": "postgres",
    "privilege_type": "UPDATE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "anon",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "anon",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "anon",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "anon",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "anon",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "anon",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "anon",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "authenticated",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "authenticated",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "authenticated",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "authenticated",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "authenticated",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "authenticated",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "authenticated",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "postgres",
    "privilege_type": "DELETE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "postgres",
    "privilege_type": "INSERT",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "postgres",
    "privilege_type": "REFERENCES",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "postgres",
    "privilege_type": "SELECT",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "postgres",
    "privilege_type": "TRIGGER",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "postgres",
    "privilege_type": "TRUNCATE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoice_items",
    "grantee": "postgres",
    "privilege_type": "UPDATE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "anon",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "anon",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "anon",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "anon",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "anon",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "anon",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "anon",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "authenticated",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "authenticated",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "authenticated",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "authenticated",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "authenticated",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "authenticated",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "authenticated",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "postgres",
    "privilege_type": "DELETE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "postgres",
    "privilege_type": "INSERT",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "postgres",
    "privilege_type": "REFERENCES",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "postgres",
    "privilege_type": "SELECT",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "postgres",
    "privilege_type": "TRIGGER",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "postgres",
    "privilege_type": "TRUNCATE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "purchase_invoices",
    "grantee": "postgres",
    "privilege_type": "UPDATE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "anon",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "anon",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "anon",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "anon",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "anon",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "anon",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "anon",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "authenticated",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "authenticated",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "authenticated",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "authenticated",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "authenticated",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "authenticated",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "authenticated",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "postgres",
    "privilege_type": "DELETE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "postgres",
    "privilege_type": "INSERT",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "postgres",
    "privilege_type": "REFERENCES",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "postgres",
    "privilege_type": "SELECT",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "postgres",
    "privilege_type": "TRIGGER",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "postgres",
    "privilege_type": "TRUNCATE",
    "is_grantable": "YES"
  },
  {
    "table_schema": "public",
    "table_name": "tenants",
    "grantee": "postgres",
    "privilege_type": "UPDATE",
    "is_grantable": "YES"
  }
]
```

### public schema grants

```json
[]
```

The initial schema-grants query failed with PostgreSQL error category
`42P01` because PostgreSQL does not provide the queried
`information_schema.role_schema_grants` relation in this database. The gap
was closed with read-only `pg_namespace` ACL metadata,
`aclexplode(...)`, `has_schema_privilege(...)`, and `pg_auth_members`
queries.

### Corrected `public` schema privilege evidence

Effective privileges for the named roles:

| Role | `USAGE` | `CREATE` | Evidence |
|---|---:|---:|---|
| `anon` | true | false | `has_schema_privilege` |
| `authenticated` | true | false | `has_schema_privilege` |
| `postgres` (connected role) | true | true | `has_schema_privilege` |

The explicit ACL metadata for `public` reported:

```text
{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,
postgres=U/pg_database_owner,anon=U/pg_database_owner,
authenticated=U/pg_database_owner,service_role=U/pg_database_owner,
prisma=UC/pg_database_owner}
```

Interpreted ACL entries:

- `PUBLIC`, `anon`, `authenticated`, `postgres`, and `service_role` have
  explicit `USAGE` entries.
- `pg_database_owner` and `prisma` have explicit `USAGE` and `CREATE`
  entries.
- The ACL entries report no grant option for the named roles inspected.
- `postgres` also inherits roles including `anon`, `authenticated`, `prisma`,
  and `service_role`; effective privileges must therefore not be treated as
  proof of direct grants or ordinary-role behavior.
- No default-privilege state was inferred from this result. The ACL query
  expanded the effective namespace ACL when the namespace ACL was null, but
  default-privilege configuration remains a separate catalog review item.

This corrected evidence resolves the schema-grants query gap for the inspected
privileges. It does not approve a final grant model and does not establish
tenant isolation because the connected role has `BYPASSRLS=true`.

### public.jwt_tenant_id()

Function metadata:

```json
[
  {
    "schema_name": "public",
    "function_name": "jwt_tenant_id",
    "identity_arguments": "",
    "owner": "postgres",
    "security_definer": false,
    "leakproof": false,
    "volatility": "s",
    "return_type": "text",
    "definition": "CREATE OR REPLACE FUNCTION public.jwt_tenant_id()\n RETURNS text\n LANGUAGE sql\n STABLE PARALLEL SAFE\n SET search_path TO ''\nAS $function$\n  SELECT NULLIF(\n    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::text,\n    ''\n  );\n$function$\n"
  }
]
```

Execute privileges:

```json
[
  {
    "grantee": "PUBLIC",
    "privilege_type": "EXECUTE",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "privilege_type": "EXECUTE",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "privilege_type": "EXECUTE",
    "is_grantable": "NO"
  },
  {
    "grantee": "postgres",
    "privilege_type": "EXECUTE",
    "is_grantable": "YES"
  }
]
```

## Target conflict inventory

Proposed table/type names:

```json
[
  {
    "schema_name": "public",
    "object_name": "memberships",
    "object_kind": "table"
  },
  {
    "schema_name": "public",
    "object_name": "purchase_invoice_items",
    "object_kind": "table"
  },
  {
    "schema_name": "public",
    "object_name": "purchase_invoices",
    "object_kind": "table"
  },
  {
    "schema_name": "public",
    "object_name": "tenants",
    "object_kind": "table"
  }
]
```

Explicitly mapped target FK names observed:

```json
[]
```

## Live versus repository/design comparison

| Surface | Expected | Directly observed | Status |
|---|---|---|---|
| Approved project identity | lizyjqkckysgvffwcqvb | Marker matched; database postgres; role postgres | Confirmed for this capture |
| Connected role | Non-bypass role required for RLS proof | rolsuper=false; rolbypassrls=true | RLS proof blocked |
| Parent tables | tenants, purchase_invoices, purchase_invoice_items, memberships | tenants, purchase_invoices, purchase_invoice_items, memberships | Present |
| GST/posting tables | purchase_posting_operations, purchase_gst_evidence_revisions, purchase_gst_line_evidence, purchase_gst_calculations, purchase_gst_accounting_decisions, purchase_gst_reconciliation_events, purchase_gst_reconciliation_event_lines | none | Missing where absent |
| GST enums | Four exact Prisma enums | none | Missing where absent |
| Invoice GST/version fields | Six fields; pointers nullable; statuses/version non-null | See columns above | Catalog result only; rows not inspected |
| Keys/indexes/FKs | Exact Prisma/design targets | See constraints/indexes above | Catalog result only; data compatibility untested |
| RLS/grants | Approval and non-bypass testing required | See sections above | Not approved by this baseline |
| jwt_tenant_id | app_metadata and fail-closed behavior | See function definition above | Catalog result; ordinary-role behavior untested |

## Reproduction query descriptions

- Identity: current_database, current_user, server address/port/version, and pg_roles.
- Tables: pg_class and pg_namespace ownership plus RLS flags.
- Columns: information_schema.columns for public parent and GST/posting names.
- Constraints: pg_constraint and pg_get_constraintdef.
- Indexes: pg_indexes.
- Enums: pg_type, pg_namespace, and pg_enum ordered by enum sort order.
- Policies: pg_policies with command, roles, USING, and WITH CHECK.
- Table privileges: role_table_grants and routine_privileges; schema
  privileges: pg_namespace ACLs expanded with aclexplode(...),
  has_schema_privilege(...), and direct pg_auth_members rows.
- Helper: pg_proc, pg_get_functiondef, and function identity metadata.
- Conflicts: pg_class/pg_type and mapped FK names in pg_constraint.

## Inspection gaps and limitations
```json
[
  {
    "label": "schema grants",
    "category": "postgres_error_42P01",
    "status": "resolved by corrected pg_namespace ACL and privilege-function queries",
    "cause": "information_schema.role_schema_grants does not exist in this database"
  }
]
```
- Business rows were not queried; pointer validity, duplicate-key conflicts, backfill impact, and existing data compatibility remain unverified.
- The connected role has BYPASSRLS=true; cross-tenant behavior was not tested.
- This artifact is metadata evidence, not a database snapshot or proof of immutability.
- Historical findings were not substituted for this capture.
- calculation_id, final RLS posture, and final grant model remain unresolved.
- Default privileges and complete inherited-role closure were not independently
  enumerated; only the inspected ACL entries, named-role effective privileges,
  and direct membership rows are recorded.

## Repository cross-check

The captured catalog results were compared read-only with:

- `prisma/schema.prisma`
- `.obsidian-vault/specs/gst-schema-rollout-design-review.md`
- `.obsidian-vault/specs/gst-audit-validation-and-plan.md`
- `scripts/rls-rollout-verifier.mjs`

Cross-check discrepancies and limitations:

- The live catalog lacks the four GST enums, six `purchase_invoices`
  GST/version fields, seven GST/posting tables, and required tenant-aware
  composite keys described by the Prisma/design expectations.
- The live parent purchase-item relationship remains purchase-ID-only in the
  captured metadata; compatibility with the proposed tenant-aware relation
  requires a data-aware review.
- The live parent tables have RLS enabled but not forced, and the captured
  privileges are broad for `anon` and `authenticated`; the final RLS and grant
  model remain unapproved.
- `scripts/rls-rollout-verifier.mjs` is a snapshot-only contract checker; this
  baseline does not treat it as a live runtime verifier.
- No live data rows were read, so pointer validity, uniqueness conflicts,
  backfill safety, and foreign-key validation remain open.

## Approval review package

This section is review evidence and proposed next-step criteria only. It does
not grant approval or authorize schema rollout.

### A. Confirmed schema gaps

Direct catalog observations show that the live `public` schema is missing:

- all seven GST/posting tables;
- all four GST enum types and their required labels;
- all six GST/version fields on `purchase_invoices`;
- `purchase_invoices(tenant_id,id)` and its three current-pointer supporting
  unique keys;
- `purchase_invoice_items(tenant_id,purchase_id,id)`;
- `memberships(tenant_id,id)`;
- the tenant-aware GST foreign keys and current-pointer foreign keys required
  by the Prisma/design model.

The parent tables do exist, with RLS enabled but not forced. The existing
purchase-item foreign key is purchase-ID-only in the captured metadata and is
not equivalent to the proposed tenant-aware composite relationship.

### B. Security and integrity decisions requiring approval

#### Grant and RLS model

Pending database-owner and Security/Architecture approval:

1. restricted backend/application role with no direct browser CRUD;
2. controlled database write functions with narrowly scoped execution
   privileges; or
3. another explicitly documented model with least privilege, tenant policy,
   bypass-role handling, and immutable-history controls.

Evidence required for any option:

- approved role and privilege matrix, including schema, table, sequence,
  function, and default privileges;
- non-superuser, non-`BYPASSRLS` runtime tests;
- same-tenant authorization and cross-tenant read/write denial;
- verification of immutable evidence, calculation, decision, and event
  behavior;
- explicit forced-RLS decision.

#### `calculation_id`

Pending product/accounting, database-owner, and Security/Architecture
decision:

- **Option A:** retain an application-validated scalar with no database FK;
  requires transaction-scoped tenant/invoice validation and accepts the risk
  of database-level orphan/cross-scope references.
- **Option B:** add the proposed tenant- and invoice-scoped composite FK and
  corresponding Prisma relations; requires schema validation, relation-name
  conflict checks, referenced-key verification, and migration review.

No option is selected by this artifact.

### C. Disposable-database test requirements

Before any shared or production-like execution, tests must cover:

- additive schema creation and Prisma client compatibility;
- exact enum labels/order, columns, defaults, nullability, keys, indexes, and
  mapped constraints;
- tenant-aware foreign keys and composite uniqueness;
- current-pointer integrity and nullable legacy pointers;
- RLS with a non-superuser, non-`BYPASSRLS` role;
- authorized same-tenant access and denied cross-tenant reads/writes;
- least-privilege schema/table/function grants;
- evidence, calculation, accounting-decision, reconciliation-event, and
  event-line relationships;
- purchase posting idempotency, transaction failure handling, and retry
  behavior;
- rollback limits, partial-application recovery, and repeatability/idempotency;
- post-execution catalog verification against Prisma and the approved design.

These are proposed test requirements, not completed test results.

### D. Approval checklist

| Reviewer | Required decision/evidence | Status |
|---|---|---|
| Database owner | Target identity, schema baseline, DDL sequencing, lock/timeout plan, rollback limits | Pending |
| Security/Architecture | Final grants, forced-RLS posture, policy commands, bypass-role treatment, non-bypass tests | Pending |
| Application/financial integrity | Prisma compatibility, posting invariants, pointer/backfill treatment, failure and retry behavior | Pending |
| Product/accounting owner | `calculation_id` option, accounting acceptance semantics, workflow authority | Pending |
| Qualified GST reviewer | Covered GST rules and evidence/reconciliation interpretation | Pending |

No approval is evidenced by this artifact. Database rollout remains NO-GO.

## Capture integrity

SHA-256: 85e45069e72c4881fd129f5d048fb7bfb19b774b63a67e0294f2ced3c07a7688

Hash scope: complete artifact text with the hash value replaced by the literal PENDING_CANONICAL_HASH; this is an integrity check for the saved text under that canonicalization rule, not a database snapshot.

## Recommendation

**Database rollout remains NO-GO.**
