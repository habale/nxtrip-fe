import type { Session } from '@supabase/supabase-js';
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from './auth-context';
import { getAuthClient, type AuthClient } from './auth-client';
import {
  clearPendingSignupLanguage,
  rememberSignupLanguage,
} from '../../shared/i18n';

type AuthProviderProps = PropsWithChildren<{
  client?: AuthClient;
}>;

function normalizeError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error('An unexpected authentication error occurred.');
}

export function AuthProvider({ client, children }: AuthProviderProps) {
  const [resolvedClient] = useState(() => {
    try {
      return { client: client ?? getAuthClient(), error: null };
    } catch (caughtError) {
      return { client: null, error: normalizeError(caughtError) };
    }
  });
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    resolvedClient.error ? 'ready' : 'loading',
  );
  const [error, setError] = useState<Error | null>(resolvedClient.error);
  const authClient = resolvedClient.client;

  useEffect(() => {
    if (!authClient) return;

    let active = true;
    let authEventVersion = 0;
    const {
      data: { subscription },
    } = authClient.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      authEventVersion += 1;
      setSession(nextSession);
      setError(null);
      setStatus('ready');
    });

    const sessionRequestVersion = authEventVersion;
    void authClient
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || authEventVersion !== sessionRequestVersion) return;
        if (sessionError) throw sessionError;

        setSession(data.session);
        setError(null);
        setStatus('ready');
      })
      .catch((caughtError: unknown) => {
        if (!active) return;

        setSession(null);
        setError(normalizeError(caughtError));
        setStatus('ready');
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [authClient]);

  const signInWithGoogle = useCallback(
    async (returnTo = '/home') => {
      if (!authClient) {
        throw error ?? new Error('Authentication is not configured.');
      }

      setError(null);
      const safeReturnTo =
        returnTo.startsWith('/') && !returnTo.startsWith('//')
          ? returnTo
          : '/home';
      rememberSignupLanguage();
      const { error: signInError } = await authClient.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: new URL(safeReturnTo, window.location.origin).toString(),
        },
      });

      if (signInError) {
        clearPendingSignupLanguage();
        setError(signInError);
        throw signInError;
      }
    },
    [authClient, error],
  );

  const signOut = useCallback(async () => {
    if (!authClient) {
      throw error ?? new Error('Authentication is not configured.');
    }

    setError(null);
    const { error: signOutError } = await authClient.signOut({
      scope: 'local',
    });

    if (signOutError) {
      setError(signOutError);
      throw signOutError;
    }

    setSession(null);
  }, [authClient, error]);

  const signInAsGuest = useCallback(async () => {
    if (!authClient) {
      throw error ?? new Error('Authentication is not configured.');
    }

    setError(null);
    const { error: signInError } = await authClient.signInAnonymously();
    if (signInError) {
      setError(signInError);
      throw signInError;
    }
  }, [authClient, error]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      status,
      error,
      signInWithGoogle,
      signInAsGuest,
      signOut,
    }),
    [error, session, signInAsGuest, signInWithGoogle, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
