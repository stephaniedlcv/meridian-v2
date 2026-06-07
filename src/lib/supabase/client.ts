'use client';

import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

let supabaseBrowserClient: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

export function createClient() {
  if (supabaseBrowserClient) {
    return supabaseBrowserClient;
  }

  supabaseBrowserClient = createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
  );

  return supabaseBrowserClient;
}
