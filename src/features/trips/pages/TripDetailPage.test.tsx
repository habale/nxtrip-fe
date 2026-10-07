import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppError } from '../../../shared/api/app-error';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import { TripDetailPage } from './TripDetailPage';
import type {
  Trip,
  TripMemberDetail,
  TripRepository,
} from '../trip-repository';

const trip: Trip = {
  id: 'trip-123',
  name: 'Thailand',
  description: 'Temples, street food, and island time.',
  start_at: '2026-10-14T17:00:00.000Z',
  end_at: '2026-10-17T17:00:00.000Z',
  timezone: 'Asia/Bangkok',
  status: 'ongoing',
  default_currency: 'THB',
  currency_decimal_places: 0,
  treasurer_member_id: null,
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
    joinByCode: vi.fn(async () => 'trip-joined'),
    getActiveInvite: vi.fn(async () => null),
    createInvite: vi.fn(),
    revokeInvite: vi.fn(),
    claimMember: vi.fn(),
    updateMetadata: vi.fn(async () => trip),
    updateCover: vi.fn(async () => trip),
    removeCover: vi.fn(async () => trip),
    listMembers: vi.fn(async () => []),
    addGuestMember: vi.fn(),
    updateGuestMember: vi.fn(),
    deactivateGuestMember: vi.fn(),
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
    signInAsGuest: vi.fn(),
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
    expect(screen.getByText('Edit')).toHaveAttribute(
      'router-link',
      '/trips/trip-123/edit',
    );
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
    expect(screen.queryByText('Add member')).not.toBeInTheDocument();
  });

  it('shows linked, guest, and inactive member states', async () => {
    const repository = createRepository(
      vi.fn(async () => ({
        trip,
        role: 'owner' as const,
        coverImageUrl: null,
        coverThumbnailUrl: null,
      })),
    );
    const members: TripMemberDetail[] = [
      {
        member: {
          id: 'member-owner',
          trip_id: trip.id,
          display_name: 'Liam Tran',
          email: 'liam@example.com',
          avatar_url: null,
          note: null,
          is_active: true,
          created_by: 'user-123',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          version: 1,
          deleted_at: null,
        },
        linkedUserId: 'user-123',
        role: 'owner',
        accessStatus: 'active',
      },
      {
        member: {
          id: 'member-guest',
          trip_id: trip.id,
          display_name: 'Kenji Mori',
          email: null,
          avatar_url: null,
          note: 'Vegetarian',
          is_active: false,
          created_by: 'user-123',
          created_at: '2026-01-02T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
          version: 1,
          deleted_at: null,
        },
        linkedUserId: null,
        role: null,
        accessStatus: null,
      },
    ];
    repository.listMembers = vi.fn(async () => members);
    renderPage('info', repository);

    expect(await screen.findByText('Members (2)')).toBeInTheDocument();
    expect(screen.getByText('Liam Tran')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Linked' })).toBeInTheDocument();
    expect(screen.queryByText('Linked')).not.toBeInTheDocument();
    const linkedCard = screen.getByText('Liam Tran').closest('article');
    expect(linkedCard).not.toBeNull();
    expect(within(linkedCard!).getByText('Actions for Liam Tran')).toHaveClass(
      'sr-only',
    );
    const guestCard = screen.getByText('Kenji Mori').closest('article');
    expect(guestCard).not.toBeNull();
    expect(within(guestCard!).getByText('Actions for Kenji Mori')).toHaveClass(
      'sr-only',
    );
    expect(screen.getByText('Inactive')).toBeInTheDocument();
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
