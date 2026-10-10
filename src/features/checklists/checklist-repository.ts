import { AppError } from '../../shared/api/app-error';
import type { Json } from '../../shared/api/database.types';
import { mapSupabaseError } from '../../shared/api/error-mapper';
import { createRequestId } from '../../shared/api/request-id';
import { getSupabaseClient } from '../../shared/api/supabase-client';
import type {
  Checklist,
  ChecklistDraftItem,
  ChecklistItem,
} from './checklist-types';

export type SaveChecklistInput = {
  tripId: string;
  title: string;
  description: string;
  items: ChecklistDraftItem[];
};

export type CreateChecklistInput = SaveChecklistInput & { nodeId: string };
export type UpdateChecklistInput = SaveChecklistInput & {
  checklistId: string;
  version: number;
};

export type ChecklistRepository = {
  getById: (tripId: string, checklistId: string) => Promise<Checklist>;
  create: (input: CreateChecklistInput) => Promise<string>;
  update: (input: UpdateChecklistInput) => Promise<string>;
  setChecked: (
    tripId: string,
    itemId: string,
    checked: boolean,
  ) => Promise<ChecklistItem>;
};

export function serializeChecklistItems(items: ChecklistDraftItem[]) {
  return items.map((item, index) => ({
    id: item.id,
    label: item.label.trim(),
    sort_key: String(index).padStart(6, '0'),
  })) as Json;
}

function parseChecklistItem(value: Json): ChecklistItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid checklist item response.');
  }
  return value as unknown as ChecklistItem;
}

export function createChecklistRepository(): ChecklistRepository {
  const client = getSupabaseClient();

  return {
    async getById(tripId, checklistId) {
      const [resourceResult, itemsResult] = await Promise.all([
        client
          .from('trip_app_resources')
          .select('*')
          .eq('trip_id', tripId)
          .eq('id', checklistId)
          .eq('app_type', 'checklist')
          .is('deleted_at', null)
          .maybeSingle(),
        client
          .from('checklist_items')
          .select('*')
          .eq('trip_id', tripId)
          .eq('app_resource_id', checklistId)
          .is('deleted_at', null)
          .order('sort_key', { ascending: true }),
      ]);
      if (resourceResult.error) throw mapSupabaseError(resourceResult.error);
      if (itemsResult.error) throw mapSupabaseError(itemsResult.error);
      if (!resourceResult.data) throw new AppError('TRIP_NOT_FOUND');
      return { resource: resourceResult.data, items: itemsResult.data };
    },

    async create(input) {
      const requestId = createRequestId();
      const { data, error } = await client.rpc('create_node_checklist', {
        p_trip_id: input.tripId,
        p_node_id: input.nodeId,
        p_title: input.title,
        p_description: input.description,
        p_items: serializeChecklistItems(input.items),
        p_request_id: requestId,
      });
      if (error) throw mapSupabaseError(error, requestId);
      return data;
    },

    async update(input) {
      const requestId = createRequestId();
      const { data, error } = await client.rpc('update_node_checklist', {
        p_trip_id: input.tripId,
        p_checklist_id: input.checklistId,
        p_version: input.version,
        p_title: input.title,
        p_description: input.description,
        p_items: serializeChecklistItems(input.items),
        p_request_id: requestId,
      });
      if (error) throw mapSupabaseError(error, requestId);
      return data;
    },

    async setChecked(tripId, itemId, checked) {
      const requestId = createRequestId();
      const { data, error } = await client.rpc('set_checklist_item_checked', {
        p_trip_id: tripId,
        p_item_id: itemId,
        p_checked: checked,
        p_request_id: requestId,
      });
      if (error) throw mapSupabaseError(error, requestId);
      return parseChecklistItem(data);
    },
  };
}

let repository: ChecklistRepository | undefined;

export function getChecklistRepository() {
  repository ??= createChecklistRepository();
  return repository;
}
