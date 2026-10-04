import type { Database } from '../../shared/api/database.types';
import { mapSupabaseError } from '../../shared/api/error-mapper';
import { getSupabaseClient } from '../../shared/api/supabase-client';

export type Trip = Database['public']['Tables']['trips']['Row'];
export type TripMember = Pick<
  Database['public']['Tables']['trip_members']['Row'],
  'id' | 'trip_id' | 'display_name' | 'avatar_url'
>;

export type TripListItem = {
  trip: Trip;
  members: TripMember[];
  coverThumbnailUrl: string | null;
};

export type CreateTripInput = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  defaultCurrency: string;
  createdBy: string;
};

export type TripRepository = {
  listAccessible: (userId: string) => Promise<TripListItem[]>;
  create: (input: CreateTripInput) => Promise<string>;
};

function zonedDateToIso(date: string, timezone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let instant = target;

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .filter(({ type }) => type !== 'literal')
        .map(({ type, value }) => [type, Number(value)]),
    );
    const rendered = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    instant += target - rendered;
  }

  return new Date(instant).toISOString();
}

export function mapCreateTripInput(input: CreateTripInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim() || null,
    start_at: input.startDate
      ? zonedDateToIso(input.startDate, input.timezone)
      : null,
    end_at: input.endDate
      ? zonedDateToIso(input.endDate, input.timezone)
      : null,
    timezone: input.timezone.trim(),
    default_currency: input.defaultCurrency.toUpperCase(),
    created_by: input.createdBy,
  };
}

export function createTripRepository(): TripRepository {
  const client = getSupabaseClient();

  return {
    async create(input) {
      const tripId = crypto.randomUUID();
      const { error } = await client
        .from('trips')
        .insert({ id: tripId, ...mapCreateTripInput(input) });

      if (error) throw mapSupabaseError(error);
      return tripId;
    },

    async listAccessible(userId) {
      const { data: memberships, error: membershipsError } = await client
        .from('trip_access_memberships')
        .select('trip_id')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (membershipsError) throw mapSupabaseError(membershipsError);

      const tripIds = [...new Set(memberships.map(({ trip_id }) => trip_id))];
      if (tripIds.length === 0) return [];

      const [tripsResult, membersResult] = await Promise.all([
        client
          .from('trips')
          .select('*')
          .in('id', tripIds)
          .is('deleted_at', null)
          .order('start_at', { ascending: true, nullsFirst: false }),
        client
          .from('trip_members')
          .select('id, trip_id, display_name, avatar_url')
          .in('trip_id', tripIds)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: true }),
      ]);

      if (tripsResult.error) throw mapSupabaseError(tripsResult.error);
      if (membersResult.error) throw mapSupabaseError(membersResult.error);

      const thumbnailPaths = tripsResult.data.flatMap((trip) =>
        trip.cover_thumbnail_path ? [trip.cover_thumbnail_path] : [],
      );
      const thumbnailUrlByPath = new Map<string, string>();

      if (thumbnailPaths.length > 0) {
        const { data: signedThumbnails } = await client.storage
          .from('trip-files')
          .createSignedUrls(thumbnailPaths, 60 * 60);

        signedThumbnails?.forEach((thumbnail) => {
          if (thumbnail.path && thumbnail.signedUrl) {
            thumbnailUrlByPath.set(thumbnail.path, thumbnail.signedUrl);
          }
        });
      }

      const membersByTrip = new Map<string, TripMember[]>();
      membersResult.data.forEach((member) => {
        const tripMembers = membersByTrip.get(member.trip_id) ?? [];
        tripMembers.push(member);
        membersByTrip.set(member.trip_id, tripMembers);
      });

      const statusOrder: Record<Trip['status'], number> = {
        ongoing: 0,
        planning: 1,
        pending_settlement: 2,
        completed: 3,
      };

      return tripsResult.data
        .map((trip) => ({
          trip,
          members: membersByTrip.get(trip.id) ?? [],
          coverThumbnailUrl: trip.cover_thumbnail_path
            ? (thumbnailUrlByPath.get(trip.cover_thumbnail_path) ?? null)
            : null,
        }))
        .sort(
          (left, right) =>
            statusOrder[left.trip.status] - statusOrder[right.trip.status],
        );
    },
  };
}

let repository: TripRepository | undefined;

export function getTripRepository(): TripRepository {
  repository ??= createTripRepository();
  return repository;
}
