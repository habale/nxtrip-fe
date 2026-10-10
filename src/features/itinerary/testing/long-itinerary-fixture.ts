import type { Trip } from '../../trips/trip-repository';
import type { ItineraryNode } from '../itinerary-types';
import { addDays } from '../itinerary-window';

export function createLongItineraryFixture(dayCount = 70, nodesPerDay = 6) {
  const startDate = '2099-01-01';
  const endDate = addDays(startDate, dayCount - 1);
  const trip = {
    id: 'long-trip-benchmark',
    name: '70-day benchmark trip',
    start_at: `${startDate}T00:00:00Z`,
    end_at: `${endDate}T23:59:59Z`,
    timezone: 'UTC',
  } as Trip;
  const nodes: ItineraryNode[] = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const localDate = addDays(startDate, dayIndex);
    for (let nodeIndex = 0; nodeIndex < nodesPerDay; nodeIndex += 1) {
      nodes.push({
        id: `day-${dayIndex + 1}-node-${nodeIndex + 1}`,
        tripId: trip.id,
        nodeType: nodeIndex % 3 === 2 ? 'move' : 'stop',
        title: `Day ${dayIndex + 1}, item ${nodeIndex + 1}`,
        localDate,
        startAt: `${localDate}T${String(8 + nodeIndex).padStart(2, '0')}:00:00Z`,
        endAt: null,
        timezone: 'UTC',
        allDay: false,
        durationMinutes: null,
        sortKey: `${String(nodeIndex).padStart(3, '0')}V`,
        googleMapsUrl: null,
        iconKey: nodeIndex % 3 === 2 ? 'train' : 'location',
        additionalData: {},
        additionalLines: [{ type: 'text', text: 'Benchmark fixture note' }],
        attachments: [],
        checklists: [],
        version: 1,
        ...(nodeIndex % 3 === 2
          ? { transportMode: 'rail', operator: null }
          : {}),
      } as ItineraryNode);
    }
  }

  return { trip, nodes, startDate, endDate };
}
