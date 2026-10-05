import { mapSupabaseError } from '../../shared/api/error-mapper';
import { getSupabaseClient } from '../../shared/api/supabase-client';
import { convertImageToWebp } from '../../shared/images/image-conversion';
import {
  type ItineraryDateWindow,
  type ItineraryNode,
  type ItineraryWindow,
  type NodeAttachment,
  mapItineraryNode,
} from './itinerary-types';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_ITINERARY_WINDOW_DAYS = 31;

export type ItineraryRepository = {
  getDateWindow: (window: ItineraryDateWindow) => Promise<ItineraryWindow>;
  createNode: (input: SaveItineraryNodeInput) => Promise<ItineraryNode>;
  updateNode: (input: UpdateItineraryNodeInput) => Promise<ItineraryNode>;
  reorderNode: (input: ReorderItineraryNodeInput) => Promise<void>;
  removeNode: (input: RemoveItineraryNodeInput) => Promise<void>;
  addNodeAttachment: (input: AddNodeAttachmentInput) => Promise<void>;
};

export type AddNodeAttachmentInput = {
  tripId: string;
  nodeId: string;
  localDate: string;
  file: File;
  role: 'cover' | 'attachment';
  sortOrder: number;
  userId: string;
};

export type SaveItineraryNodeInput = {
  tripId: string;
  nodeType: 'stop' | 'move';
  title: string;
  localDate: string;
  startAt: string | null;
  endAt: string | null;
  timezone: string;
  allDay: boolean;
  durationMinutes: number | null;
  sortKey: string;
  googleMapsUrl: string;
  iconKey: string;
  additionalData: Record<
    string,
    import('../../shared/api/database.types').Json | undefined
  >;
  userId: string;
};

export type UpdateItineraryNodeInput = SaveItineraryNodeInput & {
  nodeId: string;
  version: number;
};

export type RemoveItineraryNodeInput = {
  tripId: string;
  nodeId: string;
  localDate: string;
  version: number;
  userId: string;
};

export type ReorderItineraryNodeInput = Omit<
  RemoveItineraryNodeInput,
  'localDate'
> & {
  sortKey: string;
};

function mapNodeWrite(input: SaveItineraryNodeInput) {
  return {
    node_type: input.nodeType,
    title: input.title.trim(),
    additional_data: input.additionalData,
    local_date: input.localDate,
    start_at: input.allDay ? null : input.startAt,
    end_at: input.allDay ? null : input.endAt,
    timezone: input.timezone,
    all_day: input.allDay,
    duration_minutes: input.durationMinutes,
    sort_key: input.sortKey,
    google_maps_url: input.googleMapsUrl.trim() || null,
    icon_key: input.iconKey,
    updated_by: input.userId,
  };
}

export function validateItineraryDateWindow(window: ItineraryDateWindow) {
  if (!window.tripId.trim()) throw new RangeError('Trip ID is required.');
  if (
    !ISO_DATE_PATTERN.test(window.startDate) ||
    !ISO_DATE_PATTERN.test(window.endDate)
  ) {
    throw new RangeError('Itinerary dates must use YYYY-MM-DD.');
  }
  if (window.endDate < window.startDate) {
    throw new RangeError('Itinerary end date cannot precede its start date.');
  }

  const start = Date.parse(`${window.startDate}T00:00:00Z`);
  const end = Date.parse(`${window.endDate}T00:00:00Z`);
  const dayCount = Math.round((end - start) / 86_400_000) + 1;
  if (dayCount > MAX_ITINERARY_WINDOW_DAYS) {
    throw new RangeError(
      `Itinerary windows cannot exceed ${MAX_ITINERARY_WINDOW_DAYS} days.`,
    );
  }
}

