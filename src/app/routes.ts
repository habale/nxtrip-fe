export const ROUTE_PATHS = {
  root: '/',
  login: '/login',
  home: '/home',
  bookmarks: '/bookmarks',
  trip: '/trips/:tripId',
  tripInfo: '/trips/:tripId/info',
  tripItinerary: '/trips/:tripId/itinerary',
  tripLedger: '/trips/:tripId/ledger',
  tripAttachments: '/trips/:tripId/attachments',
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
  settings: ROUTE_PATHS.settings,
  uiKit: ROUTE_PATHS.uiKit,
  trip: (tripId: string) => tripPath(tripId),
  tripInfo: (tripId: string) => tripPath(tripId, '/info'),
  tripItinerary: (tripId: string) => tripPath(tripId, '/itinerary'),
  tripLedger: (tripId: string) => tripPath(tripId, '/ledger'),
  tripAttachments: (tripId: string) => tripPath(tripId, '/attachments'),
} as const;
