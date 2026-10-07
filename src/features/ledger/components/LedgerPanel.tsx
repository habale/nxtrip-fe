import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  ConfirmDialog,
  FabButton,
  Icon,
  Item,
  Modal,
  Segment,
  Skeleton,
  SwipeItem,
  SwipeStartActionItem,
} from '../../../shared/ui';
import type { IconName } from '../../../shared/ui/Icon';
import type { Trip, TripDetail } from '../../trips/trip-repository';
import {
  useDeleteLedgerExpense,
  useDeleteLedgerTransfer,
  useLedgerExpenses,
  useRecordTripTransfer,
} from '../ledger-hooks';
import type { LedgerRepository } from '../ledger-repository';
import { calculateLedgerBalanceMinor } from '../ledger-balance';
import {
  createDirectTransferSuggestions,
  createTreasurerSuggestion,
  type TransferSuggestion,
} from '../ledger-transfer-suggestions';
import {
  formatMoney,
  ledgerDateKey,
  type LedgerData,
  type LedgerExpense,
  type LedgerTransfer,
} from '../ledger-types';

import './ledger.css';
import { AddLedgerEntryModal } from './AddLedgerEntryModal';

type LedgerPanelProps = {
  trip: Trip;
  locale: string;
  viewerRole: TripDetail['role'];
  canEdit?: boolean;
  repository?: LedgerRepository;
};

const iconNames = new Set<IconName>([
  'activity',
  'cafe',
  'flight',
  'hotel',
  'misc',
  'restaurant',
  'shopping',
  'sightseeing',
  'train',
  'vehicle',
  'walk',
  'ferry',
  'ticket',
]);

function expenseIcon(expense: LedgerExpense): IconName {
  const value = expense.itineraryIconKey as IconName | null;
  if (value && iconNames.has(value)) return value;

  const category = expense.expense.note?.match(/^Category: ([a-z]+)$/i)?.[1];
  const categoryIcons: Record<string, IconName> = {
    moving: 'train',
    dining: 'restaurant',
    cafe: 'cafe',
    lodging: 'hotel',
    shopping: 'shopping',
    sightseeing: 'sightseeing',
    activity: 'activity',
    misc: 'misc',
  };
  return category ? (categoryIcons[category] ?? 'wallet') : 'wallet';
}

function formatGroupDate(
  dateKey: string,
  locale: string,
  timezone: string,
  labels: {
    today: (date: string) => string;
    yesterday: (date: string) => string;
  },
) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const today = ledgerDateKey(new Date().toISOString(), timezone);
  const yesterday = ledgerDateKey(
    new Date(Date.now() - 86_400_000).toISOString(),
    timezone,
  );
  const formatted = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  if (dateKey === today) return labels.today(formatted);
  if (dateKey === yesterday) return labels.yesterday(formatted);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function MemberStack({ expense }: { expense: LedgerExpense }) {
  const { t } = useTranslation('common');
  const visible = expense.shares.slice(0, 3);
  return (
    <div
      className="ledger-member-stack"
      aria-label={t('ledger.members', { count: expense.shares.length })}
    >
      {visible.map(({ member }) => (
        <Avatar
          key={member.id}
          name={member.display_name}
          src={member.avatar_url ?? undefined}
          size="small"
          initialCount={2}
        />
      ))}
      {expense.shares.length > 3 && <span>+{expense.shares.length - 3}</span>}
    </div>
  );
}

