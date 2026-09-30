import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type {
  IAuthAdapter,
  AuthUser,
  AuthSession,
  SignUpParams,
  SignInParams,
  InviteParams,
  PasswordResetParams,
  UpdatePasswordParams,
} from "./auth-adapter.interface";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertEnvConfigured(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}

function mapSupabaseUser(u: {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string; phone?: string; avatar_url?: string } | null;
  identities?: Array<{ id: string } | null>;
  email_confirmed_at?: Date | string | null;
}): AuthUser {
  return {
    id: u.id,
    externalId: u.id,
    email: u.email ?? "",
    fullName: u.user_metadata?.full_name ?? null,
    phone: u.user_metadata?.phone ?? null,
    avatarUrl: u.user_metadata?.avatar_url ?? null,
    emailVerified: !!u.email_confirmed_at,
  };
}

function createAnonClient() {
  assertEnvConfigured();
  const cookieStore = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components can't set cookies
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Server Components can't set cookies
        }
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

function createServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase service role is not configured.");
  }
  return createServerClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export class SupabaseAuthAdapter implements IAuthAdapter {
  async getCurrentSession(): Promise<AuthSession | null> {
    const sb = createAnonClient();
    const {
      data: { session },
      error,
    } = await sb.auth.getSession();
    if (error || !session?.user) return null;
    return {
      user: mapSupabaseUser(session.user),
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  async signUp(params: SignUpParams): Promise<{ user: AuthUser; needsVerification: boolean }> {
    const sb = createAnonClient();
    const { data, error } = await sb.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          full_name: params.fullName,
          phone: params.phone,
        },
        emailRedirectTo: params.redirectTo,
      },
    });
    if (error) throw error;
    const user = data.user ? mapSupabaseUser(data.user) : null;
    if (!user) throw new Error("Sign-up returned no user.");
    return {
      user,
      needsVerification: !user.emailVerified,
    };
  }

  async signIn(params: SignInParams): Promise<AuthSession> {
    const sb = createAnonClient();
    const { data, error } = await sb.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });
    if (error) throw error;
    if (!data.user) throw new Error("Sign-in returned no user.");
    return {
      user: mapSupabaseUser(data.user),
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      expiresAt: data.session?.expires_at ? new Date(data.session.expires_at * 1000) : undefined,
    };
  }

  async signOut(): Promise<void> {
    const sb = createAnonClient();
    await sb.auth.signOut();
  }

  async inviteUser(params: InviteParams): Promise<void> {
    const sb = createServiceClient();
    const { error } = await sb.auth.admin.inviteUserByEmail(params.email, {
      data: {
        full_name: params.fullName,
        tenant_id: params.tenantId,
        role_id: params.roleId,
        invited_by: params.invitedBy,
      },
      redirectTo: params.redirectTo,
    });
    if (error) throw error;
  }

  async sendPasswordReset(params: PasswordResetParams): Promise<void> {
    const sb = createAnonClient();
    const { error } = await sb.auth.resetPasswordForEmail(params.email, {
      redirectTo: params.redirectTo,
    });
    if (error) throw error;
  }

  async updatePassword(params: UpdatePasswordParams): Promise<void> {
    const sb = createAnonClient();
    const { error } = await sb.auth.updateUser({ password: params.newPassword });
    if (error) throw error;
  }

  async verifyOtp(email: string, token: string, type: "signup" | "recovery"): Promise<AuthSession> {
    const sb = createAnonClient();
    const { data, error } = await sb.auth.verifyOtp({ email, token, type });
    if (error) throw error;
    if (!data.user) throw new Error("OTP verification returned no user.");
    return {
      user: mapSupabaseUser(data.user),
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      expiresAt: data.session?.expires_at ? new Date(data.session.expires_at * 1000) : undefined,
    };
  }

  async setAppMetadataTenantId(externalUserId: string, tenantId: string): Promise<void> {
    if (!externalUserId || !tenantId) return;
    const sb = createServiceClient();
    const { error } = await sb.auth.admin.updateUserById(externalUserId, {
      app_metadata: { tenant_id: tenantId },
    });
    if (error) throw error;
  }
}

export const authAdapter: IAuthAdapter = new SupabaseAuthAdapter();
