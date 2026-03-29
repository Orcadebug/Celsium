// Validates required environment variables at import time.
// Import this module early in the app lifecycle.

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const optional = [
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "FORGESYNC_AGENT_API_TOKEN",
  "FORGESYNC_INTERNAL_SECRET",
  "CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "ALLOWED_ORIGINS",
] as const;

type RequiredKey = (typeof required)[number];
type OptionalKey = (typeof optional)[number];
type EnvKey = RequiredKey | OptionalKey;

const optionalWarnings: Partial<Record<OptionalKey, string>> = {
  GEMINI_API_KEY: "GEMINI_API_KEY not set — embeddings will be disabled",
  FORGESYNC_AGENT_API_TOKEN:
    "FORGESYNC_AGENT_API_TOKEN not set — agent auth will fall back to DB token lookup",
  NEXT_PUBLIC_APP_URL:
    "NEXT_PUBLIC_APP_URL not set — defaulting to http://localhost:3000",
};

class EnvValidationError extends Error {
  constructor(missing: string[]) {
    super(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Check your .env file or deployment config."
    );
    this.name = "EnvValidationError";
  }
}

/** Validate all required env vars and warn about missing optional ones. */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]?.trim()) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new EnvValidationError(missing);
  }

  for (const key of optional) {
    if (!process.env[key]?.trim() && optionalWarnings[key]) {
      console.warn(`[forgesync] ${optionalWarnings[key]}`);
    }
  }
}

/** Typed getter for environment variables. */
export const env = new Proxy({} as Record<EnvKey, string | undefined>, {
  get(_target, prop: string) {
    return process.env[prop] ?? undefined;
  },
}) as Readonly<
  { [K in RequiredKey]: string } & { [K in OptionalKey]: string | undefined }
>;

// Self-validate on import
validateEnv();
