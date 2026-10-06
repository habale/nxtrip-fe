import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

export type AuthStatus = 'loading' | 'ready';

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  error: Error | null;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
