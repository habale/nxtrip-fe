import { mapSupabaseError } from '../../shared/api/error-mapper';
import { getSupabaseClient } from '../../shared/api/supabase-client';
import type { LedgerData, LedgerMember } from './ledger-types';

export type LedgerRepository = {
  listExpenses: (tripId: string) => Promise<LedgerData>;
};

export function createLedgerRepository(): LedgerRepository {
  const client = getSupabaseClient();

  return {
    async listExpenses(tripId) {
      const [expensesResult, membersResult] = await Promise.all([
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
      ]);

      if (expensesResult.error) throw mapSupabaseError(expensesResult.error);
      if (membersResult.error) throw mapSupabaseError(membersResult.error);

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
      const iconByNodeId = new Map(
        nodesResult.data.map((node) => [node.id, node.icon_key]),
      );

      return {
        members,
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
  };
}

let repository: LedgerRepository | undefined;

export function getLedgerRepository() {
  repository ??= createLedgerRepository();
  return repository;
}
