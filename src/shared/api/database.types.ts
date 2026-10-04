// Derived from nxtrip_initial_schema_V2.sql, schema revision 1.3.
// Replace this file with Supabase CLI output after the schema is deployed.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type DatabaseTable<
  Row extends Record<string, unknown>,
  RequiredInsertKeys extends keyof Row = never,
> = {
  Row: Row;
  Insert: Pick<Row, RequiredInsertKeys> &
    Partial<Omit<Row, RequiredInsertKeys>>;
  Update: Partial<Row>;
  Relationships: [];
};

type ProfileRow = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  language: string;
  theme: string;
  created_at: string;
  updated_at: string;
};
type TripRow = {
  id: string;
  name: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  timezone: string;
  status: Database['public']['Enums']['trip_status'];
  default_currency: string;
  cover_image_path: string | null;
  cover_thumbnail_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};
type TripMemberRow = {
  id: string;
  trip_id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  note: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};
type TripAccessMembershipRow = {
  id: string;
  trip_id: string;
  user_id: string;
  trip_member_id: string | null;
  role: Database['public']['Enums']['access_role'];
  status: Database['public']['Enums']['access_status'];
  joined_at: string;
  created_at: string;
  updated_at: string;
  version: number;
};
type TripInviteRow = {
  id: string;
  trip_id: string;
  code: string;
  role: Database['public']['Enums']['access_role'];
  created_by: string | null;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  version: number;
};
type ItineraryNodeRow = {
  id: string;
  trip_id: string;
  node_type: string;
  title: string;
  additional_data: Json;
  local_date: string | null;
  start_at: string | null;
  end_at: string | null;
  timezone: string | null;
  all_day: boolean;
  duration_minutes: number | null;
  sort_key: string;
  google_maps_url: string | null;
  icon_key: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};
type BookmarkRow = {
  id: string;
  owner_user_id: string;
  title: string;
  notes: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  source_type: string;
  source_url: string | null;
  place_provider: string | null;
  provider_place_id: string | null;
  source_trip_id: string | null;
  source_node_id: string | null;
  source_data: Json;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};
type AttachmentRow = {
  id: string;
  trip_id: string;
  storage_bucket: string;
  storage_path: string;
  display_name: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  category: string | null;
  thumbnail_path: string | null;
  metadata: Json;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};
type ItineraryNodeAttachmentRow = {
  id: string;
  trip_id: string;
  node_id: string;
  attachment_id: string;
  role: string;
  sort_order: number;
  label: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};
type TripFundRow = {
  id: string;
  trip_id: string;
  name: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  version: number;
};
type ExpenseRow = {
  id: string;
  trip_id: string;
  title: string;
  note: string | null;
  amount_minor: number;
  currency: string;
  payment_source: Database['public']['Enums']['payment_source'];
  paid_by_member_id: string | null;
  paid_by_fund_id: string | null;
  split_method: string;
  occurred_at: string;
  itinerary_node_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};
type ExpenseShareRow = {
  id: string;
  trip_id: string;
  expense_id: string;
  member_id: string;
  amount_minor: number;
  created_at: string;
  updated_at: string;
};
type ExpenseAttachmentRow = {
  trip_id: string;
  expense_id: string;
  attachment_id: string;
  role: string;
  created_at: string;
};
type FundContributionRow = {
  id: string;
  trip_id: string;
  fund_id: string;
  member_id: string;
  contribution_type: string;
  amount_minor: number;
  currency: string;
  note: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};
type SettlementRunRow = {
  id: string;
  trip_id: string;
  status: Database['public']['Enums']['settlement_run_status'];
  generated_by: string | null;
  generated_at: string;
  superseded_at: string | null;
  calculation_meta: Json;
};
type SettlementRow = {
  id: string;
  trip_id: string;
  settlement_run_id: string;
  from_member_id: string;
  to_member_id: string;
  amount_minor: number;
  currency: string;
  status: Database['public']['Enums']['settlement_status'];
  marked_done_by: string | null;
  marked_done_at: string | null;
  created_at: string;
};
type DeviceInstallationRow = {
  id: string;
  user_id: string;
  platform: Database['public']['Enums']['device_platform'];
  push_token: string;
  device_name: string | null;
  app_version: string | null;
  locale: string | null;
  timezone: string | null;
  push_enabled: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};
type NotificationPreferenceRow = {
  user_id: string;
  category: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};
type NotificationOutboxRow = {
  id: string;
  user_id: string | null;
  trip_id: string | null;
  notification_type: string;
  payload: Json;
  status: Database['public']['Enums']['notification_outbox_status'];
  attempt_count: number;
  scheduled_at: string;
  processed_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};
