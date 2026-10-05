import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import { itineraryKeys, useReorderItineraryNode } from './itinerary-hooks';
import type { ItineraryRepository } from './itinerary-repository';
import type {
  ItineraryDateWindow,
  ItineraryNode,
  ItineraryWindow,
} from './itinerary-types';

const window: ItineraryDateWindow = {
  tripId: 'trip-1',
  startDate: '2099-10-15',
  endDate: '2099-10-15',
};

function node(id: string, sortKey: string): ItineraryNode {
  return {
    id,
    tripId: window.tripId,
    nodeType: 'stop',
    title: id,
    localDate: window.startDate,
    startAt: null,
    endAt: null,
    timezone: 'UTC',
    allDay: true,
    durationMinutes: null,
    sortKey,
    googleMapsUrl: null,
    iconKey: null,
    additionalData: {},
    additionalLines: [],
    attachments: [],
    version: 1,
  };
}

describe('itinerary reorder mutation', () => {
  it('optimistically reorders and restores the prior order after an error', async () => {
    let rejectReorder: (error: Error) => void = () => undefined;
    const failedReorder = new Promise<void>((_resolve, reject) => {
      rejectReorder = reject;
    });
    const repository = {
      getDateWindow: vi.fn(),
      createNode: vi.fn(),
      updateNode: vi.fn(),
      reorderNode: vi.fn(() => failedReorder),
      removeNode: vi.fn(),
      addNodeAttachment: vi.fn(),
    } satisfies ItineraryRepository;
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    queryClient.setQueryData<ItineraryWindow>(itineraryKeys.window(window), {
      ...window,
      nodes: [node('first', 'a0'), node('second', 'b0')],
    });
    const auth: AuthContextValue = {
      session: null,
      user: { id: 'user-1' } as User,
      status: 'ready',
      error: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthContext.Provider value={auth}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </AuthContext.Provider>
    );

    const { result } = renderHook(
      () => useReorderItineraryNode(window, repository),
      { wrapper },
    );

    act(() => {
      result.current.mutate({
        tripId: window.tripId,
        nodeId: 'first',
        version: 1,
        sortKey: 'c0',
      });
    });
    await waitFor(() =>
      expect(
        queryClient
          .getQueryData<ItineraryWindow>(itineraryKeys.window(window))
          ?.nodes.map(({ id }) => id),
      ).toEqual(['second', 'first']),
    );

    rejectReorder(new Error('reorder failed'));

    await waitFor(() =>
      expect(
        queryClient
          .getQueryData<ItineraryWindow>(itineraryKeys.window(window))
          ?.nodes.map(({ id }) => id),
      ).toEqual(['first', 'second']),
    );
  });
});
