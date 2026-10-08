import { mapSupabaseError } from '../../shared/api/error-mapper';
import type { Json } from '../../shared/api/database.types';
import { createRequestId } from '../../shared/api/request-id';
import { getSupabaseClient } from '../../shared/api/supabase-client';
import type { BookmarkRepository } from '../bookmarks/bookmark-repository';
import type { ItineraryRepository } from '../itinerary/itinerary-repository';
import {
  mapItineraryNode,
  type NodeAttachment,
} from '../itinerary/itinerary-types';
import type { LedgerRepository } from '../ledger/ledger-repository';
import type { LedgerData } from '../ledger/ledger-types';

export type GuestTrip = {
  id: string;
  name: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  timezone: string;
  status: 'planning' | 'ongoing' | 'pending_settlement' | 'completed';
  default_currency: string;
  currency_decimal_places: number;
  cover_image_path: string | null;
  cover_thumbnail_path: string | null;
  coverImageUrl: string | null;
  coverThumbnailUrl: string | null;
};

export type GuestItineraryNode = {
  id: string;
  node_type: string;
  title: string;
  additional_data: Json;
  local_date: string | null;
  start_at: string | null;
  end_at: string | null;
  timezone: string | null;
  all_day: boolean;
  duration_minutes: number | null;
  sort_key: string;
  google_maps_url: string | null;
  icon_key: string | null;
  attachments: GuestAttachment[];
};

type GuestAttachment = {
  id: string;
  attachment_id: string;
  role: string;
  sort_order: number;
  label: string;
  storage_bucket: string;
  storage_path: string;
  display_name: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  category: string | null;
  thumbnail_path: string | null;
  metadata: Json;
  fileUrl: string | null;
  thumbnailUrl: string | null;
};

export type GuestBookmark = {
  id: string;
  title: string;
  notes: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  source_url: string | null;
  category: string | null;
  icon_key: string | null;
};

export type GuestRepository = {
  getTrip: (code: string) => Promise<GuestTrip>;
  getItinerary: (
    code: string,
    startDate: string,
    endDate: string,
  ) => Promise<GuestItineraryNode[]>;
  getBookmarks: (code: string) => Promise<GuestBookmark[]>;
  getLedger: (code: string) => Promise<LedgerData>;
};

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: Json, label: string) {
  if (!isRecord(value)) throw new Error(`Invalid ${label} response.`);
  return value;
}

function requireString(value: Json | undefined, label: string) {
  if (typeof value !== 'string') throw new Error(`Invalid ${label}.`);
  return value;
}

function nullableString(value: Json | undefined) {
  return typeof value === 'string' ? value : null;
}

function requireNumber(value: Json | undefined, label: string) {
  if (typeof value !== 'number') throw new Error(`Invalid ${label}.`);
  return value;
}

