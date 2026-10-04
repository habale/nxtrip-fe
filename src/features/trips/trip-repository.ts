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

export type TripRepository = {
  listAccessible: (userId: string) => Promise<TripListItem[]>;
};

export function createTripRepository(): TripRepository {
  const client = getSupabaseClient();

  return {
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
