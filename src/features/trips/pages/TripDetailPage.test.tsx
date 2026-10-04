import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppError } from '../../../shared/api/app-error';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import { TripDetailPage } from './TripDetailPage';
import type { Trip, TripRepository } from '../trip-repository';

const trip: Trip = {
  id: 'trip-123',
  name: 'Thailand',
  description: 'Temples, street food, and island time.',
  start_at: '2026-10-14T17:00:00.000Z',
  end_at: '2026-10-17T17:00:00.000Z',
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
};

function createRepository(
  getAccessibleById: TripRepository['getAccessibleById'],
): TripRepository {
  return {
    getAccessibleById,
    listAccessible: vi.fn(async () => []),
    create: vi.fn(async () => 'trip-new'),
    updateMetadata: vi.fn(async () => trip),
    updateCover: vi.fn(async () => trip),
    removeCover: vi.fn(async () => trip),
  };
}

function renderPage(
  section: 'info' | 'itinerary' | 'ledger' | 'attachments' | 'bookmarks',
  repository: TripRepository,
) {
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

  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/trips/${trip.id}/${section}`]}>
          <Routes>
            <Route
              path="/trips/:tripId/:section"
              element={
                <TripDetailPage repository={repository} section={section} />
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('TripDetailPage', () => {
  it('renders the shared shell and all section links', async () => {
    const repository = createRepository(
      vi.fn(async () => ({
        trip,
        role: 'owner' as const,
        coverImageUrl: null,
        coverThumbnailUrl: null,
      })),
    );
    renderPage('info', repository);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Thailand' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Oct 15 – Oct 18, 2026')).toHaveLength(2);
    expect(screen.getByText(/4 days 3 nights/)).toBeInTheDocument();
    expect(screen.getByLabelText('Attachments')).toHaveAttribute(
      'router-link',
      '/trips/trip-123/attachments',
    );
    expect(screen.getByLabelText('Bookmarks')).toHaveAttribute(
      'router-link',
      '/trips/trip-123/bookmarks',
    );
    expect(screen.getAllByText('Info')[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByLabelText('Add cover')).toBeInTheDocument();
  });

  it('keeps metadata editing hidden from non-owners', async () => {
    const repository = createRepository(
      vi.fn(async () => ({
        trip,
        role: 'member' as const,
        coverImageUrl: null,
        coverThumbnailUrl: null,
      })),
    );
    renderPage('info', repository);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Thailand' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Add cover')).not.toBeInTheDocument();
  });

  it('renders the not-found state without exposing protected trip data', async () => {
    const repository = createRepository(
      vi.fn(async () => {
        throw new AppError('TRIP_NOT_FOUND');
      }),
    );
    renderPage('info', repository);

    expect(
      await screen.findByRole('heading', { name: 'Trip not found' }),
    ).toBeInTheDocument();
  });

  it('renders the explicit access-denied state', async () => {
    const repository = createRepository(
      vi.fn(async () => {
        throw new AppError('TRIP_ACCESS_DENIED');
      }),
    );
    renderPage('ledger', repository);

    expect(
      await screen.findByRole('heading', { name: 'Access denied' }),
    ).toBeInTheDocument();
  });
});