function requireArray(value: Json | undefined, label: string) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}.`);
  return value;
}

async function getGuestFileUrls(code: string, paths: string[]) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return new Map<string, string>();

  const batches = Array.from(
    { length: Math.ceil(uniquePaths.length / 100) },
    (_, index) => uniquePaths.slice(index * 100, (index + 1) * 100),
  );
  const responses = await Promise.all(
    batches.map((batch) =>
      getSupabaseClient().functions.invoke('guest-file-urls', {
        body: { code, paths: batch },
      }),
    ),
  );

  const urls = new Map<string, string>();
  for (const { data, error } of responses) {
    if (error) throw mapSupabaseError(error);
    if (
      !isRecord(data as Json) ||
      !isRecord((data as Record<string, Json>).urls)
    ) {
      throw new Error('Invalid guest file URL response.');
    }
    Object.entries(
      (data as Record<string, Json>).urls as Record<string, Json>,
    ).forEach(([path, url]) => {
      if (typeof url === 'string') urls.set(path, url);
    });
  }
  return urls;
}

function mapTrip(value: Json): GuestTrip {
  const row = requireRecord(value, 'guest trip');
  const status = requireString(row.status, 'trip status');
  if (
    !['planning', 'ongoing', 'pending_settlement', 'completed'].includes(status)
  ) {
    throw new Error('Invalid trip status.');
  }
  return {
    id: requireString(row.id, 'trip id'),
    name: requireString(row.name, 'trip name'),
    description: nullableString(row.description),
    start_at: nullableString(row.start_at),
    end_at: nullableString(row.end_at),
    timezone: requireString(row.timezone, 'trip timezone'),
    status: status as GuestTrip['status'],
    default_currency: requireString(row.default_currency, 'trip currency'),
    currency_decimal_places: requireNumber(
      row.currency_decimal_places,
      'trip decimal places',
    ),
    cover_image_path: nullableString(row.cover_image_path),
    cover_thumbnail_path: nullableString(row.cover_thumbnail_path),
    coverImageUrl: null,
    coverThumbnailUrl: null,
  };
}

function mapGuestAttachment(value: Json): GuestAttachment {
  const row = requireRecord(value, 'guest attachment');
  return {
    id: requireString(row.id, 'attachment link id'),
    attachment_id: requireString(row.attachment_id, 'attachment id'),
    role: requireString(row.role, 'attachment role'),
    sort_order: requireNumber(row.sort_order, 'attachment order'),
    label: requireString(row.label, 'attachment label'),
    storage_bucket: requireString(row.storage_bucket, 'attachment bucket'),
    storage_path: requireString(row.storage_path, 'attachment path'),
    display_name: requireString(row.display_name, 'attachment name'),
    original_filename: nullableString(row.original_filename),
    mime_type: nullableString(row.mime_type),
    size_bytes: typeof row.size_bytes === 'number' ? row.size_bytes : null,
    description: nullableString(row.description),
    category: nullableString(row.category),
    thumbnail_path: nullableString(row.thumbnail_path),
    metadata: row.metadata ?? {},
    fileUrl: null,
    thumbnailUrl: null,
  };
}

function mapItinerary(value: Json): GuestItineraryNode[] {
  if (!Array.isArray(value))
    throw new Error('Invalid guest itinerary response.');
  return value.map((item) => {
    const row = requireRecord(item, 'guest itinerary item');
    return {
      id: requireString(row.id, 'itinerary id'),
      node_type: requireString(row.node_type, 'itinerary type'),
      title: requireString(row.title, 'itinerary title'),
      additional_data: row.additional_data ?? {},
      local_date: nullableString(row.local_date),
      start_at: nullableString(row.start_at),
      end_at: nullableString(row.end_at),
      timezone: nullableString(row.timezone),
      all_day: row.all_day === true,
      duration_minutes:
        typeof row.duration_minutes === 'number' ? row.duration_minutes : null,
      sort_key: requireString(row.sort_key, 'itinerary order'),
      google_maps_url: nullableString(row.google_maps_url),
      icon_key: nullableString(row.icon_key),
      attachments: requireArray(
        row.attachments,
        'guest itinerary attachments',
      ).map(mapGuestAttachment),
    };
  });
}

function mapBookmarks(value: Json): GuestBookmark[] {
  if (!Array.isArray(value))
    throw new Error('Invalid guest bookmarks response.');
  return value.map((item) => {
    const row = requireRecord(item, 'guest bookmark');
    return {
      id: requireString(row.id, 'bookmark id'),
      title: requireString(row.title, 'bookmark title'),
      notes: nullableString(row.notes),
      address: nullableString(row.address),
      latitude: typeof row.latitude === 'number' ? row.latitude : null,
      longitude: typeof row.longitude === 'number' ? row.longitude : null,
      source_url: nullableString(row.source_url),
      category: nullableString(row.category),
      icon_key: nullableString(row.icon_key),
    };
  });
}

export function createGuestRepository(): GuestRepository {
  const client = getSupabaseClient();
  return {
    async getTrip(code) {
      const requestId = createRequestId();
      const { data, error } = await client.rpc('get_guest_trip', {
        p_code: code,
        p_request_id: requestId,
      });
      if (error) throw mapSupabaseError(error, requestId);
      const trip = mapTrip(data);
      const urls = await getGuestFileUrls(
        code,
        [trip.cover_image_path, trip.cover_thumbnail_path].filter(
          (path): path is string => Boolean(path),
        ),
      );
      return {
        ...trip,
        coverImageUrl: trip.cover_image_path
          ? (urls.get(trip.cover_image_path) ?? null)
          : null,
        coverThumbnailUrl: trip.cover_thumbnail_path
          ? (urls.get(trip.cover_thumbnail_path) ?? null)
          : null,
      };
    },
    async getItinerary(code, startDate, endDate) {
      const requestId = createRequestId();
      const { data, error } = await client.rpc('get_guest_itinerary', {
        p_code: code,
        p_start_date: startDate,
        p_end_date: endDate,
        p_request_id: requestId,
      });
      if (error) throw mapSupabaseError(error, requestId);
      const itinerary = mapItinerary(data);
      const paths = itinerary.flatMap((node) =>
        node.attachments.flatMap((attachment) => [
          attachment.storage_path,
          ...(attachment.thumbnail_path ? [attachment.thumbnail_path] : []),
        ]),
      );
      const urls = await getGuestFileUrls(code, paths);
      return itinerary.map((node) => ({
        ...node,
        attachments: node.attachments.map((attachment) => ({
          ...attachment,
          fileUrl: urls.get(attachment.storage_path) ?? null,
          thumbnailUrl: attachment.thumbnail_path
            ? (urls.get(attachment.thumbnail_path) ?? null)
            : null,
        })),
      }));
    },
    async getBookmarks(code) {
      const requestId = createRequestId();
      const { data, error } = await client.rpc('get_guest_bookmarks', {
        p_code: code,
        p_request_id: requestId,
      });
      if (error) throw mapSupabaseError(error, requestId);
      return mapBookmarks(data);
    },
    async getLedger(code) {
      const requestId = createRequestId();
      const { data, error } = await client.rpc('get_guest_ledger', {
        p_code: code,
        p_request_id: requestId,
      });
      if (error) throw mapSupabaseError(error, requestId);
      const ledger = requireRecord(data, 'guest ledger');
      for (const key of [
        'members',
        'funds',
        'expenses',
        'contributions',
        'transfers',
      ]) {
        requireArray(ledger[key], `guest ledger ${key}`);
      }
      return ledger as unknown as LedgerData;
    },
  };
}

let repository: GuestRepository | undefined;

export function getGuestRepository() {
  repository ??= createGuestRepository();
  return repository;
}

function readonlyGuestMutation(): Promise<never> {
  return Promise.reject(new Error('Guest access is read-only.'));
}

export function createGuestItineraryRepository(
  code: string,
): ItineraryRepository {
  const guestRepository = getGuestRepository();
  return {
    async getDateWindow(window) {
      const nodes = await guestRepository.getItinerary(
        code,
        window.startDate,
        window.endDate,
      );
      return {
        ...window,
        nodes: nodes.map((node) => {
          const attachments: NodeAttachment[] = node.attachments.map(
            (attachment) => ({
              id: attachment.id,
              role: attachment.role,
              sortOrder: attachment.sort_order,
              label: attachment.label,
              attachment: {
                id: attachment.attachment_id,
                trip_id: window.tripId,
                storage_bucket: attachment.storage_bucket,
                storage_path: attachment.storage_path,
                display_name: attachment.display_name,
                original_filename: attachment.original_filename,
                mime_type: attachment.mime_type,
                size_bytes: attachment.size_bytes,
                description: attachment.description,
                category: attachment.category,
                thumbnail_path: attachment.thumbnail_path,
                metadata: attachment.metadata,
                uploaded_by: null,
                created_at: '',
                updated_at: '',
                version: 1,
                deleted_at: null,
              },
              fileUrl: attachment.fileUrl,
              thumbnailUrl: attachment.thumbnailUrl,
            }),
          );
          return mapItineraryNode(
            {
              ...node,
              trip_id: window.tripId,
              created_by: null,
              updated_by: null,
              created_at: '',
              updated_at: '',
              version: 1,
              deleted_at: null,
            },
            attachments,
          );
        }),
      };
    },
    createNode: () => readonlyGuestMutation(),
    updateNode: () => readonlyGuestMutation(),
    removeNode: () => readonlyGuestMutation(),
    reorderNode: () => readonlyGuestMutation(),
    addNodeAttachment: () => readonlyGuestMutation(),
    removeNodeAttachment: () => readonlyGuestMutation(),
  };
}

export function createGuestLedgerRepository(code: string): LedgerRepository {
  const guestRepository = getGuestRepository();
  return {
    listExpenses: () => guestRepository.getLedger(code),
    saveEntry: readonlyGuestMutation,
    deleteExpense: readonlyGuestMutation,
    deleteTransfer: readonlyGuestMutation,
    recordTransfer: readonlyGuestMutation,
  };
}

export function createGuestBookmarkRepository(
  code: string,
): BookmarkRepository {
  const guestRepository = getGuestRepository();
  return {
    async listForTrip(tripId) {
      const bookmarks = await guestRepository.getBookmarks(code);
      return bookmarks.map((bookmark) => ({
        id: bookmark.id,
        owner_user_id: '',
        title: bookmark.title,
        notes: bookmark.notes,
        address: bookmark.address,
        latitude: bookmark.latitude,
        longitude: bookmark.longitude,
        source_type: 'guest',
        source_url: bookmark.source_url,
        place_provider: null,
        provider_place_id: null,
        source_trip_id: tripId,
        source_node_id: null,
        source_data: {
          category: bookmark.category,
          icon_key: bookmark.icon_key,
        },
        created_at: '',
        updated_at: '',
        version: 1,
        deleted_at: null,
      }));
    },
    create: () => readonlyGuestMutation(),
  };
}
