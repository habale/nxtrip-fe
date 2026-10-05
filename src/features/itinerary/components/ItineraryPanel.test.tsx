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
  attachments: [],
  version: 1,
} satisfies ItineraryNode;

describe('ItineraryPanel', () => {
  it('renders stop and move nodes for a bounded selected day', async () => {
    const nodes: ItineraryNode[] = [
      baseNode,
      {
        ...baseNode,
        id: 'move-1',
        nodeType: 'move',
        title: 'Airport transfer',
        sortKey: 'b0',
        googleMapsUrl: null,
        transportMode: 'rail',
        operator: 'Airport Rail Link',
        durationMinutes: 35,
        additionalLines: [{ type: 'text', text: 'Board from platform three' }],
      },
    ];
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
    expect(screen.queryByRole('link', { name: 'Directions' })).toBeNull();
    expect(screen.getByText('Airport transfer')).toBeInTheDocument();
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
      screen.getByText('Edit itinerary').closest('ion-fab-button')!,
    );
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
    await user.click(screen.getByText('Done').closest('ion-fab-button')!);

    await user.click(
      screen.getByText('Itinerary actions').closest('ion-fab-button')!,
    );
    await user.click(
      screen.getByText('Rearrange itinerary').closest('ion-fab-button')!,
    );
    expect(document.querySelectorAll('ion-reorder')).toHaveLength(nodes.length);
    expect(document.querySelectorAll('.ui-icon-button--large')).toHaveLength(0);
  });
});
