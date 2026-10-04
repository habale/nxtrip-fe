import type { ItineraryNode } from './itinerary-types';

export type ItineraryCategory =
  | 'moving'
  | 'lodging'
  | 'dining'
  | 'cafe'
  | 'activity'
  | 'sightseeing'
  | 'others'
  | 'misc'
  | 'shopping';

const categoryAliases: Record<string, ItineraryCategory> = {
  accommodation: 'lodging',
  activity: 'activity',
  cafe: 'cafe',
  café: 'cafe',
  dining: 'dining',
  food: 'dining',
  lodging: 'lodging',
  misc: 'misc',
  miscellaneous: 'misc',
  move: 'moving',
  moving: 'moving',
  other: 'others',
  others: 'others',
  shopping: 'shopping',
  sightseeing: 'sightseeing',
};

const categoryByIcon: Record<string, ItineraryCategory> = {
  accommodation: 'lodging',
  activity: 'activity',
  bus: 'moving',
  cafe: 'cafe',
  car: 'moving',
  ferry: 'moving',
  flight: 'moving',
  food: 'dining',
  hotel: 'lodging',
  location: 'sightseeing',
  rail: 'moving',
  restaurant: 'dining',
  shopping: 'shopping',
  sightseeing: 'sightseeing',
  ticket: 'misc',
  train: 'moving',
  walk: 'moving',
};

export function getItineraryCategory(node: ItineraryNode): ItineraryCategory {
  const configuredCategory = node.additionalData.category;
  if (typeof configuredCategory === 'string') {
    const category = categoryAliases[configuredCategory.trim().toLowerCase()];
    if (category) return category;
  }

  if (node.nodeType === 'move') return 'moving';

  const iconKey = node.iconKey?.trim().toLowerCase();
  return iconKey ? (categoryByIcon[iconKey] ?? 'misc') : 'misc';
}
