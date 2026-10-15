import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout, withTimeout } from './timeout';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let client: Promise<SupabaseClient> | null = null;

/**
 * supabase-js is fetched on first use, so it stays out of the first chunk and the first paint never waits for it.
 * A stalled download counts as failed like any other request; asking again joins the same download.
 */
function connect(url: string, key: string): Promise<SupabaseClient> {
  client ??= withTimeout(import('@supabase/supabase-js')).then(
    ({ createClient }) =>
      createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchWithTimeout() },
      }),
    (err: unknown) => {
      // The download failed or stalled (say, offline): let the next call try again.
      client = null;
      throw err;
    },
  );
  return client;
}

/** Loads the site's backend, or null when none is configured (tests, offline dev). */
export const loadSupabase: (() => Promise<SupabaseClient>) | null = url && key ? () => connect(url, key) : null;
