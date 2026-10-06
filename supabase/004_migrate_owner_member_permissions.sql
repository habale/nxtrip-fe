-- NxTrip owner/member permission model
--
-- Owner:
--   Full trip management.
-- Member:
--   Read trip info, member list, itinerary, and files.
--   Manage ledger entries through the existing ledger RPCs.
--
-- This migration intentionally leaves private.can_edit_ledger() and all
-- ledger RPCs/policies unchanged. Existing trip-status restrictions continue
-- to apply to both owners and members.

begin;

-- ---------------------------------------------------------------------------
-- Trip members
-- Everyone with active trip access can read the list. Only owners can create
-- or change trip-member records. Account linking during join_trip_by_code()
-- continues to work because that RPC is SECURITY DEFINER.
-- ---------------------------------------------------------------------------

drop policy if exists trip_members_insert_member on public.trip_members;
drop policy if exists trip_members_insert_owner on public.trip_members;
drop policy if exists trip_members_update_member on public.trip_members;
drop policy if exists trip_members_update_owner on public.trip_members;

create policy trip_members_insert_owner
on public.trip_members
for insert
to authenticated
with check (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

create policy trip_members_update_owner
on public.trip_members
for update
to authenticated
using (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
)
with check (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

-- ---------------------------------------------------------------------------
-- Itinerary
-- Active members retain SELECT access through the existing select policies.
-- All itinerary mutations are owner-only.
-- ---------------------------------------------------------------------------

drop policy if exists itinerary_nodes_insert_member on public.itinerary_nodes;
drop policy if exists itinerary_nodes_insert_owner on public.itinerary_nodes;
drop policy if exists itinerary_nodes_update_member on public.itinerary_nodes;
drop policy if exists itinerary_nodes_update_owner on public.itinerary_nodes;

create policy itinerary_nodes_insert_owner
on public.itinerary_nodes
for insert
to authenticated
with check (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

create policy itinerary_nodes_update_owner
on public.itinerary_nodes
for update
to authenticated
using (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
)
with check (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

-- ---------------------------------------------------------------------------
-- Attachment metadata and relationships
-- Members may read files through existing SELECT policies. Only owners can
-- create, update, link, unlink, or delete attachment records.
-- ---------------------------------------------------------------------------

drop policy if exists attachments_insert_member on public.attachments;
drop policy if exists attachments_insert_owner on public.attachments;
drop policy if exists attachments_update_member on public.attachments;
drop policy if exists attachments_update_owner on public.attachments;
drop policy if exists attachments_delete_member on public.attachments;
drop policy if exists attachments_delete_owner on public.attachments;

create policy attachments_insert_owner
on public.attachments
for insert
to authenticated
with check (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

create policy attachments_update_owner
on public.attachments
for update
to authenticated
using (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
)
with check (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

create policy attachments_delete_owner
on public.attachments
for delete
to authenticated
using (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

drop policy if exists itinerary_node_attachments_insert_member
  on public.itinerary_node_attachments;
drop policy if exists itinerary_node_attachments_insert_owner
  on public.itinerary_node_attachments;
drop policy if exists itinerary_node_attachments_update_member
  on public.itinerary_node_attachments;
drop policy if exists itinerary_node_attachments_update_owner
  on public.itinerary_node_attachments;
drop policy if exists itinerary_node_attachments_delete_member
  on public.itinerary_node_attachments;
drop policy if exists itinerary_node_attachments_delete_owner
  on public.itinerary_node_attachments;

create policy itinerary_node_attachments_insert_owner
on public.itinerary_node_attachments
for insert
to authenticated
with check (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

create policy itinerary_node_attachments_update_owner
on public.itinerary_node_attachments
for update
to authenticated
using (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
)
with check (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

create policy itinerary_node_attachments_delete_owner
on public.itinerary_node_attachments
for delete
to authenticated
using (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

drop policy if exists expense_attachments_insert_member
  on public.expense_attachments;
drop policy if exists expense_attachments_insert_owner
  on public.expense_attachments;
drop policy if exists expense_attachments_delete_member
  on public.expense_attachments;
drop policy if exists expense_attachments_delete_owner
  on public.expense_attachments;

create policy expense_attachments_insert_owner
on public.expense_attachments
for insert
to authenticated
with check (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

create policy expense_attachments_delete_owner
on public.expense_attachments
for delete
to authenticated
using (
  private.has_trip_role(
    trip_id,
    array['owner']::public.access_role[]
  )
);

-- ---------------------------------------------------------------------------
-- Private Storage bucket
-- Members can download trip files. Only owners can upload, replace, or remove
-- objects. Object names must continue to begin with the trip UUID.
-- ---------------------------------------------------------------------------

drop policy if exists sxtrip_trip_files_insert on storage.objects;
drop policy if exists sxtrip_trip_files_update on storage.objects;
drop policy if exists sxtrip_trip_files_delete on storage.objects;

create policy sxtrip_trip_files_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip-files'
  and private.has_trip_role(
    private.storage_trip_id(name),
    array['owner']::public.access_role[]
  )
);

create policy sxtrip_trip_files_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trip-files'
  and private.has_trip_role(
    private.storage_trip_id(name),
    array['owner']::public.access_role[]
  )
)
with check (
  bucket_id = 'trip-files'
  and private.has_trip_role(
    private.storage_trip_id(name),
    array['owner']::public.access_role[]
  )
);

create policy sxtrip_trip_files_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trip-files'
  and private.has_trip_role(
    private.storage_trip_id(name),
    array['owner']::public.access_role[]
  )
);

commit;
