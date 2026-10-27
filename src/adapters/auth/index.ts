export * from "./auth-adapter.interface";
export {
  SupabaseAuthAdapter,
  authAdapter,
  clearFinancialE2eTestSession,
  installFinancialE2eTestSession,
} from "./supabase-auth.adapter";
export type { IAuthAdapter } from "./auth-adapter.interface";
