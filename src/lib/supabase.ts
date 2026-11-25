import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

const rawEnvUrl = stripWrappingQuotes(
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
);
const rawAnonKey = stripWrappingQuotes(
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
);

function normalizeSupabaseUrl(value: string): {
  valid: boolean;
  normalizedUrl: string;
  issue: string | null;
} {
  if (!value) {
    return { valid: false, normalizedUrl: '', issue: 'VITE_SUPABASE_URL is missing.' };
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        valid: false,
        normalizedUrl: '',
        issue: 'VITE_SUPABASE_URL must start with https://',
      };
    }

    // Detect if a Supabase Dashboard URL was pasted instead of the Project API URL
    if (parsed.hostname === 'supabase.com' || parsed.hostname === 'app.supabase.com') {
      return {
        valid: false,
        normalizedUrl: '',
        issue:
          'VITE_SUPABASE_URL is set to a Supabase Dashboard URL. Use your Project API URL instead (https://<project-ref>.supabase.co).',
      };
    }

    // If a subpath (e.g., /auth/v1, /rest/v1, /storage/v1) was accidentally included on a Supabase project host, strip to origin
    if (
      (parsed.hostname.endsWith('.supabase.co') || parsed.hostname.endsWith('.supabase.in')) &&
      parsed.pathname !== '/' &&
      parsed.pathname !== ''
    ) {
      return {
        valid: true,
        normalizedUrl: parsed.origin,
        issue: null,
      };
    }

    return {
      valid: true,
      normalizedUrl: value.replace(/\/+$/, ''),
      issue: null,
    };
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      issue: 'VITE_SUPABASE_URL is not a valid URL.',
    };
  }
}

const urlCheck = normalizeSupabaseUrl(rawEnvUrl);
const normalizedUrl = urlCheck.normalizedUrl;

export const isSupabaseConfigured = Boolean(
  urlCheck.valid && normalizedUrl && rawAnonKey
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(normalizedUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabaseConfigDetails = {
  hasUrl: urlCheck.valid,
  hasAnonKey: Boolean(rawAnonKey),
  url: normalizedUrl,
  anonKey: rawAnonKey,
  urlIssue: urlCheck.issue,
};

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      urlCheck.issue ??
        'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.'
    );
  }
  return supabase;
}

export interface ConnectionStatus {
  connected: boolean;
  schemaReady: boolean;
  message: string;
}

export async function verifySupabaseConnection(): Promise<ConnectionStatus> {
  if (!supabase) {
    return {
      connected: false,
      schemaReady: false,
      message:
        urlCheck.issue ??
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.',
    };
  }

  try {
    const { error } = await supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return {
          connected: true,
          schemaReady: false,
          message:
            'Connected to Supabase, but database tables are not created yet. Run the SQL migration.',
        };
      }
      return {
        connected: false,
        schemaReady: false,
        message: error.message,
      };
    }

    return {
      connected: true,
      schemaReady: true,
      message: 'Connected to Supabase PostgreSQL and Auth.',
    };
  } catch (err) {
    return {
      connected: false,
      schemaReady: false,
      message: getErrorMessage(err, 'Unable to reach Supabase.'),
    };
  }
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string' &&
    (err as { message: string }).message.trim() !== ''
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

