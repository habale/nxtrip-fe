export const ROUTE_PATHS = {
  root: '/',
  login: '/login',
  home: '/home',
  bookmarks: '/bookmarks',
  newTrip: '/trips/new',
  trip: '/trips/:tripId',
  tripSection: '/trips/:tripId/:section?',
  tripInfo: '/trips/:tripId/info',
  tripItinerary: '/trips/:tripId/itinerary',
  tripLedger: '/trips/:tripId/ledger',
  tripAttachments: '/trips/:tripId/attachments',
  tripBookmarks: '/trips/:tripId/bookmarks',
  settings: '/settings',
  uiKit: '/ui-kit',
} as const;

function tripPath(tripId: string, suffix = '') {
  return `/trips/${encodeURIComponent(tripId)}${suffix}`;
}

export const routes = {
  login: ROUTE_PATHS.login,
  home: ROUTE_PATHS.home,
  bookmarks: ROUTE_PATHS.bookmarks,
  newTrip: ROUTE_PATHS.newTrip,
  settings: ROUTE_PATHS.settings,
  uiKit: ROUTE_PATHS.uiKit,
  trip: (tripId: string) => tripPath(tripId),
  tripInfo: (tripId: string) => tripPath(tripId, '/info'),
  tripItinerary: (tripId: string) => tripPath(tripId, '/itinerary'),
  tripLedger: (tripId: string) => tripPath(tripId, '/ledger'),
  tripAttachments: (tripId: string) => tripPath(tripId, '/attachments'),
  tripBookmarks: (tripId: string) => tripPath(tripId, '/bookmarks'),
} as const;
