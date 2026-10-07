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

export type BookmarkRepository = {
  listForTrip: (tripId: string, ownerUserId: string) => Promise<Bookmark[]>;
  create: (input: CreateBookmarkInput) => Promise<Bookmark>;
};

export function createBookmarkRepository(): BookmarkRepository {
  const client = getSupabaseClient();

  return {
    async listForTrip(tripId, ownerUserId) {
      const { data, error } = await client
        .from('bookmarks')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .eq('source_trip_id', tripId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw mapSupabaseError(error);
      return data;
    },

    async create(input) {
      const sourceData: Json = {
        category: input.category,
        icon_key: input.iconKey,
      };
      const { data, error } = await client
        .from('bookmarks')
        .insert({
          owner_user_id: input.ownerUserId,
          title: input.title.trim(),
          notes: input.notes.trim() || null,
          source_type: 'manual',
          source_url: input.sourceUrl.trim() || null,
          source_trip_id: input.tripId,
          source_data: sourceData,
        })
        .select('*')
        .single();
      if (error) throw mapSupabaseError(error);
      return data;
    },
  };
}

let repository: BookmarkRepository | undefined;

export function getBookmarkRepository() {
  repository ??= createBookmarkRepository();
  return repository;
}
