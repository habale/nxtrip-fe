import { mapSupabaseError } from '../../shared/api/error-mapper';
import { createRequestId } from '../../shared/api/request-id';
import { getSupabaseClient } from '../../shared/api/supabase-client';
import type {
  LedgerData,
  LedgerMember,
  SaveLedgerEntryInput,
} from './ledger-types';

export type LedgerRepository = {
  listExpenses: (tripId: string) => Promise<LedgerData>;
  saveEntry: (input: SaveLedgerEntryInput) => Promise<string>;
  markSettlementsDone: (settlementIds: string[]) => Promise<void>;
};

export function createLedgerRepository(): LedgerRepository {
  const client = getSupabaseClient();

  return {
    async listExpenses(tripId) {
      const [
        expensesResult,
        membersResult,
        fundsResult,
        contributionsResult,
        settlementRunsResult,
      ] = await Promise.all([
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
          .from('settlement_runs')
          .select('*')
          .eq('trip_id', tripId)
          .eq('status', 'active')
          .limit(1),
      ]);

      if (expensesResult.error) throw mapSupabaseError(expensesResult.error);
      if (membersResult.error) throw mapSupabaseError(membersResult.error);
      if (fundsResult.error) throw mapSupabaseError(fundsResult.error);
      if (contributionsResult.error)
        throw mapSupabaseError(contributionsResult.error);
      if (settlementRunsResult.error)
        throw mapSupabaseError(settlementRunsResult.error);

      const expenseIds = expensesResult.data.map(({ id }) => id);
      const nodeIds = expensesResult.data.flatMap(({ itinerary_node_id }) =>
        itinerary_node_id ? [itinerary_node_id] : [],
      );
      const emptyRelated = { data: [], error: null };
      const activeSettlementRunId = settlementRunsResult.data[0]?.id;
      const [sharesResult, attachmentsResult, nodesResult, settlementsResult] =
        await Promise.all([
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
          activeSettlementRunId
            ? client
                .from('settlements')
                .select('*')
                .eq('settlement_run_id', activeSettlementRunId)
            : Promise.resolve(emptyRelated),
        ]);

      if (sharesResult.error) throw mapSupabaseError(sharesResult.error);
      if (attachmentsResult.error)
        throw mapSupabaseError(attachmentsResult.error);
      if (nodesResult.error) throw mapSupabaseError(nodesResult.error);
      if (settlementsResult.error)
        throw mapSupabaseError(settlementsResult.error);

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
        settlements: settlementsResult.data,
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

    async markSettlementsDone(settlementIds) {
      await Promise.all(
        settlementIds.map(async (settlementId) => {
          const { error } = await client.rpc('mark_settlement_done', {
            p_settlement_id: settlementId,
            p_request_id: createRequestId(),
          });
          if (error) throw mapSupabaseError(error);
        }),
      );
    },
  };
}

let repository: LedgerRepository | undefined;

export function getLedgerRepository() {
  repository ??= createLedgerRepository();
  return repository;
}
