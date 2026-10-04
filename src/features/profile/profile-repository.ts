import { AppError } from '../../shared/api/app-error';
import type { Database } from '../../shared/api/database.types';
import { mapSupabaseError } from '../../shared/api/error-mapper';
import { getSupabaseClient } from '../../shared/api/supabase-client';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export type ProfileRepository = {
  getCurrent: (userId: string) => Promise<Profile>;
  updateLanguage: (userId: string, language: string) => Promise<Profile>;
};

export function createProfileRepository(): ProfileRepository {
  const client = getSupabaseClient();

  return {
    async getCurrent(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw mapSupabaseError(error);
      if (!data) throw new AppError('USER_PROFILE_NOT_FOUND');

      return data;
    },

    async updateLanguage(userId, language) {
      const { data, error } = await client
        .from('profiles')
        .update({ language })
        .eq('id', userId)
        .select('*')
        .maybeSingle();

      if (error) throw mapSupabaseError(error);
      if (!data) throw new AppError('USER_PROFILE_NOT_FOUND');

      return data;
    },
  };
}

let repository: ProfileRepository | undefined;

export function getProfileRepository(): ProfileRepository {
  repository ??= createProfileRepository();
  return repository;
}
