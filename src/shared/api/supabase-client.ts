import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

type SupabaseEnvironment = Pick<
  ImportMetaEnv,
  'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'
>;

export type SupabaseClientConfiguration = {
  configured: boolean;
  url: string | null;
  anonKeyPresent: boolean;
};

let client: SupabaseClient<Database> | undefined;

function readConfiguration(
  environment: SupabaseEnvironment = import.meta.env,
): SupabaseEnvironment {
  return {
    VITE_SUPABASE_URL: environment.VITE_SUPABASE_URL?.trim(),
    VITE_SUPABASE_ANON_KEY: environment.VITE_SUPABASE_ANON_KEY?.trim(),
  };
}

export function inspectSupabaseConfiguration(
  environment: SupabaseEnvironment = import.meta.env,
): SupabaseClientConfiguration {
  const configuration = readConfiguration(environment);

  return {
    configured: Boolean(
      configuration.VITE_SUPABASE_URL && configuration.VITE_SUPABASE_ANON_KEY,
    ),
    url: configuration.VITE_SUPABASE_URL || null,
    anonKeyPresent: Boolean(configuration.VITE_SUPABASE_ANON_KEY),
  };
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) {
    return client;
  }

  const configuration = readConfiguration();

  if (
    !configuration.VITE_SUPABASE_URL ||
    !configuration.VITE_SUPABASE_ANON_KEY
  ) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  client = createClient<Database>(
    configuration.VITE_SUPABASE_URL,
    configuration.VITE_SUPABASE_ANON_KEY,
  );

  return client;
}
