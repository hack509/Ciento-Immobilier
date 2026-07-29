import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getEnv } from '@/lib/env';

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient() {
  if (client) return client;

  const { supabaseUrl, supabaseAnonKey } = getEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase client not configured. ' +
      'Copy .env.example to .env and fill in your Supabase credentials.'
    );
  }

  client = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop) {
    return getSupabaseClient()[prop as keyof ReturnType<typeof createClient<Database>>];
  },
});
