import type { Database } from '../../shared/api/database.types';
import { mapSupabaseError } from '../../shared/api/error-mapper';
import { getSupabaseClient } from '../../shared/api/supabase-client';

export type TripContact = Database['public']['Tables']['trip_contacts']['Row'];

export type ContactDraft = Pick<TripContact, 'name' | 'phone' | 'email'>;

export type ContactRepository = {
  list: (tripId: string) => Promise<TripContact[]>;
  replace: (tripId: string, contacts: ContactDraft[]) => Promise<void>;
};

export function createContactRepository(): ContactRepository {
  const client = getSupabaseClient();
  return {
    async list(tripId) {
      const { data, error } = await client
        .from('trip_contacts')
        .select('*')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true });
      if (error) throw mapSupabaseError(error);
      return data;
    },
    async replace(tripId, contacts) {
      const { error } = await client.rpc('replace_trip_contacts', {
        p_trip_id: tripId,
        p_contacts: contacts.map((contact) => ({
          name: contact.name.trim(),
          phone: contact.phone?.trim() || null,
          email: contact.email?.trim() || null,
        })),
      });
      if (error) throw mapSupabaseError(error);
    },
  };
}

let repository: ContactRepository | undefined;

export function getContactRepository() {
  repository ??= createContactRepository();
  return repository;
}
