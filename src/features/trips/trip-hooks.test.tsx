import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import { useTripList } from './trip-hooks';
import type { TripListItem, TripRepository } from './trip-repository';

const tripItem: TripListItem = {
  trip: {
    id: 'trip-123',
    name: 'Thailand',
    description: 'Street food and island hopping',
    start_at: '2026-10-15T00:00:00.000Z',
    end_at: '2026-10-18T00:00:00.000Z',
    timezone: 'Asia/Bangkok',
    status: 'ongoing',
    default_currency: 'THB',
    cover_image_path: null,
    cover_thumbnail_path: null,
    created_by: 'user-123',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    version: 1,
    deleted_at: null,
  },
  members: [
    {
      id: 'member-123',
      trip_id: 'trip-123',
      display_name: 'Alex',
      avatar_url: null,
    },
  ],
  coverThumbnailUrl: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const auth: AuthContextValue = {
    session: null,
    user: { id: 'user-123' } as User,
    status: 'ready',
    error: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  };

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <AuthContext.Provider value={auth}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </AuthContext.Provider>
    );
  };
}

function TripListProbe({ repository }: { repository: TripRepository }) {
  const tripList = useTripList(repository);
  const names = tripList.data?.map(({ trip }) => trip.name).join(', ');

  return <span>{names === '' ? 'empty' : (names ?? 'loading')}</span>;
}

describe('trip list hook', () => {
  it('loads accessible trips for the authenticated user', async () => {
    const repository = {
      listAccessible: vi.fn(async () => [tripItem]),
      getAccessibleById: vi.fn(),
      create: vi.fn(),
    } satisfies TripRepository;

    render(<TripListProbe repository={repository} />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByText('Thailand')).toBeInTheDocument();
    expect(repository.listAccessible).toHaveBeenCalledWith('user-123');
  });

  it('supports an empty trip list', async () => {
    const repository = {
      listAccessible: vi.fn(async () => []),
      getAccessibleById: vi.fn(),
      create: vi.fn(),
    } satisfies TripRepository;

    render(<TripListProbe repository={repository} />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByText('empty')).toBeInTheDocument();
  });
});
