import { mapSupabaseError } from '../../shared/api/error-mapper';
import { getSupabaseClient } from '../../shared/api/supabase-client';
import {
  type ItineraryDateWindow,
  type ItineraryWindow,
  type NodeAttachment,
  mapItineraryNode,
} from './itinerary-types';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_ITINERARY_WINDOW_DAYS = 31;

export type ItineraryRepository = {
  getDateWindow: (window: ItineraryDateWindow) => Promise<ItineraryWindow>;
};

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

      const thumbnailPaths = attachmentsResult.data.flatMap((attachment) =>
        attachment.thumbnail_path ? [attachment.thumbnail_path] : [],
      );
      const thumbnailUrlByPath = new Map<string, string>();
      if (thumbnailPaths.length > 0) {
        const { data: signedThumbnails, error: signedUrlError } =
          await client.storage
            .from('trip-files')
            .createSignedUrls(thumbnailPaths, 60 * 60);
        if (signedUrlError) throw mapSupabaseError(signedUrlError);
        signedThumbnails?.forEach((thumbnail) => {
          if (thumbnail.path && thumbnail.signedUrl) {
            thumbnailUrlByPath.set(thumbnail.path, thumbnail.signedUrl);
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
          thumbnailUrl: attachment.thumbnail_path
            ? (thumbnailUrlByPath.get(attachment.thumbnail_path) ?? null)
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
