import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import { i18n } from '../../../shared/i18n';
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
      },
    ];
    const repository = {
      getDateWindow: vi.fn(async (window) => ({ ...window, nodes })),
    } satisfies ItineraryRepository;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <ItineraryPanel repository={repository} trip={trip} />
        </QueryClientProvider>
      </I18nextProvider>,
    );

    expect(await screen.findByText('Temple visit')).toBeInTheDocument();
    expect(
      screen.getByText('Temple visit').closest('ion-item'),
    ).toHaveAttribute('data-node-id', 'stop-1');
    expect(screen.getByText('Meet at the east gate')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute(
      'href',
      'https://maps.google.com/example',
    );
    expect(screen.getByText('Airport Rail Link')).toBeInTheDocument();
    expect(screen.getByText('• 35 min')).toBeInTheDocument();
    expect(
      screen.getByText('Airport Rail Link').closest('ion-item'),
    ).toHaveAttribute('data-node-id', 'move-1');
    expect(repository.getDateWindow).toHaveBeenCalledWith({
      tripId: trip.id,
      startDate: '2099-10-15',
      endDate: '2099-10-18',
    });
  });
});
