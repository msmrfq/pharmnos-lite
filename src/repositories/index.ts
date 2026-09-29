import { prisma, type PrismaClient } from "@/lib/db/prisma";
import { TenantRepository } from "./tenant.repository";
import { UserRepository } from "./user.repository";
import { RoleRepository, RolePermissionRepository } from "./role.repository";
import { MembershipRepository } from "./membership.repository";
import { BusinessProfileRepository } from "./business-profile.repository";
import { ProductRepository } from "./product.repository";
import { ProductBatchRepository } from "./product-batch.repository";
import { CustomerRepository } from "./customer.repository";
import { SupplierRepository } from "./supplier.repository";
import { PurchaseInvoiceRepository } from "./purchase-invoice.repository";
import { SalesInvoiceRepository } from "./sales-invoice.repository";
import { StockMovementRepository } from "./stock-movement.repository";
import { CustomerLedgerRepository, SupplierLedgerRepository } from "./ledger.repository";
import { PaymentRepository } from "./payment.repository";
import { AuditLogRepository } from "./audit-log.repository";

export type Repositories = {
  tenants: TenantRepository;
  users: UserRepository;
  roles: RoleRepository;
  rolePermissions: RolePermissionRepository;
  memberships: MembershipRepository;
  businessProfiles: BusinessProfileRepository;
  products: ProductRepository;
  productBatches: ProductBatchRepository;
  customers: CustomerRepository;
  suppliers: SupplierRepository;
  purchaseInvoices: PurchaseInvoiceRepository;
  salesInvoices: SalesInvoiceRepository;
  stockMovements: StockMovementRepository;
  customerLedgers: CustomerLedgerRepository;
  supplierLedgers: SupplierLedgerRepository;
  payments: PaymentRepository;
  auditLogs: AuditLogRepository;
};

export function createRepositories(client: PrismaClient = prisma): Repositories {
  return {
    tenants: new TenantRepository(client),
    users: new UserRepository(client),
    roles: new RoleRepository(client),
    rolePermissions: new RolePermissionRepository(client),
    memberships: new MembershipRepository(client),
    businessProfiles: new BusinessProfileRepository(client),
    products: new ProductRepository(client),
    productBatches: new ProductBatchRepository(client),
    customers: new CustomerRepository(client),
    suppliers: new SupplierRepository(client),
    purchaseInvoices: new PurchaseInvoiceRepository(client),
    salesInvoices: new SalesInvoiceRepository(client),
    stockMovements: new StockMovementRepository(client),
    customerLedgers: new CustomerLedgerRepository(client),
    supplierLedgers: new SupplierLedgerRepository(client),
    payments: new PaymentRepository(client),
    auditLogs: new AuditLogRepository(client),
  };
}

export const repos = createRepositories();

export * from "./tenant.repository";
export * from "./user.repository";
export * from "./role.repository";
export * from "./membership.repository";
export * from "./business-profile.repository";
export * from "./product.repository";
export * from "./product-batch.repository";
export * from "./customer.repository";
export * from "./supplier.repository";
export * from "./purchase-invoice.repository";
export * from "./sales-invoice.repository";
export * from "./stock-movement.repository";
export * from "./ledger.repository";
export * from "./payment.repository";
export * from "./audit-log.repository";
