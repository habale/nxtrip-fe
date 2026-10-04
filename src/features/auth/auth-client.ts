import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { getSupabaseClient } from '../../shared/api/supabase-client';

type AuthResult<TData> = Promise<{
  data: TData;
  error: Error | null;
}>;

export type AuthClient = {
  getSession: () => AuthResult<{ session: Session | null }>;
  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) => {
    data: {
      subscription: {
        unsubscribe: () => void;
      };
    };
  };
  signInWithOAuth: (credentials: {
    provider: 'google';
    options: { redirectTo: string };
  }) => Promise<{ error: Error | null }>;
  signOut: (options: { scope: 'local' }) => Promise<{ error: Error | null }>;
};

export function getAuthClient(): AuthClient {
  return getSupabaseClient().auth;
}
