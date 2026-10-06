import { AppError } from '../../shared/api/app-error';
import type { Database } from '../../shared/api/database.types';
import { mapSupabaseError } from '../../shared/api/error-mapper';
import { createRequestId } from '../../shared/api/request-id';
import { getSupabaseClient } from '../../shared/api/supabase-client';

export type Trip = Database['public']['Tables']['trips']['Row'];
export type TripMember = Pick<
  Database['public']['Tables']['trip_members']['Row'],
  'id' | 'trip_id' | 'display_name' | 'avatar_url'
>;

export type TripMemberDetail = {
  member: Database['public']['Tables']['trip_members']['Row'];
  linkedUserId: string | null;
  role: Database['public']['Enums']['access_role'] | null;
  accessStatus: Database['public']['Enums']['access_status'] | null;
};

export type TripListItem = {
  trip: Trip;
  members: TripMember[];
  coverThumbnailUrl: string | null;
};

export type TripDetail = {
  trip: Trip;
  role: Database['public']['Enums']['access_role'];
  coverImageUrl: string | null;
  coverThumbnailUrl: string | null;
};

export type TripInvite =
  Database['public']['Tables']['trip_invites']['Row'];

export type CreateTripInput = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  defaultCurrency: string;
  currencyDecimalPlaces: number;
  createdBy: string;
};

export type UpdateTripInput = Omit<CreateTripInput, 'createdBy'> & {
  tripId: string;
  version: number;
};

export type UpdateTripCoverInput = {
  tripId: string;
  version: number;
  file: File;
  thumbnail: Blob;
  currentImagePath: string | null;
  currentThumbnailPath: string | null;
};

export type RemoveTripCoverInput = Pick<
  UpdateTripCoverInput,
  'tripId' | 'version' | 'currentImagePath' | 'currentThumbnailPath'
>;

export type AddGuestMemberInput = {
  tripId: string;
  displayName: string;
  email: string;
  note: string;
  isTreasurer: boolean;
  createdBy: string;
};

export type UpdateGuestMemberInput = Omit<AddGuestMemberInput, 'createdBy'> & {
  memberId: string;
  version: number;
  currentTreasurerMemberId: string | null;
};

export type DeactivateGuestMemberInput = Pick<
  UpdateGuestMemberInput,
  'tripId' | 'memberId' | 'version'
>;

export type TripRepository = {
  listAccessible: (userId: string) => Promise<TripListItem[]>;
  getAccessibleById: (tripId: string, userId: string) => Promise<TripDetail>;
  create: (input: CreateTripInput) => Promise<string>;
  joinByCode: (code: string) => Promise<string>;
  getActiveInvite: (tripId: string) => Promise<TripInvite | null>;
  createInvite: (tripId: string, createdBy: string) => Promise<TripInvite>;
  revokeInvite: (inviteId: string) => Promise<void>;
  updateMetadata: (input: UpdateTripInput) => Promise<Trip>;
  updateCover: (input: UpdateTripCoverInput) => Promise<Trip>;
  removeCover: (input: RemoveTripCoverInput) => Promise<Trip>;
  listMembers: (tripId: string) => Promise<TripMemberDetail[]>;
  addGuestMember: (input: AddGuestMemberInput) => Promise<TripMemberDetail>;
  updateGuestMember: (
    input: UpdateGuestMemberInput,
  ) => Promise<TripMemberDetail>;
  deactivateGuestMember: (
    input: DeactivateGuestMemberInput,
  ) => Promise<TripMemberDetail>;
};

export function resolveTreasurerUpdate(
  currentTreasurerMemberId: string | null,
  memberId: string,
  isTreasurer: boolean,
): string | null | undefined {
  if (isTreasurer && currentTreasurerMemberId !== memberId) return memberId;
  if (!isTreasurer && currentTreasurerMemberId === memberId) return null;
  return undefined;
}

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
    currency_decimal_places: input.currencyDecimalPlaces,
    created_by: input.createdBy,
  };
}

export function mapUpdateTripInput(input: UpdateTripInput) {
  const mapped = mapCreateTripInput({ ...input, createdBy: '' });
  const {
    created_by: _createdBy,
    currency_decimal_places: _currencyDecimalPlaces,
    ...metadata
  } = mapped;
  void _createdBy;
  void _currencyDecimalPlaces;
  return metadata;
}

