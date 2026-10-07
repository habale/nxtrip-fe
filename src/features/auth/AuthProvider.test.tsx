import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAuth } from './auth-context';
import type { AuthClient } from './auth-client';
import { AuthProvider } from './AuthProvider';
import {
  detectDeviceLanguage,
  PENDING_SIGNUP_LANGUAGE_KEY,
} from '../../shared/i18n';

function createSession(id = 'user-123'): Session {
  return {
    access_token: 'access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 2_000_000_000,
    refresh_token: 'refresh-token',
    user: {
      id,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  };
}

function createAuthClient(initialSession: Session | null) {
  let listener:
    ((event: AuthChangeEvent, session: Session | null) => void) | undefined;

  const client = {
    getSession: vi.fn(async () => ({
      data: { session: initialSession },
      error: null,
    })),
    onAuthStateChange: vi.fn((callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
    signInAnonymously: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  } satisfies AuthClient;

  return {
    client,
    emit(event: AuthChangeEvent, session: Session | null) {
      listener?.(event, session);
    },
  };
}

function AuthProbe() {
  const { session, status, signInAsGuest, signInWithGoogle, signOut } =
    useAuth();

  return (
    <div>
      <span>{status}</span>
      <span>{session?.user.id ?? 'signed-out'}</span>
      <button type="button" onClick={() => void signInWithGoogle()}>
        Google
      </button>
      <button type="button" onClick={() => void signInAsGuest()}>
        Guest
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    sessionStorage.removeItem(PENDING_SIGNUP_LANGUAGE_KEY);
  });

  it('restores the persisted session and follows auth state changes', async () => {
    const auth = createAuthClient(createSession());

    render(
      <AuthProvider client={auth.client}>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('user-123')).toBeInTheDocument();
    auth.emit('SIGNED_OUT', null);
    expect(await screen.findByText('signed-out')).toBeInTheDocument();
    auth.emit('SIGNED_IN', createSession('user-456'));
    expect(await screen.findByText('user-456')).toBeInTheDocument();
  });

  it('starts Google OAuth with the home redirect URL', async () => {
    const user = userEvent.setup();
    const auth = createAuthClient(null);

    render(
      <AuthProvider client={auth.client}>
        <AuthProbe />
      </AuthProvider>,
    );
    await screen.findByText('ready');
    await user.click(screen.getByRole('button', { name: 'Google' }));

    expect(auth.client.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/home` },
    });
    expect(sessionStorage.getItem(PENDING_SIGNUP_LANGUAGE_KEY)).toBe(
      detectDeviceLanguage(),
    );
  });

  it('starts an anonymous guest session', async () => {
    const user = userEvent.setup();
    const auth = createAuthClient(null);

    render(
      <AuthProvider client={auth.client}>
        <AuthProbe />
      </AuthProvider>,
    );
    await screen.findByText('ready');
    await user.click(screen.getByRole('button', { name: 'Guest' }));

    expect(auth.client.signInAnonymously).toHaveBeenCalledOnce();
  });

  it('signs out locally and clears the current session', async () => {
    const user = userEvent.setup();
    const auth = createAuthClient(createSession());

    render(
      <AuthProvider client={auth.client}>
        <AuthProbe />
      </AuthProvider>,
    );
    expect(await screen.findByText('user-123')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(auth.client.signOut).toHaveBeenCalledWith({ scope: 'local' });
    await waitFor(() =>
      expect(screen.getByText('signed-out')).toBeInTheDocument(),
    );
  });
});
