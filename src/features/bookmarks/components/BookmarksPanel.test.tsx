import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import { i18n } from '../../../shared/i18n';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import type { Trip } from '../../trips/trip-repository';
import type { Bookmark, BookmarkRepository } from '../bookmark-repository';
import { BookmarksPanel } from './BookmarksPanel';

const trip = { id: 'trip-1' } as Trip;
const bookmark = {
  id: 'bookmark-1',
  owner_user_id: 'user-1',
  title: 'Night market',
  notes: null,
  address: null,
  latitude: null,
  longitude: null,
  source_type: 'manual',
  source_url: null,
  place_provider: null,
  provider_place_id: null,
  source_trip_id: trip.id,
  source_node_id: null,
  source_data: { category: 'shopping', icon_key: 'shopping' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  version: 1,
  deleted_at: null,
} satisfies Bookmark;

function renderPanel(canManage: boolean) {
  const repository = {
    listForTrip: vi.fn(async () => [bookmark]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  } satisfies BookmarkRepository;
  const auth: AuthContextValue = {
    session: null,
    user: { id: 'user-1' } as User,
    status: 'ready',
    error: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  };

  return render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={auth}>
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { retry: false } },
            })
          }
        >
          <BookmarksPanel
            canManage={canManage}
            repository={repository}
            trip={trip}
          />
        </QueryClientProvider>
      </AuthContext.Provider>
    </I18nextProvider>,
  );
}

describe('BookmarksPanel permissions', () => {
  it('shows management controls only when granted', async () => {
    const readOnly = renderPanel(false);
    expect(await screen.findByText('Night market')).toBeInTheDocument();
    expect(screen.queryByText('+ Add bookmark')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Actions for Night market'),
    ).not.toBeInTheDocument();
    readOnly.unmount();

    renderPanel(true);
    expect(await screen.findByText('+ Add bookmark')).toBeInTheDocument();
    expect(
      await screen.findByLabelText('Actions for Night market'),
    ).toBeInTheDocument();
  });
});
