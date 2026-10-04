import type { Session } from '@supabase/supabase-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AuthClient } from '../features/auth/auth-client';
import { App } from './App';
import { AppProviders } from './providers/AppProviders';
import { changeLanguage } from '../shared/i18n';

describe('App', () => {
  beforeEach(() => {
    changeLanguage('en');
    window.history.replaceState({}, '', '/');
  });

  it('renders the authenticated root route inside application providers', async () => {
    const session = {
      user: { id: 'user-123' },
    } as Session;
    const authClient = {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
    } satisfies AuthClient;

    render(
      <AppProviders authClient={authClient}>
        <App />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Hey, Traveler! 👋',
      }),
    ).toBeInTheDocument();
  });

  it('redirects to login after signing out from settings', async () => {
    const user = userEvent.setup();
    const session = {
      user: { id: 'user-123' },
    } as Session;
    const authClient = {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: async () => ({ error: null }),
      signOut: vi.fn(async () => ({ error: null })),
    } satisfies AuthClient;
    window.history.replaceState({}, '', '/settings');

    render(
      <AppProviders authClient={authClient}>
        <App />
      </AppProviders>,
    );
    await user.click(await screen.findByText('Sign out'));

    expect(authClient.signOut).toHaveBeenCalledWith({ scope: 'local' });
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });
});
