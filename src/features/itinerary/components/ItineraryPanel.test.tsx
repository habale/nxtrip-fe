import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { i18n } from '../../../shared/i18n';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import type { Trip } from '../../trips/trip-repository';
import type { ItineraryRepository } from '../itinerary-repository';
import type { ItineraryNode } from '../itinerary-types';
import { ItineraryPanel } from './ItineraryPanel';

const trip = {
  id: 'trip-1',
  start_at: '2099-10-15T00:00:00Z',
  end_at: '2099-10-18T00:00:00Z',
  timezone: 'UTC',
} as Trip;

const baseNode = {
  id: 'stop-1',
  tripId: trip.id,
  nodeType: 'stop',
  title: 'Temple visit',
  localDate: '2099-10-15',
  startAt: '2099-10-15T09:30:00Z',
  endAt: null,
  timezone: 'UTC',
  allDay: false,
  durationMinutes: null,
  sortKey: 'a0',
  googleMapsUrl: 'https://maps.google.com/example',
  iconKey: 'location',
  additionalData: {},
  additionalLines: [{ type: 'text', text: 'Meet at the east gate' }],
  attachments: [
    {
      id: 'node-attachment-1',
      role: 'attachment',
      sortOrder: 0,
      label: 'Boarding pass',
      fileUrl: 'https://example.com/boarding-pass.pdf',
      thumbnailUrl: null,
      attachment: {
        id: 'attachment-1',
        trip_id: trip.id,
        storage_bucket: 'trip-files',
        storage_path: 'trip-1/boarding-pass.pdf',
        display_name: 'Boarding pass',
        original_filename: 'boarding-pass.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1024,
        description: null,
        category: null,
        thumbnail_path: null,
        metadata: {},
        uploaded_by: 'user-1',
        created_at: '2099-01-01T00:00:00Z',
        updated_at: '2099-01-01T00:00:00Z',
        version: 1,
        deleted_at: null,
      },
    },
  ],
  version: 1,
} satisfies ItineraryNode;

describe('ItineraryPanel', () => {
  it('renders a read-only itinerary without the actions FAB', async () => {
    const repository = {
      getDateWindow: vi.fn(async (window) => ({
        ...window,
        nodes: [baseNode],
      })),
      createNode: vi.fn(),
      updateNode: vi.fn(),
      reorderNode: vi.fn(),
      removeNode: vi.fn(),
      addNodeAttachment: vi.fn(),
    } satisfies ItineraryRepository;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider
          value={
            {
              session: null,
              user: { id: 'user-1' } as User,
              status: 'ready',
              error: null,
              signInWithGoogle: vi.fn(),
              signInAsGuest: vi.fn(),
              signOut: vi.fn(),
            } satisfies AuthContextValue
          }
        >
          <QueryClientProvider client={queryClient}>
            <ItineraryPanel
              canEdit={false}
              repository={repository}
              trip={trip}
            />
          </QueryClientProvider>
        </AuthContext.Provider>
      </I18nextProvider>,
    );

    expect(await screen.findByText('Temple visit')).toBeInTheDocument();
    expect(screen.queryByText('Itinerary actions')).not.toBeInTheDocument();
    expect(document.querySelector('ion-reorder')).not.toBeInTheDocument();
    expect(document.querySelector('.ui-icon-button')).not.toBeInTheDocument();
  });

  it('renders stop and move nodes for a bounded selected day', async () => {
    const nodes = (
      [
        baseNode,
        {
          ...baseNode,
          id: 'move-1',
          nodeType: 'move',
          title: 'Airport transfer',
          sortKey: 'b0',
          googleMapsUrl: 'https://maps.google.com/airport',
          transportMode: 'rail',
          operator: 'Airport Rail Link',
          durationMinutes: 35,
          additionalLines: [
            { type: 'text', text: 'Board from platform three' },
          ],
        },
      ] satisfies ItineraryNode[]
    ).reverse();
    const repository = {
      getDateWindow: vi.fn(async (window) => ({ ...window, nodes })),
      createNode: vi.fn(),
      updateNode: vi.fn(),
      reorderNode: vi.fn(),
      removeNode: vi.fn(),
      addNodeAttachment: vi.fn(),
    } satisfies ItineraryRepository;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider
          value={
            {
              session: null,
              user: { id: 'user-1' } as User,
              status: 'ready',
              error: null,
              signInWithGoogle: vi.fn(),
              signInAsGuest: vi.fn(),
              signOut: vi.fn(),
            } satisfies AuthContextValue
          }
        >
          <QueryClientProvider client={queryClient}>
            <ItineraryPanel repository={repository} trip={trip} />
          </QueryClientProvider>
        </AuthContext.Provider>
      </I18nextProvider>,
    );

    expect(await screen.findByText('Temple visit')).toBeInTheDocument();
    expect(
      screen.getByText('Temple visit').closest('ion-item'),
    ).toHaveAttribute('data-node-id', 'stop-1');
    expect(screen.getByText('Meet at the east gate')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Directions' })).toHaveLength(2);
    expect(
      screen.getAllByRole('link', { name: 'Directions' })[0],
    ).toHaveAttribute('href', 'https://maps.google.com/example');
    expect(screen.getAllByRole('link', { name: 'Boarding pass' })).toHaveLength(
      2,
    );
    expect(screen.getByText('Airport transfer')).toBeInTheDocument();
    expect(screen.getByText('End of day')).toBeInTheDocument();
    expect(screen.queryByText('Airport Rail Link')).toBeNull();
    expect(screen.queryByText('• 35 min')).toBeNull();
    expect(
      screen
        .getByText('Board from platform three')
        .closest('.itinerary-move__pill'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Airport transfer').closest('ion-item'),
    ).toHaveAttribute('data-node-id', 'move-1');
    expect(repository.getDateWindow).toHaveBeenCalledWith({
      tripId: trip.id,
      startDate: '2099-10-15',
      endDate: '2099-10-18',
    });

    const user = userEvent.setup();
    await user.click(
      screen.getByText('Itinerary actions').closest('ion-fab-button')!,
    );
    await user.click(
      screen.getByText('Edit Itinerary').closest('ion-fab-button')!,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Edit Itinerary');
    expect(document.querySelectorAll('.ui-icon-button--large')).toHaveLength(
      nodes.length + 1,
    );
    const topAddButton = document.querySelector(
      '.itinerary-edit-context > .ui-icon-button',
    );
    expect(topAddButton).toBeInTheDocument();
    await user.click(topAddButton!);
    expect(screen.getByText('Add itinerary item')).toBeInTheDocument();
    await user.click(screen.getByText('Cancel', { selector: 'ion-button' }));

    const betweenAddButtons = document.querySelectorAll(
      '.ui-icon-button--large',
    );
    await user.click(betweenAddButtons[1]);
    expect(screen.getByText('Add itinerary item')).toBeInTheDocument();
    await user.click(screen.getByText('Cancel', { selector: 'ion-button' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await user.click(
      screen.getByText('Itinerary actions').closest('ion-fab-button')!,
    );
    await user.click(
      screen.getByText('Rearrange Itinerary').closest('ion-fab-button')!,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Rearrange Itinerary');
    expect(document.querySelectorAll('ion-reorder')).toHaveLength(nodes.length);
    expect(document.querySelectorAll('.ui-icon-button--large')).toHaveLength(0);
  });
});
