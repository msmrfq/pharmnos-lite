export function describeDatabaseAccessError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Database access failed.";
  if (message.includes("Authentication is required")) {
    return "Database is configured, but you must sign in to access workspace data.";
  }
  if (message.includes("no active tenant membership")) {
    return "Database is configured, but this account has no active workspace membership.";
  }
  if (message.includes("Supabase environment variables are missing")) {
    return "Supabase authentication is not configured for this runtime.";
  }
  if (message.includes("DATABASE_URL")) {
    return "Database configuration is incomplete. Check the server environment.";
  }
  return "Workspace data could not be loaded. Check the database connection and try again.";
}