type AuditEventRow = {
  id: string;
  trip_id: string;
  actor_user_id: string | null;
  request_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  metadata: Json;
  created_at: string;
};
type AppVersionPolicyRow = {
  platform: string;
  minimum_version: string;
  recommended_version: string;
  store_url: string | null;
  message_en: string | null;
  message_vi: string | null;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: DatabaseTable<ProfileRow, 'id' | 'display_name'>;
      trips: DatabaseTable<TripRow, 'name'>;
      trip_members: DatabaseTable<TripMemberRow, 'trip_id' | 'display_name'>;
      trip_access_memberships: DatabaseTable<
        TripAccessMembershipRow,
        'trip_id' | 'user_id'
      >;
      trip_invites: DatabaseTable<TripInviteRow, 'trip_id' | 'code'>;
      itinerary_nodes: DatabaseTable<
        ItineraryNodeRow,
        'trip_id' | 'node_type' | 'sort_key'
      >;
      bookmarks: DatabaseTable<
        BookmarkRow,
        'owner_user_id' | 'title' | 'source_type'
      >;
      attachments: DatabaseTable<
        AttachmentRow,
        'trip_id' | 'storage_path' | 'display_name'
      >;
      itinerary_node_attachments: DatabaseTable<
        ItineraryNodeAttachmentRow,
        'trip_id' | 'node_id' | 'attachment_id'
      >;
      trip_funds: DatabaseTable<TripFundRow, 'trip_id' | 'name' | 'currency'>;
      expenses: DatabaseTable<
        ExpenseRow,
        | 'trip_id'
        | 'title'
        | 'amount_minor'
        | 'currency'
        | 'payment_source'
        | 'split_method'
      >;
      expense_shares: DatabaseTable<
        ExpenseShareRow,
        'trip_id' | 'expense_id' | 'member_id' | 'amount_minor'
      >;
      expense_attachments: DatabaseTable<
        ExpenseAttachmentRow,
        'trip_id' | 'expense_id' | 'attachment_id'
      >;
      fund_contributions: DatabaseTable<
        FundContributionRow,
        | 'trip_id'
        | 'fund_id'
        | 'member_id'
        | 'contribution_type'
        | 'amount_minor'
        | 'currency'
      >;
      settlement_runs: DatabaseTable<SettlementRunRow, 'trip_id'>;
      settlements: DatabaseTable<
        SettlementRow,
        | 'trip_id'
        | 'settlement_run_id'
        | 'from_member_id'
        | 'to_member_id'
        | 'amount_minor'
        | 'currency'
      >;
      device_installations: DatabaseTable<
        DeviceInstallationRow,
        'user_id' | 'platform' | 'push_token'
      >;
      notification_preferences: DatabaseTable<
        NotificationPreferenceRow,
        'user_id' | 'category'
      >;
      notification_outbox: DatabaseTable<
        NotificationOutboxRow,
        'notification_type'
      >;
      audit_events: DatabaseTable<
        AuditEventRow,
        'trip_id' | 'request_id' | 'entity_type' | 'action'
      >;
      app_version_policies: DatabaseTable<
        AppVersionPolicyRow,
        'platform' | 'minimum_version' | 'recommended_version'
      >;
    };
    Views: Record<never, never>;
    Functions: {
      join_trip_by_code: {
        Args: { p_code: string; p_request_id?: string };
        Returns: string;
      };
      mark_settlement_done: {
        Args: { p_settlement_id: string; p_request_id?: string };
        Returns: undefined;
      };
      save_expense: {
        Args: {
          p_trip_id: string;
          p_title: string;
          p_amount_minor: number;
          p_currency: string;
          p_payment_source: Database['public']['Enums']['payment_source'];
          p_split_method: string;
          p_occurred_at: string;
          p_members: Json;
          p_paid_by_member_id?: string;
          p_paid_by_fund_id?: string;
          p_itinerary_node_id?: string;
          p_note?: string;
          p_expense_id?: string;
          p_request_id?: string;
        };
        Returns: string;
      };
      soft_delete_expense: {
        Args: { p_expense_id: string; p_request_id?: string };
        Returns: undefined;
      };
    };
    Enums: {
      access_role: 'owner' | 'member';
      access_status: 'active' | 'revoked';
      device_platform: 'ios' | 'android' | 'web';
      notification_outbox_status:
        'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
      payment_source: 'member' | 'group_fund';
      settlement_run_status: 'active' | 'superseded';
      settlement_status: 'pending' | 'done';
      trip_status: 'planning' | 'ongoing' | 'pending_settlement' | 'completed';
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database['public'];
export type TableName = keyof PublicSchema['Tables'];
export type Tables<Name extends TableName> =
  PublicSchema['Tables'][Name]['Row'];
export type TablesInsert<Name extends TableName> =
  PublicSchema['Tables'][Name]['Insert'];
export type TablesUpdate<Name extends TableName> =
  PublicSchema['Tables'][Name]['Update'];
export type EnumName = keyof PublicSchema['Enums'];
export type Enums<Name extends EnumName> = PublicSchema['Enums'][Name];
