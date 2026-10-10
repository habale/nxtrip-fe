export const ROUTE_PATHS = {
  root: '/',
  login: '/login',
  guest: '/guest',
  home: '/home',
  bookmarks: '/bookmarks',
  addTrip: '/trips/add',
  newTrip: '/trips/new',
  editTrip: '/trips/:tripId/edit',
  trip: '/trips/:tripId',
  tripSection: '/trips/:tripId/:section?',
  tripInfo: '/trips/:tripId/info',
  tripItinerary: '/trips/:tripId/itinerary',
  tripLedger: '/trips/:tripId/ledger',
  tripAttachments: '/trips/:tripId/attachments',
  tripBookmarks: '/trips/:tripId/bookmarks',
  newNodeChecklist: '/trips/:tripId/itinerary/:nodeId/checklists/new',
  tripChecklist: '/trips/:tripId/checklists/:checklistId',
  editTripChecklist: '/trips/:tripId/checklists/:checklistId/edit',
  guestChecklist: '/guest/checklists/:checklistId',
  settings: '/settings',
  uiKit: '/ui-kit',
} as const;

function tripPath(tripId: string, suffix = '') {
  return `/trips/${encodeURIComponent(tripId)}${suffix}`;
}

export const routes = {
  login: ROUTE_PATHS.login,
  guest: ROUTE_PATHS.guest,
  home: ROUTE_PATHS.home,
  bookmarks: ROUTE_PATHS.bookmarks,
  addTrip: ROUTE_PATHS.addTrip,
  newTrip: ROUTE_PATHS.newTrip,
  settings: ROUTE_PATHS.settings,
  uiKit: ROUTE_PATHS.uiKit,
  trip: (tripId: string) => tripPath(tripId),
  tripInfo: (tripId: string) => tripPath(tripId, '/info'),
  editTrip: (tripId: string) => tripPath(tripId, '/edit'),
  tripItinerary: (tripId: string) => tripPath(tripId, '/itinerary'),
  tripLedger: (tripId: string) => tripPath(tripId, '/ledger'),
  tripAttachments: (tripId: string) => tripPath(tripId, '/attachments'),
  tripBookmarks: (tripId: string) => tripPath(tripId, '/bookmarks'),
  newNodeChecklist: (tripId: string, nodeId: string) =>
    tripPath(tripId, `/itinerary/${encodeURIComponent(nodeId)}/checklists/new`),
  tripChecklist: (tripId: string, checklistId: string) =>
    tripPath(tripId, `/checklists/${encodeURIComponent(checklistId)}`),
  editTripChecklist: (tripId: string, checklistId: string) =>
    tripPath(tripId, `/checklists/${encodeURIComponent(checklistId)}/edit`),
  guestChecklist: (checklistId: string) =>
    `/guest/checklists/${encodeURIComponent(checklistId)}`,
} as const;
