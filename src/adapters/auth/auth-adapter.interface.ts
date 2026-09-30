export type AuthUser = {
  id: string;
  externalId?: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
};

export type AuthSession = {
  user: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
};

export type SignUpParams = {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  redirectTo?: string;
};

export type SignInParams = {
  email: string;
  password: string;
  remember?: boolean;
};

export type InviteParams = {
  email: string;
  fullName?: string;
  tenantId: string;
  roleId: string;
  invitedBy: string;
  redirectTo?: string;
};

export type PasswordResetParams = {
  email: string;
  redirectTo?: string;
};

export type UpdatePasswordParams = {
  newPassword: string;
};

export interface IAuthAdapter {
  getCurrentSession(): Promise<AuthSession | null>;
  signUp(params: SignUpParams): Promise<{ user: AuthUser; needsVerification: boolean }>;
  signIn(params: SignInParams): Promise<AuthSession>;
  signOut(): Promise<void>;
  inviteUser(params: InviteParams): Promise<void>;
  sendPasswordReset(params: PasswordResetParams): Promise<void>;
  updatePassword(params: UpdatePasswordParams): Promise<void>;
  verifyOtp?(email: string, token: string, type: "signup" | "recovery"): Promise<AuthSession>;
  setAppMetadataTenantId(externalUserId: string, tenantId: string): Promise<void>;
}
