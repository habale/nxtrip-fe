import type { Database } from '../../shared/api/database.types';
import { mapItineraryNode, mapNodeAction } from './itinerary-types';

type NodeRow = Database['public']['Tables']['itinerary_nodes']['Row'];

const baseNode: NodeRow = {
  id: 'node-1',
  trip_id: 'trip-1',
  node_type: 'stop',
  title: 'Dinner reservation',
  additional_data: {
    lines: [{ type: 'text', text: 'Window table' }],
  },
  local_date: '2026-10-04',
  start_at: '2026-10-04T12:30:00Z',
  end_at: null,
  timezone: 'Asia/Ho_Chi_Minh',
  all_day: false,
  duration_minutes: 90,
  sort_key: 'a0',
  google_maps_url: 'https://maps.google.com/example',
  icon_key: 'restaurant',
  created_by: 'user-1',
  updated_by: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  version: 1,
  deleted_at: null,
};

describe('itinerary domain mapping', () => {
  it('maps stop nodes and safe additional information lines', () => {
    const node = mapItineraryNode(baseNode);

    expect(node).toMatchObject({
      nodeType: 'stop',
      title: 'Dinner reservation',
      additionalLines: [{ type: 'text', text: 'Window table' }],
      googleMapsUrl: 'https://maps.google.com/example',
    });
  });

  it('maps move-specific fields without coupling them to presentation', () => {
    const node = mapItineraryNode({
      ...baseNode,
      node_type: 'move',
      additional_data: {
        transport_mode: 'rail',
        operator: 'Airport Rail Link',
      },
    });

    expect(node).toMatchObject({
      nodeType: 'move',
      transportMode: 'rail',
      operator: 'Airport Rail Link',
    });
  });

  it('keeps future node types readable through a safe fallback', () => {
    expect(
      mapItineraryNode({ ...baseNode, node_type: 'future-node' }),
    ).toMatchObject({
      nodeType: 'unknown',
      sourceNodeType: 'future-node',
    });
  });

  it('maps V2 action metadata', () => {
    expect(
      mapNodeAction({
        id: 'action-1',
        trip_id: 'trip-1',
        node_id: 'node-1',
        action_type: 'url',
        label: 'Booking',
        icon_key: 'open_in_new',
        is_primary: true,
        sort_order: 1,
        action_data: { url: 'https://example.com' },
        created_by: 'user-1',
        updated_by: null,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        version: 1,
        deleted_at: null,
      }),
    ).toMatchObject({
      type: 'url',
      isPrimary: true,
      data: { url: 'https://example.com' },
    });
  });
});
