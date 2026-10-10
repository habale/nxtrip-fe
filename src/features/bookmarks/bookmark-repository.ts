import { mapSupabaseError } from '../../shared/api/error-mapper';
import { getSupabaseClient } from '../../shared/api/supabase-client';
import type { Database, Json } from '../../shared/api/database.types';

export type Bookmark = Database['public']['Tables']['bookmarks']['Row'];

export type CreateBookmarkInput = {
  tripId: string;
  ownerUserId: string;
  title: string;
  notes: string;
  sourceUrl: string;
  category: string;
  iconKey: string;
};

export type UpdateBookmarkInput = Omit<CreateBookmarkInput, 'ownerUserId'> & {
  bookmarkId: string;
  version: number;
};

export type RemoveBookmarkInput = Pick<
  UpdateBookmarkInput,
  'tripId' | 'bookmarkId' | 'version'
>;

export type BookmarkRepository = {
  listForTrip: (tripId: string) => Promise<Bookmark[]>;
  create: (input: CreateBookmarkInput) => Promise<Bookmark>;
  update: (input: UpdateBookmarkInput) => Promise<Bookmark>;
  remove: (input: RemoveBookmarkInput) => Promise<Bookmark>;
};

function bookmarkWrite(input: {
  title: string;
  notes: string;
  sourceUrl: string;
  category: string;
  iconKey: string;
}) {
  const sourceData: Json = {
    category: input.category,
    icon_key: input.iconKey,
  };
  return {
    title: input.title.trim(),
    notes: input.notes.trim() || null,
    source_url: input.sourceUrl.trim() || null,
    source_data: sourceData,
  };
}

export function createBookmarkRepository(): BookmarkRepository {
  const client = getSupabaseClient();

  return {
    async listForTrip(tripId) {
      const { data, error } = await client
        .from('bookmarks')
        .select('*')
        .eq('source_trip_id', tripId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw mapSupabaseError(error);
      return data;
    },

    async create(input) {
      const { data, error } = await client
        .from('bookmarks')
        .insert({
          ...bookmarkWrite(input),
          owner_user_id: input.ownerUserId,
          source_type: 'manual',
          source_trip_id: input.tripId,
        })
        .select('*')
        .single();
      if (error) throw mapSupabaseError(error);
      return data;
    },

    async update(input) {
      const { data, error } = await client
        .from('bookmarks')
        .update(bookmarkWrite(input))
        .eq('source_trip_id', input.tripId)
        .eq('id', input.bookmarkId)
        .eq('version', input.version)
        .is('deleted_at', null)
        .select('*')
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) throw new Error('Bookmark update conflict.');
      return data;
    },

    async remove(input) {
      const { data, error } = await client
        .from('bookmarks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('source_trip_id', input.tripId)
        .eq('id', input.bookmarkId)
        .eq('version', input.version)
        .is('deleted_at', null)
        .select('*')
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) throw new Error('Bookmark removal conflict.');
      return data;
    },
  };
}

let repository: BookmarkRepository | undefined;

export function getBookmarkRepository() {
  repository ??= createBookmarkRepository();
  return repository;
}