export function createItineraryRepository(): ItineraryRepository {
  const client = getSupabaseClient();

  return {
    async addNodeAttachment(input) {
      const attachmentId = crypto.randomUUID();
      const uploadFile = await convertImageToWebp(input.file);
      const safeName =
        uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment';
      const storagePath = `${input.tripId}/${attachmentId}/${safeName}`;
      const bucket = client.storage.from('trip-files');
      const upload = await bucket.upload(storagePath, uploadFile, {
        contentType: uploadFile.type || undefined,
        upsert: false,
      });
      if (upload.error) throw mapSupabaseError(upload.error);

      const attachment = await client.from('attachments').insert({
        id: attachmentId,
        trip_id: input.tripId,
        storage_path: storagePath,
        display_name: uploadFile.name,
        original_filename: input.file.name,
        mime_type: uploadFile.type || null,
        size_bytes: uploadFile.size,
        uploaded_by: input.userId,
      });
      if (attachment.error) {
        await bucket.remove([storagePath]);
        throw mapSupabaseError(attachment.error);
      }

      if (input.role === 'cover') {
        const previousCover = await client
          .from('itinerary_node_attachments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('trip_id', input.tripId)
          .eq('node_id', input.nodeId)
          .eq('role', 'cover')
          .is('deleted_at', null);
        if (previousCover.error) {
          await client
            .from('attachments')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', attachmentId);
          await bucket.remove([storagePath]);
          throw mapSupabaseError(previousCover.error);
        }
      }

      const link = await client.from('itinerary_node_attachments').insert({
        trip_id: input.tripId,
        node_id: input.nodeId,
        attachment_id: attachmentId,
        role: input.role,
        sort_order: input.sortOrder,
        label: input.file.name,
        created_by: input.userId,
      });
      if (link.error) {
        await client
          .from('attachments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', attachmentId);
        await bucket.remove([storagePath]);
        throw mapSupabaseError(link.error);
      }
    },

    async createNode(input) {
      const { data, error } = await client
        .from('itinerary_nodes')
        .insert({
          ...mapNodeWrite(input),
          trip_id: input.tripId,
          created_by: input.userId,
        })
        .select('*')
        .single();

      if (error) throw mapSupabaseError(error);
      return mapItineraryNode(data);
    },

    async updateNode(input) {
      const { data, error } = await client
        .from('itinerary_nodes')
        .update(mapNodeWrite(input))
        .eq('trip_id', input.tripId)
        .eq('id', input.nodeId)
        .eq('version', input.version)
        .select('*')
        .maybeSingle();

      if (error) throw mapSupabaseError(error);
      if (!data) throw new Error('Itinerary node update conflict.');
      return mapItineraryNode(data);
    },

    async reorderNode(input) {
      const { data, error } = await client
        .from('itinerary_nodes')
        .update({
          sort_key: input.sortKey,
          updated_by: input.userId,
        })
        .eq('trip_id', input.tripId)
        .eq('id', input.nodeId)
        .eq('version', input.version)
        .select('id')
        .maybeSingle();

      if (error) throw mapSupabaseError(error);
      if (!data) throw new Error('Itinerary node reorder conflict.');
    },

    async removeNode(input) {
      const { data, error } = await client
        .from('itinerary_nodes')
        .update({
          deleted_at: new Date().toISOString(),
          updated_by: input.userId,
        })
        .eq('trip_id', input.tripId)
        .eq('id', input.nodeId)
        .eq('version', input.version)
        .select('id')
        .maybeSingle();

      if (error) throw mapSupabaseError(error);
      if (!data) throw new Error('Itinerary node removal conflict.');
    },

    async getDateWindow(window) {
      validateItineraryDateWindow(window);

      const { data: nodeRows, error: nodeError } = await client
        .from('itinerary_nodes')
        .select('*')
        .eq('trip_id', window.tripId)
        .gte('local_date', window.startDate)
        .lte('local_date', window.endDate)
        .is('deleted_at', null)
        .order('local_date', { ascending: true })
        .order('sort_key', { ascending: true });

      if (nodeError) throw mapSupabaseError(nodeError);
      if (nodeRows.length === 0) return { ...window, nodes: [] };

      const nodeIds = nodeRows.map(({ id }) => id);
      const linksResult = await client
        .from('itinerary_node_attachments')
        .select('*')
        .in('node_id', nodeIds)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      if (linksResult.error) throw mapSupabaseError(linksResult.error);

      const attachmentIds = [
        ...new Set(linksResult.data.map(({ attachment_id }) => attachment_id)),
      ];
      const attachmentsResult = attachmentIds.length
        ? await client
            .from('attachments')
            .select('*')
            .in('id', attachmentIds)
            .is('deleted_at', null)
        : { data: [], error: null };

      if (attachmentsResult.error) {
        throw mapSupabaseError(attachmentsResult.error);
      }

      const filePaths = attachmentsResult.data.flatMap((attachment) => [
        attachment.storage_path,
        ...(attachment.thumbnail_path ? [attachment.thumbnail_path] : []),
      ]);
      const signedUrlByPath = new Map<string, string>();
      if (filePaths.length > 0) {
        const { data: signedFiles, error: signedUrlError } =
          await client.storage
            .from('trip-files')
            .createSignedUrls(filePaths, 60 * 60);
        if (signedUrlError) throw mapSupabaseError(signedUrlError);
        signedFiles?.forEach((file) => {
          if (file.path && file.signedUrl) {
            signedUrlByPath.set(file.path, file.signedUrl);
          }
        });
      }

      const attachmentById = new Map(
        attachmentsResult.data.map((attachment) => [attachment.id, attachment]),
      );
      const attachmentsByNode = new Map<string, NodeAttachment[]>();
      linksResult.data.forEach((link) => {
        const attachment = attachmentById.get(link.attachment_id);
        if (!attachment) return;
        const nodeAttachments = attachmentsByNode.get(link.node_id) ?? [];
        nodeAttachments.push({
          id: link.id,
          role: link.role,
          sortOrder: link.sort_order,
          label: link.label?.trim() || attachment.display_name,
          attachment,
          fileUrl: signedUrlByPath.get(attachment.storage_path) ?? null,
          thumbnailUrl: attachment.thumbnail_path
            ? (signedUrlByPath.get(attachment.thumbnail_path) ?? null)
            : null,
        });
        attachmentsByNode.set(link.node_id, nodeAttachments);
      });

      return {
        ...window,
        nodes: nodeRows.map((row) =>
          mapItineraryNode(row, attachmentsByNode.get(row.id)),
        ),
      };
    },
  };
}

let repository: ItineraryRepository | undefined;

export function getItineraryRepository() {
  repository ??= createItineraryRepository();
  return repository;
}