export function createTripRepository(): TripRepository {
  const client = getSupabaseClient();

  async function setTripTreasurer(
    tripId: string,
    treasurerMemberId: string | null,
  ) {
    const { error } = await client.rpc('set_trip_treasurer', {
      p_trip_id: tripId,
      p_treasurer_member_id: treasurerMemberId,
      p_request_id: createRequestId(),
    });
    if (error) throw mapSupabaseError(error);
  }

  return {
    async joinByCode(code) {
      const requestId = createRequestId();
      const { data, error } = await client.rpc('join_trip_by_code', {
        p_code: code.trim(),
        p_request_id: requestId,
      });

      if (error) throw mapSupabaseError(error, requestId);
      return data;
    },

    async getActiveInvite(tripId) {
      const { data, error } = await client
        .from('trip_invites')
        .select('*')
        .eq('trip_id', tripId)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw mapSupabaseError(error);
      return data;
    },

    async createInvite(tripId, createdBy) {
      const random = new Uint8Array(8);
      crypto.getRandomValues(random);
      const code = Array.from(random, (value) =>
        value.toString(16).padStart(2, '0'),
      )
        .join('')
        .toUpperCase();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await client
        .from('trip_invites')
        .insert({
          trip_id: tripId,
          code,
          role: 'member',
          created_by: createdBy,
          expires_at: expiresAt.toISOString(),
          max_uses: null,
        })
        .select('*')
        .single();

      if (error) throw mapSupabaseError(error);
      return data;
    },

    async revokeInvite(inviteId) {
      const { error } = await client
        .from('trip_invites')
        .update({ is_active: false })
        .eq('id', inviteId);

      if (error) throw mapSupabaseError(error);
    },

    async listMembers(tripId) {
      const [membersResult, membershipsResult] = await Promise.all([
        client
          .from('trip_members')
          .select('*')
          .eq('trip_id', tripId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true }),
        client
          .from('trip_access_memberships')
          .select('trip_member_id, user_id, role, status')
          .eq('trip_id', tripId),
      ]);

      if (membersResult.error) throw mapSupabaseError(membersResult.error);
      if (membershipsResult.error) {
        throw mapSupabaseError(membershipsResult.error);
      }

      const membershipByMember = new Map(
        membershipsResult.data.flatMap((membership) =>
          membership.trip_member_id
            ? [[membership.trip_member_id, membership] as const]
            : [],
        ),
      );

      return membersResult.data
        .map((member) => {
          const membership = membershipByMember.get(member.id);
          return {
            member,
            linkedUserId: membership?.user_id ?? null,
            role: membership?.role ?? null,
            accessStatus: membership?.status ?? null,
          };
        })
        .sort(
          (left, right) =>
            Number(right.member.is_active) - Number(left.member.is_active),
        );
    },

    async addGuestMember(input) {
      const { data, error } = await client
        .from('trip_members')
        .insert({
          trip_id: input.tripId,
          display_name: input.displayName.trim(),
          email: input.email.trim() || null,
          note: input.note.trim() || null,
          created_by: input.createdBy,
        })
        .select('*')
        .single();

      if (error) throw mapSupabaseError(error);
      if (input.isTreasurer) {
        await setTripTreasurer(input.tripId, data.id);
      }
      return {
        member: data,
        linkedUserId: null,
        role: null,
        accessStatus: null,
      };
    },

    async updateGuestMember(input) {
      const { data, error } = await client
        .from('trip_members')
        .update({
          display_name: input.displayName.trim(),
          email: input.email.trim() || null,
          note: input.note.trim() || null,
        })
        .eq('trip_id', input.tripId)
        .eq('id', input.memberId)
        .eq('version', input.version)
        .select('*')
        .maybeSingle();

      if (error) throw mapSupabaseError(error);
      if (!data) throw new AppError('UNKNOWN');
      const treasurerUpdate = resolveTreasurerUpdate(
        input.currentTreasurerMemberId,
        input.memberId,
        input.isTreasurer,
      );
      if (treasurerUpdate !== undefined) {
        await setTripTreasurer(input.tripId, treasurerUpdate);
      }
      return {
        member: data,
        linkedUserId: null,
        role: null,
        accessStatus: null,
      };
    },

    async deactivateGuestMember(input) {
      const { data, error } = await client
        .from('trip_members')
        .update({ is_active: false })
        .eq('trip_id', input.tripId)
        .eq('id', input.memberId)
        .eq('version', input.version)
        .select('*')
        .maybeSingle();

      if (error) throw mapSupabaseError(error);
      if (!data) throw new AppError('UNKNOWN');
      return {
        member: data,
        linkedUserId: null,
        role: null,
        accessStatus: null,
      };
    },

    async getAccessibleById(tripId, userId) {
      const { data: membership, error: membershipError } = await client
        .from('trip_access_memberships')
        .select('role')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (membershipError) throw mapSupabaseError(membershipError);
      if (!membership) throw new AppError('TRIP_NOT_FOUND');

      const { data, error } = await client
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        if (error.code === '42501') throw new AppError('TRIP_ACCESS_DENIED');
        throw mapSupabaseError(error);
      }
      if (!data) throw new AppError('TRIP_NOT_FOUND');

      const coverPaths = [
        data.cover_image_path,
        data.cover_thumbnail_path,
      ].filter((path): path is string => Boolean(path));
      const signedUrlByPath = new Map<string, string>();

      if (coverPaths.length > 0) {
        const { data: signedCovers } = await client.storage
          .from('trip-files')
          .createSignedUrls(coverPaths, 60 * 60);

        signedCovers?.forEach((cover) => {
          if (cover.path && cover.signedUrl) {
            signedUrlByPath.set(cover.path, cover.signedUrl);
          }
        });
      }

      return {
        trip: data,
        role: membership.role,
        coverImageUrl: data.cover_image_path
          ? (signedUrlByPath.get(data.cover_image_path) ?? null)
          : null,
        coverThumbnailUrl: data.cover_thumbnail_path
          ? (signedUrlByPath.get(data.cover_thumbnail_path) ?? null)
          : null,
      };
    },

    async updateMetadata(input) {
      const { data, error } = await client
        .from('trips')
        .update(mapUpdateTripInput(input))
        .eq('id', input.tripId)
        .eq('version', input.version)
        .select('*')
        .maybeSingle();

      if (error) {
        if (error.code === '42501') throw new AppError('TRIP_ACCESS_DENIED');
        throw mapSupabaseError(error);
      }
      if (!data) throw new AppError('UNKNOWN');

      return data;
    },

    async updateCover(input) {
      const assetId = crypto.randomUUID();
      const extension =
        input.file.type === 'image/png'
          ? 'png'
          : input.file.type === 'image/webp'
            ? 'webp'
            : 'jpg';
      const imagePath = `${input.tripId}/cover/${assetId}.${extension}`;
      const thumbnailPath = `${input.tripId}/cover/${assetId}-thumbnail.webp`;
      const bucket = client.storage.from('trip-files');

      const imageUpload = await bucket.upload(imagePath, input.file, {
        cacheControl: '3600',
        contentType: input.file.type,
      });
      if (imageUpload.error) throw mapSupabaseError(imageUpload.error);

      const thumbnailUpload = await bucket.upload(
        thumbnailPath,
        input.thumbnail,
        {
          cacheControl: '3600',
          contentType: 'image/webp',
        },
      );
      if (thumbnailUpload.error) {
        await bucket.remove([imagePath]);
        throw mapSupabaseError(thumbnailUpload.error);
      }

      const { data, error } = await client
        .from('trips')
        .update({
          cover_image_path: imagePath,
          cover_thumbnail_path: thumbnailPath,
        })
        .eq('id', input.tripId)
        .eq('version', input.version)
        .select('*')
        .maybeSingle();

      if (error || !data) {
        await bucket.remove([imagePath, thumbnailPath]);
        if (error?.code === '42501') {
          throw new AppError('TRIP_ACCESS_DENIED');
        }
        if (error) throw mapSupabaseError(error);
        throw new AppError('UNKNOWN');
      }

      const previousPaths = [
        input.currentImagePath,
        input.currentThumbnailPath,
      ].filter((path): path is string => Boolean(path));
      if (previousPaths.length > 0) await bucket.remove(previousPaths);

      return data;
    },

    async removeCover(input) {
      const { data, error } = await client
        .from('trips')
        .update({ cover_image_path: null, cover_thumbnail_path: null })
        .eq('id', input.tripId)
        .eq('version', input.version)
        .select('*')
        .maybeSingle();

      if (error) {
        if (error.code === '42501') throw new AppError('TRIP_ACCESS_DENIED');
        throw mapSupabaseError(error);
      }
      if (!data) throw new AppError('UNKNOWN');

      const previousPaths = [
        input.currentImagePath,
        input.currentThumbnailPath,
      ].filter((path): path is string => Boolean(path));
      if (previousPaths.length > 0) {
        await client.storage.from('trip-files').remove(previousPaths);
      }

      return data;
    },

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
