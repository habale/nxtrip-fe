import { mapSupabaseError } from '../../shared/api/error-mapper';
import { createRequestId } from '../../shared/api/request-id';
import { getSupabaseClient } from '../../shared/api/supabase-client';
import type {
  LedgerData,
  LedgerMember,
  RecordTripTransferInput,
  SaveLedgerEntryInput,
} from './ledger-types';

export type LedgerRepository = {
  listExpenses: (tripId: string) => Promise<LedgerData>;
  saveEntry: (input: SaveLedgerEntryInput) => Promise<string>;
  recordTransfer: (input: RecordTripTransferInput) => Promise<string>;
};

export function createLedgerRepository(): LedgerRepository {
  const client = getSupabaseClient();

  return {
    async listExpenses(tripId) {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError) throw mapSupabaseError(authError);

      const [
        tripResult,
        expensesResult,
        membersResult,
        fundsResult,
        contributionsResult,
        transfersResult,
        currentMembershipResult,
      ] = await Promise.all([
        client
          .from('trips')
          .select('treasurer_member_id')
          .eq('id', tripId)
          .single(),
        client
          .from('expenses')
          .select('*')
          .eq('trip_id', tripId)
          .is('deleted_at', null)
          .order('occurred_at', { ascending: false }),
        client
          .from('trip_members')
          .select('*')
          .eq('trip_id', tripId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true }),
        client
          .from('trip_funds')
          .select('*')
          .eq('trip_id', tripId)
          .eq('is_active', true),
        client
          .from('fund_contributions')
          .select('*')
          .eq('trip_id', tripId)
          .is('deleted_at', null)
          .order('occurred_at', { ascending: false }),
        client
          .from('trip_transfers')
          .select('*')
          .eq('trip_id', tripId)
          .is('deleted_at', null)
          .order('occurred_at', { ascending: false }),
        client
          .from('trip_access_memberships')
          .select('trip_member_id')
          .eq('trip_id', tripId)
          .eq('user_id', authData.user.id)
          .eq('status', 'active')
          .maybeSingle(),
      ]);

      if (tripResult.error) throw mapSupabaseError(tripResult.error);
      if (expensesResult.error) throw mapSupabaseError(expensesResult.error);
      if (membersResult.error) throw mapSupabaseError(membersResult.error);
      if (fundsResult.error) throw mapSupabaseError(fundsResult.error);
      if (contributionsResult.error)
        throw mapSupabaseError(contributionsResult.error);
      if (transfersResult.error) throw mapSupabaseError(transfersResult.error);
      if (currentMembershipResult.error)
        throw mapSupabaseError(currentMembershipResult.error);

      const expenseIds = expensesResult.data.map(({ id }) => id);
      const nodeIds = expensesResult.data.flatMap(({ itinerary_node_id }) =>
        itinerary_node_id ? [itinerary_node_id] : [],
      );
      const emptyRelated = { data: [], error: null };
      const [sharesResult, attachmentsResult, nodesResult] = await Promise.all([
        expenseIds.length
          ? client
              .from('expense_shares')
              .select('*')
              .in('expense_id', expenseIds)
          : Promise.resolve(emptyRelated),
        expenseIds.length
          ? client
              .from('expense_attachments')
              .select('*')
              .in('expense_id', expenseIds)
          : Promise.resolve(emptyRelated),
        nodeIds.length
          ? client.from('itinerary_nodes').select('*').in('id', nodeIds)
          : Promise.resolve(emptyRelated),
      ]);

      if (sharesResult.error) throw mapSupabaseError(sharesResult.error);
      if (attachmentsResult.error)
        throw mapSupabaseError(attachmentsResult.error);
      if (nodesResult.error) throw mapSupabaseError(nodesResult.error);

      const members: LedgerMember[] = membersResult.data.map((member) => ({
        id: member.id,
        display_name: member.display_name,
        avatar_url: member.avatar_url,
      }));
      const memberById = new Map(members.map((member) => [member.id, member]));
      const fundById = new Map(fundsResult.data.map((fund) => [fund.id, fund]));
      const iconByNodeId = new Map(
        nodesResult.data.map((node) => [node.id, node.icon_key]),
      );

      return {
        members,
        currentMemberId: currentMembershipResult.data?.trip_member_id ?? null,
        treasurerMemberId: tripResult.data.treasurer_member_id,
        transfers: transfersResult.data.flatMap((transfer) => {
          const fromMember = memberById.get(transfer.from_member_id);
          const toMember = memberById.get(transfer.to_member_id);
          return fromMember && toMember
            ? [{ transfer, fromMember, toMember }]
            : [];
        }),
        funds: fundsResult.data.map((fund) => ({
          id: fund.id,
          name: fund.name,
          currency: fund.currency,
        })),
        contributions: contributionsResult.data.map((contribution) => {
          const fund = fundById.get(contribution.fund_id);
          return {
            contribution,
            member: memberById.get(contribution.member_id) ?? null,
            fundName: fund?.name ?? '',
            fundIsDefault: fund?.is_default ?? false,
          };
        }),
        expenses: expensesResult.data.map((expense) => ({
          expense,
          payer: expense.paid_by_member_id
            ? (memberById.get(expense.paid_by_member_id) ?? null)
            : null,
          shares: sharesResult.data.flatMap((share) => {
            if (share.expense_id !== expense.id) return [];
            const member = memberById.get(share.member_id);
            return member ? [{ member, amountMinor: share.amount_minor }] : [];
          }),
          attachmentCount: attachmentsResult.data.filter(
            (attachment) => attachment.expense_id === expense.id,
          ).length,
          itineraryIconKey: expense.itinerary_node_id
            ? (iconByNodeId.get(expense.itinerary_node_id) ?? null)
            : null,
        })),
      };
    },

    async saveEntry(input) {
      if (input.type === 'expense') {
        const { data, error } = await client.rpc('save_expense', {
          p_trip_id: input.tripId,
          p_title: input.title.trim(),
          p_amount_minor: input.amountMinor,
          p_currency: input.currency,
          p_payment_source: 'member',
          p_split_method: input.splitMode === 'equal' ? 'equal' : 'manual',
          p_occurred_at: input.occurredAt,
          p_members: input.shares.map((share) => ({
            member_id: share.memberId,
            amount_minor: share.amountMinor,
          })),
          p_paid_by_member_id: input.paidByMemberId,
          p_note: input.category ? `Category: ${input.category}` : undefined,
          p_request_id: createRequestId(),
        });
        if (error) throw mapSupabaseError(error);
        return data;
      }

      const { data, error } = await client.rpc('save_fund_contribution', {
        p_trip_id: input.tripId,
        p_member_id: input.paidByMemberId,
        p_contribution_type: input.type,
        p_amount_minor: input.amountMinor,
        p_occurred_at: input.occurredAt,
        p_note: input.title.trim() || undefined,
      });
      if (error) throw mapSupabaseError(error);
      return data;
    },

    async recordTransfer(input) {
      if (input.fromMemberId === input.toMemberId) {
        throw new Error('A transfer requires two different members.');
      }
      if (input.amountMinor <= 0) {
        throw new Error('A transfer amount must be greater than zero.');
      }

      const { data, error } = await client.rpc('record_trip_transfer', {
        p_trip_id: input.tripId,
        p_from_member_id: input.fromMemberId,
        p_to_member_id: input.toMemberId,
        p_amount_minor: input.amountMinor,
        p_currency: input.currency,
        p_occurred_at: input.occurredAt,
        p_note: input.note?.trim() || undefined,
        p_request_id: createRequestId(),
      });
      if (error) throw mapSupabaseError(error);
      return data;
    },
  };
}

let repository: LedgerRepository | undefined;

export function getLedgerRepository() {
  repository ??= createLedgerRepository();
  return repository;
}
