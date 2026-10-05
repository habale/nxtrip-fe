import type { Database, Json } from '../../shared/api/database.types';

export type ItineraryNodeRow =
  Database['public']['Tables']['itinerary_nodes']['Row'];
export type ItineraryNodeAttachmentRow =
  Database['public']['Tables']['itinerary_node_attachments']['Row'];
export type AttachmentRow = Database['public']['Tables']['attachments']['Row'];

export type AdditionalInfoLine = {
  type: string;
  text: string;
};

export type NodeAttachment = {
  id: string;
  role: string;
  sortOrder: number;
  label: string;
  attachment: AttachmentRow;
  fileUrl: string | null;
  thumbnailUrl: string | null;
};

type ItineraryNodeBase = {
  id: string;
  tripId: string;
  title: string;
  localDate: string | null;
  startAt: string | null;
  endAt: string | null;
  timezone: string | null;
  allDay: boolean;
  durationMinutes: number | null;
  sortKey: string;
  googleMapsUrl: string | null;
  iconKey: string | null;
  additionalData: Record<string, Json | undefined>;
  additionalLines: AdditionalInfoLine[];
  attachments: NodeAttachment[];
  version: number;
};

export type StopNode = ItineraryNodeBase & {
  nodeType: 'stop';
};

export type MoveNode = ItineraryNodeBase & {
  nodeType: 'move';
  transportMode: string | null;
  operator: string | null;
};

export type UnknownItineraryNode = ItineraryNodeBase & {
  nodeType: 'unknown';
  sourceNodeType: string;
};

export type ItineraryNode = StopNode | MoveNode | UnknownItineraryNode;

export type ItineraryDateWindow = {
  tripId: string;
  startDate: string;
  endDate: string;
};

export type ItineraryWindow = ItineraryDateWindow & {
  nodes: ItineraryNode[];
};

export function isJsonObject(
  value: Json,
): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(data: Record<string, Json | undefined>, key: string) {
  const value = data[key];
  return typeof value === 'string' ? value : null;
}

export function readAdditionalLines(value: Json): AdditionalInfoLine[] {
  if (!isJsonObject(value) || !Array.isArray(value.lines)) return [];

  return value.lines.flatMap((line) => {
    if (!isJsonObject(line)) return [];
    const text = readString(line, 'text')?.trim();
    if (!text) return [];
    return [{ type: readString(line, 'type') ?? 'text', text }];
  });
}

export function mapItineraryNode(
  row: ItineraryNodeRow,
  attachments: NodeAttachment[] = [],
): ItineraryNode {
  const additionalData = isJsonObject(row.additional_data)
    ? row.additional_data
    : {};
  const base: ItineraryNodeBase = {
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    localDate: row.local_date,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone,
    allDay: row.all_day,
    durationMinutes: row.duration_minutes,
    sortKey: row.sort_key,
    googleMapsUrl: row.google_maps_url,
    iconKey: row.icon_key,
    additionalData,
    additionalLines: readAdditionalLines(row.additional_data),
    attachments,
    version: row.version,
  };

  if (row.node_type === 'stop') return { ...base, nodeType: 'stop' };
  if (row.node_type === 'move') {
    return {
      ...base,
      nodeType: 'move',
      transportMode: readString(additionalData, 'transport_mode'),
      operator: readString(additionalData, 'operator'),
    };
  }

  return {
    ...base,
    nodeType: 'unknown',
    sourceNodeType: row.node_type,
  };
}
