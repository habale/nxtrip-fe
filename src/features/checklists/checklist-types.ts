import type { Database } from '../../shared/api/database.types';

export type ChecklistItem =
  Database['public']['Tables']['checklist_items']['Row'];

export type Checklist = {
  resource: Database['public']['Tables']['trip_app_resources']['Row'];
  items: ChecklistItem[];
};

export type NodeChecklistSummary = {
  linkId: string;
  id: string;
  title: string;
  itemCount: number;
  completedCount: number;
};

export type ChecklistDraftItem = {
  id: string;
  label: string;
};
