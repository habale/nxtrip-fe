-- Supabase installs pgcrypto in the trusted extensions schema. Migration 010
-- restricted these security-definer functions to a search path that omitted
-- it, so digest() and gen_random_bytes() could not resolve at runtime.

begin;

alter function private.resolve_guest_trip(text, uuid)
set search_path = public, auth, extensions, pg_temp;

alter function public.create_guest_invite(uuid, uuid)
set search_path = public, auth, extensions, pg_temp;

commit;
