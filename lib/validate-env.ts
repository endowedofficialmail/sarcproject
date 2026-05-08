function assertEnvVar(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

/**
 * Fail fast on the server if required env vars are missing.
 * This is intentionally imported from server entrypoints (middleware + root layout).
 */
export function assertRequiredEnv() {
  assertEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  assertEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  assertEnvVar("SUPABASE_SERVICE_ROLE_KEY");
}

// Execute immediately on import (server-side).
assertRequiredEnv();