function ExpenseCard({
  expense,
  locale,
  decimalPlaces,
  canEdit,
  onEdit,
  onRemove,
}: {
  expense: LedgerExpense;
  locale: string;
  decimalPlaces: number;
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('common');
  const equalAmount = expense.shares[0]?.amountMinor;
  const equalSplit = expense.expense.split_method === 'equal';
  const card = (
    <article className="ledger-expense-card">
      <div
        className={`ledger-expense-icon ledger-expense-icon--${expenseIcon(expense)}`}
      >
        <Icon name={expenseIcon(expense)} />
      </div>
      <div className="ledger-expense-main">
        <h4>{expense.expense.title}</h4>
        <p>
          {expense.expense.payment_source === 'group_fund'
            ? t('ledger.paidFromFund')
            : t('ledger.paidBy', {
                name: expense.payer?.display_name ?? t('ledger.unknownMember'),
              })}
        </p>
      </div>
      <div className="ledger-expense-amount">
        <strong>
          {formatMoney(
            expense.expense.amount_minor,
            expense.expense.currency,
            locale,
            decimalPlaces,
          )}
        </strong>
        <span>
          {equalSplit && equalAmount !== undefined
            ? t('ledger.each', {
                amount: formatMoney(
                  equalAmount,
                  expense.expense.currency,
                  locale,
                  decimalPlaces,
                ),
              })
            : t('ledger.customSplit')}
        </span>
      </div>
      <div className="ledger-expense-meta">
        <MemberStack expense={expense} />
        <span>
          {t('ledger.peopleJoined', { count: expense.shares.length })}
        </span>
      </div>
      {(expense.expense.itinerary_node_id || expense.attachmentCount > 0) && (
        <div className="ledger-expense-links">
          {expense.expense.itinerary_node_id && (
            <span>
              <Icon name="location" size="small" />
              {t('ledger.itineraryLink')}
            </span>
          )}
          {expense.attachmentCount > 0 && (
            <span>
              <Icon name="attachment" size="small" /> {expense.attachmentCount}
            </span>
          )}
        </div>
      )}
    </article>
  );
  return canEdit ? (
    <SwipeItem
      className="ledger-expense-sliding"
      editLabel={t('actions.edit')}
      removeLabel={t('actions.remove')}
      onEdit={onEdit}
      onRemove={onRemove}
    >
      <Item className="ledger-expense-swipe-item">{card}</Item>
    </SwipeItem>
  ) : (
    card
  );
}

function MemberExpenseCard({
  expense,
  memberId,
  locale,
  decimalPlaces,
}: {
  expense: LedgerExpense;
  memberId: string;
  locale: string;
  decimalPlaces: number;
}) {
  const { t } = useTranslation('common');
  const share = expense.shares.find(({ member }) => member.id === memberId);
  const paid = expense.payer?.id === memberId;

  return (
    <article className="ledger-member-expense-card">
      <div
        className={`ledger-expense-icon ledger-expense-icon--${expenseIcon(expense)}`}
      >
        <Icon name={expenseIcon(expense)} />
      </div>
      <div>
        <h4>{expense.expense.title}</h4>
        <p>
          {paid && (
            <>
              {t('ledger.paid')}{' '}
              <strong className="ledger-money--paid">
                {formatMoney(
                  expense.expense.amount_minor,
                  expense.expense.currency,
                  locale,
                  decimalPlaces,
                )}
              </strong>
            </>
          )}
          {paid && share && <span aria-hidden="true"> • </span>}
          {share && (
            <>
              {t('ledger.share')}{' '}
              <strong className="ledger-money--share">
                {formatMoney(
                  share.amountMinor,
                  expense.expense.currency,
                  locale,
                  decimalPlaces,
                )}
              </strong>
            </>
          )}
        </p>
      </div>
    </article>
  );
}

function TransferCard({
  item,
  locale,
  decimalPlaces,
  canEdit,
  onEdit,
  onRemove,
}: {
  item: LedgerTransfer;
  locale: string;
  decimalPlaces: number;
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('common');
  const card = (
    <article className="ledger-expense-card ledger-transfer-card">
      <div className="ledger-expense-icon ledger-transfer-icon">
        <Icon name="transfer" />
      </div>
      <div className="ledger-expense-main">
        <h4>
          {item.fromMember.display_name} <span aria-hidden="true">→</span>{' '}
          {item.toMember.display_name}
        </h4>
        <p>{item.transfer.note || t('ledger.transfer')}</p>
      </div>
      <div className="ledger-expense-amount">
        <strong>
          {formatMoney(
            item.transfer.amount_minor,
            item.transfer.currency,
            locale,
            decimalPlaces,
          )}
        </strong>
        <span>{t('ledger.transferred')}</span>
      </div>
    </article>
  );
  return canEdit ? (
    <SwipeItem
      className="ledger-expense-sliding"
      editLabel={t('actions.edit')}
      removeLabel={t('actions.remove')}
      onEdit={onEdit}
      onRemove={onRemove}
    >
      <Item className="ledger-expense-swipe-item">{card}</Item>
    </SwipeItem>
  ) : (
    card
  );
}

function MemberTransferCard({
  item,
  memberId,
  locale,
  decimalPlaces,
}: {
  item: LedgerTransfer;
  memberId: string;
  locale: string;
  decimalPlaces: number;
}) {
  const { t } = useTranslation('common');
  const sent = item.fromMember.id === memberId;
  return (
    <article className="ledger-member-expense-card">
      <div className="ledger-expense-icon ledger-transfer-icon">
        <Icon name="transfer" />
      </div>
      <div>
        <h4>
          {item.fromMember.display_name} <span aria-hidden="true">→</span>{' '}
          {item.toMember.display_name}
        </h4>
        <p>
          {t(sent ? 'ledger.sent' : 'ledger.received')}{' '}
          <strong
            className={sent ? 'ledger-money--paid' : 'ledger-money--share'}
          >
            {formatMoney(
              item.transfer.amount_minor,
              item.transfer.currency,
              locale,
              decimalPlaces,
            )}
          </strong>
        </p>
      </div>
    </article>
  );
}

type LedgerContribution = LedgerData['contributions'][number];
type LedgerMember = LedgerData['members'][number];
type MemberTimelineItem =
  | { kind: 'expense'; value: LedgerExpense }
  | { kind: 'contribution'; value: LedgerContribution }
  | { kind: 'transfer'; value: LedgerTransfer };
type AllTimelineItem =
  | { kind: 'expense'; value: LedgerExpense }
  | { kind: 'transfer'; value: LedgerTransfer };

type MemberFinancialSummary = {
  member: LedgerMember;
  paidMinor: number;
  shareMinor: number;
  depositMinor: number;
  sponsorMinor: number;
  transferSentMinor: number;
  transferReceivedMinor: number;
  balanceMinor: number;
};

function calculateMemberSummary(
  data: LedgerData,
  member: LedgerMember,
): MemberFinancialSummary {
  const paidMinor = data.expenses.reduce(
    (sum, item) =>
      sum + (item.payer?.id === member.id ? item.expense.amount_minor : 0),
    0,
  );
  const shareMinor = data.expenses.reduce(
    (sum, item) =>
      sum +
      (item.shares.find((share) => share.member.id === member.id)
        ?.amountMinor ?? 0),
    0,
  );
  const depositMinor = data.contributions.reduce(
    (sum, item) =>
      sum +
      (item.member?.id === member.id &&
      item.contribution.contribution_type === 'deposit'
        ? item.contribution.amount_minor
        : 0),
    0,
  );
  const sponsorMinor = data.contributions.reduce(
    (sum, item) =>
      sum +
      (item.member?.id === member.id &&
      item.contribution.contribution_type === 'sponsor'
        ? item.contribution.amount_minor
        : 0),
    0,
  );
  const transferSentMinor = data.transfers.reduce(
    (sum, item) =>
      sum + (item.fromMember.id === member.id ? item.transfer.amount_minor : 0),
    0,
  );
  const transferReceivedMinor = data.transfers.reduce(
    (sum, item) =>
      sum + (item.toMember.id === member.id ? item.transfer.amount_minor : 0),
    0,
  );

  return {
    member,
    paidMinor,
    shareMinor,
    depositMinor,
    sponsorMinor,
    transferSentMinor,
    transferReceivedMinor,
    balanceMinor: calculateLedgerBalanceMinor({
      paidMinor,
      shareMinor,
      depositMinor,
      transferSentMinor,
      transferReceivedMinor,
    }),
  };
}

function GroupSummaryCard({
  summary,
  currency,
  locale,
  decimalPlaces,
  onSelect,
  transferSuggestion,
  transferring,
  onTransfer,
  canTransfer,
}: {
  summary: MemberFinancialSummary;
  currency: string;
  locale: string;
  decimalPlaces: number;
  onSelect: () => void;
  transferSuggestion: TransferSuggestion | null;
  transferring: boolean;
  onTransfer: (suggestion: TransferSuggestion) => void;
  canTransfer: boolean;
}) {
  const { t } = useTranslation('common');
  const paidAndSentMinor = summary.paidMinor + summary.transferSentMinor;
  const shareAndReceivedMinor =
    summary.shareMinor + summary.transferReceivedMinor;
  const balanceClass =
    summary.balanceMinor > 0
      ? 'positive'
      : summary.balanceMinor < 0
        ? 'negative'
        : 'neutral';
  const balanceLabel =
    summary.balanceMinor > 0
      ? t('ledger.toReceive')
      : summary.balanceMinor < 0
        ? t('ledger.owesGroupShort')
        : t('ledger.settled');

  return (
    <SwipeStartActionItem
      className="ledger-group-member-item"
      actionLabel={t('ledger.viewAsMember')}
      icon="person"
      onAction={onSelect}
      endActionLabel={t('ledger.transferred')}
      endIcon="check"
      endDisabled={!canTransfer || !transferSuggestion || transferring}
      onEndAction={() => {
        if (transferSuggestion) onTransfer(transferSuggestion);
      }}
    >
      <article className="ledger-group-member">
        <Avatar
          name={summary.member.display_name}
          src={summary.member.avatar_url ?? undefined}
          initialCount={2}
        />
        <span className="ledger-group-member__info">
          <strong>{summary.member.display_name}</strong>
          <span>
            {t('ledger.paidOut')}{' '}
            {formatMoney(paidAndSentMinor, currency, locale, decimalPlaces)}
          </span>
          <span>
            {t('ledger.fairShare')}{' '}
            {formatMoney(
              shareAndReceivedMinor,
              currency,
              locale,
              decimalPlaces,
            )}
          </span>
        </span>
        <span className="ledger-group-member__balance">
          <strong className={`ledger-balance ledger-balance--${balanceClass}`}>
            {formatMoney(
              Math.abs(summary.balanceMinor),
              currency,
              locale,
              decimalPlaces,
            )}
          </strong>
          <span>{balanceLabel}</span>
        </span>
      </article>
    </SwipeStartActionItem>
  );
}

function TransferSuggestionCard({
  suggestion,
  currency,
  locale,
  decimalPlaces,
  transferring,
  onTransfer,
  canTransfer,
}: {
  suggestion: TransferSuggestion;
  currency: string;
  locale: string;
  decimalPlaces: number;
  transferring: boolean;
  onTransfer: (suggestion: TransferSuggestion) => void;
  canTransfer: boolean;
}) {
  const { t } = useTranslation('common');
  return (
    <SwipeStartActionItem
      className="ledger-group-member-item"
      endActionLabel={t('ledger.transferred')}
      endIcon="check"
      endDisabled={!canTransfer || transferring}
      onEndAction={() => onTransfer(suggestion)}
    >
      <article className="ledger-transfer-suggestion">
        <span className="ledger-transfer-suggestion__route">
          <span className="ledger-transfer-suggestion__member">
            <Avatar
              name={suggestion.fromMember.display_name}
              src={suggestion.fromMember.avatar_url ?? undefined}
              initialCount={2}
            />
            <strong>{suggestion.fromMember.display_name}</strong>
          </span>
          <Icon name="transfer" />
          <span className="ledger-transfer-suggestion__member">
            <Avatar
              name={suggestion.toMember.display_name}
              src={suggestion.toMember.avatar_url ?? undefined}
              initialCount={2}
            />
            <strong>{suggestion.toMember.display_name}</strong>
          </span>
        </span>
        <strong className="ledger-balance ledger-balance--positive">
          {formatMoney(suggestion.amountMinor, currency, locale, decimalPlaces)}
        </strong>
      </article>
    </SwipeStartActionItem>
  );
}

function MemberContributionCard({
  item,
  locale,
  decimalPlaces,
}: {
  item: LedgerContribution;
  locale: string;
  decimalPlaces: number;
}) {
  const { t } = useTranslation('common');
  const sponsor = item.contribution.contribution_type === 'sponsor';
  const typeLabel = t(sponsor ? 'ledger.sponsor' : 'ledger.deposit');
  return (
    <article className="ledger-member-expense-card">
      <div
        className={`ledger-expense-icon ledger-contribution-icon${sponsor ? ' ledger-contribution-icon--sponsor' : ''}`}
      >
        <Icon name={sponsor ? 'savings' : 'wallet'} size="large" />
      </div>
      <div>
        <h4>{item.contribution.note || typeLabel}</h4>
        <p>
          {typeLabel}{' '}
          <strong
            className={sponsor ? 'ledger-money--sponsor' : 'ledger-money--paid'}
          >
            {formatMoney(
              item.contribution.amount_minor,
              item.contribution.currency,
              locale,
              decimalPlaces,
            )}
          </strong>
        </p>
      </div>
    </article>
  );
}

function MemberBalanceSummary({
  memberName,
  paidMinor,
  shareMinor,
  depositMinor,
  transferSentMinor,
  transferReceivedMinor,
  currency,
  locale,
  decimalPlaces,
}: {
  memberName: string;
  paidMinor: number;
  shareMinor: number;
  depositMinor: number;
  transferSentMinor: number;
  transferReceivedMinor: number;
  currency: string;
  locale: string;
  decimalPlaces: number;
}) {
  const { t } = useTranslation('common');
  const balanceMinor = calculateLedgerBalanceMinor({
    paidMinor,
    shareMinor,
    depositMinor,
    transferSentMinor,
    transferReceivedMinor,
  });
  const paidAndSentMinor = paidMinor + transferSentMinor;
  const shareAndReceivedMinor = shareMinor + transferReceivedMinor;
  const firstName = memberName.trim().split(/\s+/)[0] || memberName;
  const balanceLabel =
    balanceMinor > 0
      ? t('ledger.groupOwes', { name: firstName })
      : balanceMinor < 0
        ? t('ledger.owesGroup', { name: firstName })
        : t('ledger.isSettled', { name: firstName });

  return (
    <section className="ledger-member-summary">
      <div className="ledger-member-summary__balance">
        <span>{t('ledger.memberBalance')}</span>
        <strong>
          {balanceLabel}{' '}
          {formatMoney(Math.abs(balanceMinor), currency, locale, decimalPlaces)}
        </strong>
      </div>
      <dl>
        <div>
          <dt>{t('ledger.paidOut')}</dt>
          <dd className="ledger-money--paid">
            {formatMoney(paidAndSentMinor, currency, locale, decimalPlaces)}
          </dd>
        </div>
        <div>
          <dt>{t('ledger.fairShare')}</dt>
          <dd className="ledger-money--share">
            {formatMoney(
              shareAndReceivedMinor,
              currency,
              locale,
              decimalPlaces,
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function LedgerPanel({
  trip,
  locale,
  viewerRole,
  canEdit = true,
  repository,
}: LedgerPanelProps) {
  const { t } = useTranslation('common');
  const query = useLedgerExpenses(trip.id, repository);
  const recordTransfer = useRecordTripTransfer(repository);
  const deleteExpense = useDeleteLedgerExpense(repository);
  const deleteTransfer = useDeleteLedgerTransfer(repository);
  const [view, setView] = useState<string | null>(null);
  const [transferMode, setTransferMode] = useState<'direct' | 'treasurer'>(
    'treasurer',
  );
  const [pendingTransfer, setPendingTransfer] =
    useState<TransferSuggestion | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [viewPickerOpen, setViewPickerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<LedgerExpense | null>(
    null,
  );
  const [removingExpense, setRemovingExpense] = useState<LedgerExpense | null>(
    null,
  );
  const [editingTransfer, setEditingTransfer] = useState<LedgerTransfer | null>(
    null,
  );
  const [removingTransfer, setRemovingTransfer] =
    useState<LedgerTransfer | null>(null);
  const data = useMemo(() => {
    if (!query.data?.currentMemberId) return query.data;
    const currentMemberId = query.data.currentMemberId;
    const annotate = (member: LedgerMember): LedgerMember =>
      member.id === currentMemberId
        ? {
            ...member,
            display_name: `${member.display_name} (${t('labels.you')})`,
          }
        : member;

    return {
      ...query.data,
      members: query.data.members.map(annotate),
      expenses: query.data.expenses.map((expense) => ({
        ...expense,
        payer: expense.payer ? annotate(expense.payer) : null,
        shares: expense.shares.map((share) => ({
          ...share,
          member: annotate(share.member),
        })),
      })),
      contributions: query.data.contributions.map((contribution) => ({
        ...contribution,
        member: contribution.member ? annotate(contribution.member) : null,
      })),
      transfers: query.data.transfers.map((transfer) => ({
        ...transfer,
        fromMember: annotate(transfer.fromMember),
        toMember: annotate(transfer.toMember),
      })),
    };
  }, [query.data, t]);
  const groups = useMemo(() => {
    const items: Array<{ occurredAt: string; item: AllTimelineItem }> = [
      ...(data?.expenses ?? []).map((expense) => ({
        occurredAt: expense.expense.occurred_at,
        item: { kind: 'expense', value: expense } as const,
      })),
      ...(data?.transfers ?? []).map((transfer) => ({
        occurredAt: transfer.transfer.occurred_at,
        item: { kind: 'transfer', value: transfer } as const,
      })),
    ].sort(
      (left, right) =>
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
    );
    return items.reduce<Map<string, AllTimelineItem[]>>(
      (result, { occurredAt, item }) => {
        const key = ledgerDateKey(occurredAt, trip.timezone);
        result.set(key, [...(result.get(key) ?? []), item]);
        return result;
      },
      new Map(),
    );
  }, [data?.expenses, data?.transfers, trip.timezone]);
  const defaultView =
    viewerRole === 'member' &&
    data?.currentMemberId &&
    data.currentMemberId !== data.treasurerMemberId
      ? `member:${data.currentMemberId}`
      : 'all';
  const activeView = view ?? defaultView;
  const selectedMember = data?.members.find(
    ({ id }) => activeView === `member:${id}`,
  );
  const currentMember = data?.members.find(
    ({ id }) => id === data?.currentMemberId,
  );
  const otherMembers = (data?.members ?? []).filter(
    ({ id }) => id !== currentMember?.id,
  );

  function selectView(nextView: string) {
    setView(nextView);
    setViewPickerOpen(false);
  }

  function selectMemberView(memberId: string) {
    const content = document.querySelector('ion-content') as
      (Element & { scrollToTop?: (duration?: number) => Promise<void> }) | null;
    if (content?.scrollToTop) {
      void content.scrollToTop(0);
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    selectView(`member:${memberId}`);
  }
  const memberGroups = useMemo(() => {
    if (!selectedMember || !data) {
      return new Map<string, MemberTimelineItem[]>();
    }

    const items: Array<{ occurredAt: string; item: MemberTimelineItem }> = [
      ...data.expenses.flatMap((expense) =>
        expense.payer?.id === selectedMember.id ||
        expense.shares.some(({ member }) => member.id === selectedMember.id)
          ? [
              {
                occurredAt: expense.expense.occurred_at,
                item: { kind: 'expense', value: expense } as const,
              },
            ]
          : [],
      ),
      ...data.contributions.flatMap((contribution) =>
        contribution.member?.id === selectedMember.id
          ? [
              {
                occurredAt: contribution.contribution.occurred_at,
                item: { kind: 'contribution', value: contribution } as const,
              },
            ]
          : [],
      ),
      ...data.transfers.flatMap((transfer) =>
        transfer.fromMember.id === selectedMember.id ||
        transfer.toMember.id === selectedMember.id
          ? [
              {
                occurredAt: transfer.transfer.occurred_at,
                item: { kind: 'transfer', value: transfer } as const,
              },
            ]
          : [],
      ),
    ].sort(
      (left, right) =>
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
    );

    return items.reduce<Map<string, MemberTimelineItem[]>>(
      (result, { occurredAt, item }) => {
        const key = ledgerDateKey(occurredAt, trip.timezone);
        result.set(key, [...(result.get(key) ?? []), item]);
        return result;
      },
      new Map(),
    );
  }, [data, selectedMember, trip.timezone]);
  const memberTotals = useMemo(() => {
    if (!selectedMember || !data) return null;
    return calculateMemberSummary(data, selectedMember);
  }, [data, selectedMember]);
  const groupSummaries = useMemo(
    () =>
      data
        ? [...data.members]
            .sort((left, right) =>
              left.display_name.localeCompare(right.display_name, undefined, {
                sensitivity: 'base',
              }),
            )
            .map((member) => calculateMemberSummary(data, member))
        : [],
    [data],
  );
  const treasurer = data?.members.find(
    ({ id }) => id === data?.treasurerMemberId,
  );
  const directTransferSuggestions = useMemo(
    () => createDirectTransferSuggestions(groupSummaries),
    [groupSummaries],
  );

  if (query.isPending) {
    return (
      <section className="ledger-panel" aria-label={t('ledger.loading')}>
        <Skeleton height="7rem" />
        <Skeleton height="13rem" />
        <Skeleton height="13rem" />
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className="ledger-state">
        <Icon name="wallet" size="large" />
        <h2>{t('ledger.loadErrorTitle')}</h2>
        <p>{t('ledger.loadErrorDescription')}</p>
      </section>
    );
  }

  const dateLabels = {
    today: (date: string) => t('ledger.today', { date }),
    yesterday: (date: string) => t('ledger.yesterday', { date }),
  };

  return (
    <section className="ledger-panel">
      <button
        aria-haspopup="dialog"
        className="ledger-view-picker"
        type="button"
        onClick={() => setViewPickerOpen(true)}
      >
        <span className="ledger-view-avatar">
          {selectedMember ? (
            <Avatar
              name={selectedMember.display_name}
              src={selectedMember.avatar_url ?? undefined}
              initialCount={2}
            />
          ) : activeView === 'summary' ? (
            <Icon name="wallet" />
          ) : (
            <Icon name="others" />
          )}
        </span>
        <span className="ledger-view-copy">
          <small>{t('ledger.viewingAs')}</small>
          <strong>
            {selectedMember?.display_name ??
              (activeView === 'summary'
                ? t('ledger.groupSummary')
                : t('ledger.allExpenses'))}
          </strong>
        </span>
        <Icon name="forward" />
      </button>

      <Modal
        open={viewPickerOpen}
        title={t('ledger.chooseView')}
        onDismiss={() => setViewPickerOpen(false)}
      >
        <div className="ledger-view-options">
          <button
            aria-pressed={activeView === 'all'}
            className="ledger-view-option"
            type="button"
            onClick={() => selectView('all')}
          >
            <span className="ledger-view-option__avatar">
              <Icon name="others" />
            </span>
            <span>
              <strong>{t('ledger.allExpenses')}</strong>
              <small>{t('ledger.allExpensesDescription')}</small>
            </span>
            {activeView === 'all' && <Icon name="check" />}
          </button>
          <button
            aria-pressed={activeView === 'summary'}
            className="ledger-view-option"
            type="button"
            onClick={() => selectView('summary')}
          >
            <span className="ledger-view-option__avatar">
              <Icon name="wallet" />
            </span>
            <span>
              <strong>{t('ledger.groupSummary')}</strong>
              <small>{t('ledger.groupSummaryDescription')}</small>
            </span>
            {activeView === 'summary' && <Icon name="check" />}
          </button>

          {currentMember && (
            <section className="ledger-view-options__group">
              <h3>{t('ledger.thisMember')}</h3>
              <button
                aria-pressed={activeView === `member:${currentMember.id}`}
                className="ledger-view-option"
                type="button"
                onClick={() => selectView(`member:${currentMember.id}`)}
              >
                <Avatar
                  initialCount={2}
                  name={currentMember.display_name}
                  src={currentMember.avatar_url ?? undefined}
                />
                <span>
                  <strong>{currentMember.display_name}</strong>
                  <small>{t('ledger.memberViewDescription')}</small>
                </span>
                {activeView === `member:${currentMember.id}` && (
                  <Icon name="check" />
                )}
              </button>
            </section>
          )}

          {otherMembers.length > 0 && (
            <section className="ledger-view-options__group">
              <h3>{t('ledger.otherMembers')}</h3>
              {otherMembers.map((member) => (
                <button
                  key={member.id}
                  aria-pressed={activeView === `member:${member.id}`}
                  className="ledger-view-option"
                  type="button"
                  onClick={() => selectView(`member:${member.id}`)}
                >
                  <Avatar
                    initialCount={2}
                    name={member.display_name}
                    src={member.avatar_url ?? undefined}
                  />
                  <span>
                    <strong>{member.display_name}</strong>
                    <small>{t('ledger.memberViewDescription')}</small>
                  </span>
                  {activeView === `member:${member.id}` && (
                    <Icon name="check" />
                  )}
                </button>
              ))}
            </section>
          )}
        </div>
      </Modal>

      {canEdit && activeView === 'all' && (
        <p className="ledger-tip">
          {t('ledger.tipDetails')}
          <br />
          {t('ledger.tipActions')}
        </p>
      )}

      {activeView === 'summary' && (
        <>
          <Segment
            label={t('ledger.transferMode')}
            value={transferMode}
            options={[
              { value: 'treasurer', label: t('ledger.viaTreasurer') },
              { value: 'direct', label: t('ledger.directTransfers') },
            ]}
            onValueChange={(value) =>
              setTransferMode(value as 'direct' | 'treasurer')
            }
          />
          {transferMode === 'treasurer' && (
            <p className="ledger-treasurer-note">
              {treasurer
                ? t('ledger.treasurerName', {
                    name: treasurer.display_name,
                  })
                : t('ledger.noTreasurer')}
            </p>
          )}
          <p className="ledger-tip">
            {transferMode === 'treasurer' && (
              <>
                {t('ledger.groupSummaryTip')}
                <br />
              </>
            )}
            {canEdit && t('ledger.groupSummaryTransferTip')}
          </p>
        </>
      )}

      {selectedMember && memberTotals && (
        <MemberBalanceSummary
          memberName={selectedMember.display_name}
          paidMinor={memberTotals.paidMinor}
          shareMinor={memberTotals.shareMinor}
          depositMinor={memberTotals.depositMinor}
          transferSentMinor={memberTotals.transferSentMinor}
          transferReceivedMinor={memberTotals.transferReceivedMinor}
          currency={trip.default_currency}
          locale={locale}
          decimalPlaces={trip.currency_decimal_places}
        />
      )}

      {activeView === 'summary' && transferMode === 'direct' ? (
        directTransferSuggestions.length === 0 ? (
          <div className="ledger-state">
            <Icon name="check" size="large" />
            <h2>{t('ledger.noTransfersTitle')}</h2>
            <p>{t('ledger.noTransfersDescription')}</p>
          </div>
        ) : (
          <div className="ledger-group-summary">
            {directTransferSuggestions.map((suggestion) => (
              <TransferSuggestionCard
                key={`${suggestion.fromMember.id}:${suggestion.toMember.id}`}
                suggestion={suggestion}
                currency={trip.default_currency}
                locale={locale}
                decimalPlaces={trip.currency_decimal_places}
                transferring={recordTransfer.isPending}
                canTransfer={canEdit}
                onTransfer={setPendingTransfer}
              />
            ))}
          </div>
        )
      ) : activeView === 'summary' ? (
        groupSummaries.length === 0 ? (
          <div className="ledger-state">
            <Icon name="person" size="large" />
            <h2>{t('ledger.groupEmptyTitle')}</h2>
            <p>{t('ledger.groupEmptyDescription')}</p>
          </div>
        ) : (
          <div className="ledger-group-summary">
            {groupSummaries.map((summary) => (
              <GroupSummaryCard
                key={summary.member.id}
                summary={summary}
                currency={trip.default_currency}
                locale={locale}
                decimalPlaces={trip.currency_decimal_places}
                onSelect={() => selectMemberView(summary.member.id)}
                transferSuggestion={
                  treasurer
                    ? createTreasurerSuggestion(summary, treasurer)
                    : null
                }
                transferring={recordTransfer.isPending}
                canTransfer={canEdit}
                onTransfer={setPendingTransfer}
              />
            ))}
          </div>
        )
      ) : selectedMember ? (
        memberGroups.size === 0 ? (
          <div className="ledger-state">
            <Icon name="wallet" size="large" />
            <h2>{t('ledger.memberEmptyTitle')}</h2>
            <p>{t('ledger.memberEmptyDescription')}</p>
          </div>
        ) : (
          [...memberGroups.entries()].map(([dateKey, items]) => (
            <section className="ledger-date-group" key={dateKey}>
              <header>
                <h3>
                  {formatGroupDate(dateKey, locale, trip.timezone, dateLabels)}
                </h3>
              </header>
              {items.map((item) =>
                item.kind === 'expense' ? (
                  <MemberExpenseCard
                    key={`expense:${item.value.expense.id}`}
                    expense={item.value}
                    memberId={selectedMember.id}
                    locale={locale}
                    decimalPlaces={trip.currency_decimal_places}
                  />
                ) : item.kind === 'contribution' ? (
                  <MemberContributionCard
                    key={`contribution:${item.value.contribution.id}`}
                    item={item.value}
                    locale={locale}
                    decimalPlaces={trip.currency_decimal_places}
                  />
                ) : (
                  <MemberTransferCard
                    key={`transfer:${item.value.transfer.id}`}
                    item={item.value}
                    memberId={selectedMember.id}
                    locale={locale}
                    decimalPlaces={trip.currency_decimal_places}
                  />
                ),
              )}
            </section>
          ))
        )
      ) : groups.size === 0 && (data?.contributions.length ?? 0) === 0 ? (
        <div className="ledger-state">
          <Icon name="wallet" size="large" />
          <h2>{t('ledger.emptyTitle')}</h2>
          <p>{t('ledger.emptyDescription')}</p>
        </div>
      ) : (
        [...groups.entries()].map(([dateKey, items]) => (
          <section className="ledger-date-group" key={dateKey}>
            <header>
              <h3>
                {formatGroupDate(dateKey, locale, trip.timezone, dateLabels)}
              </h3>
              {items.some((item) => item.kind === 'expense') && (
                <span>
                  {t('ledger.total', {
                    amount: formatMoney(
                      items.reduce(
                        (sum, item) =>
                          sum +
                          (item.kind === 'expense'
                            ? item.value.expense.amount_minor
                            : 0),
                        0,
                      ),
                      trip.default_currency,
                      locale,
                      trip.currency_decimal_places,
                    ),
                  })}
                </span>
              )}
            </header>
            {items.map((item) =>
              item.kind === 'expense' ? (
                <ExpenseCard
                  key={`expense:${item.value.expense.id}`}
                  expense={item.value}
                  locale={locale}
                  decimalPlaces={trip.currency_decimal_places}
                  canEdit={canEdit}
                  onEdit={() => setEditingExpense(item.value)}
                  onRemove={() => setRemovingExpense(item.value)}
                />
              ) : (
                <TransferCard
                  key={`transfer:${item.value.transfer.id}`}
                  item={item.value}
                  locale={locale}
                  decimalPlaces={trip.currency_decimal_places}
                  canEdit={canEdit}
                  onEdit={() => setEditingTransfer(item.value)}
                  onRemove={() => setRemovingTransfer(item.value)}
                />
              ),
            )}
          </section>
        ))
      )}
      {canEdit && data && (
        <>
          {!addOpen &&
            !viewPickerOpen &&
            !editingExpense &&
            !editingTransfer &&
            !removingExpense &&
            !removingTransfer &&
            !pendingTransfer && (
              <FabButton
                label={t('ledger.addEntry')}
                icon="add"
                onClick={() => setAddOpen(true)}
              />
            )}
          <AddLedgerEntryModal
            open={addOpen || Boolean(editingExpense || editingTransfer)}
            trip={trip}
            data={data}
            repository={repository}
            editExpense={editingExpense}
            editTransfer={editingTransfer}
            onDismiss={() => {
              setAddOpen(false);
              setEditingExpense(null);
              setEditingTransfer(null);
            }}
          />
        </>
      )}
      <ConfirmDialog
        open={canEdit && Boolean(pendingTransfer)}
        title={t('ledger.confirmTransferTitle')}
        message={
          pendingTransfer
            ? t('ledger.confirmTransferMessage', {
                from: pendingTransfer.fromMember.display_name,
                to: pendingTransfer.toMember.display_name,
                amount: formatMoney(
                  pendingTransfer.amountMinor,
                  trip.default_currency,
                  locale,
                  trip.currency_decimal_places,
                ),
              })
            : ''
        }
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('ledger.transferred')}
        onCancel={() => setPendingTransfer(null)}
        onConfirm={() => {
          if (!pendingTransfer) return;
          recordTransfer.mutate(
            {
              tripId: trip.id,
              fromMemberId: pendingTransfer.fromMember.id,
              toMemberId: pendingTransfer.toMember.id,
              amountMinor: pendingTransfer.amountMinor,
              currency: trip.default_currency,
              occurredAt: new Date().toISOString(),
              note: t('ledger.balanceTransferNote'),
            },
            { onSuccess: () => setPendingTransfer(null) },
          );
        }}
      />
      <ConfirmDialog
        open={Boolean(removingExpense)}
        title={t('ledger.removeExpenseTitle')}
        message={
          removingExpense
            ? t('ledger.removeExpenseMessage', {
                title: removingExpense.expense.title,
              })
            : ''
        }
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('actions.remove')}
        onCancel={() => setRemovingExpense(null)}
        onConfirm={() => {
          if (!removingExpense) return;
          deleteExpense.mutate(
            { expenseId: removingExpense.expense.id, tripId: trip.id },
            { onSuccess: () => setRemovingExpense(null) },
          );
        }}
      />
      <ConfirmDialog
        open={Boolean(removingTransfer)}
        title={t('ledger.removeTransferTitle')}
        message={
          removingTransfer
            ? t('ledger.removeTransferMessage', {
                from: removingTransfer.fromMember.display_name,
                to: removingTransfer.toMember.display_name,
              })
            : ''
        }
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('actions.remove')}
        onCancel={() => setRemovingTransfer(null)}
        onConfirm={() => {
          if (!removingTransfer) return;
          deleteTransfer.mutate(
            { transferId: removingTransfer.transfer.id, tripId: trip.id },
            { onSuccess: () => setRemovingTransfer(null) },
          );
        }}
      />
    </section>
  );
}
