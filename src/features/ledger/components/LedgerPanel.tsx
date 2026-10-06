import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  FabButton,
  Icon,
  Skeleton,
  SwipeStartActionItem,
} from '../../../shared/ui';
import type { IconName } from '../../../shared/ui/Icon';
import type { Trip } from '../../trips/trip-repository';
import { useLedgerExpenses, useMarkMemberSettled } from '../ledger-hooks';
import type { LedgerRepository } from '../ledger-repository';
import {
  formatMoney,
  ledgerDateKey,
  type LedgerData,
  type LedgerExpense,
} from '../ledger-types';

import './ledger.css';
import { AddLedgerEntryModal } from './AddLedgerEntryModal';

type LedgerPanelProps = {
  trip: Trip;
  locale: string;
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
}: {
  expense: LedgerExpense;
  locale: string;
  decimalPlaces: number;
}) {
  const { t } = useTranslation('common');
  const equalAmount = expense.shares[0]?.amountMinor;
  const equalSplit = expense.expense.split_method === 'equal';
  return (
    <article className="ledger-expense-card">
      <div
        className={`ledger-expense-icon ledger-expense-icon--${expenseIcon(expense)}`}
      >
        <Icon name={expenseIcon(expense)} size="large" />
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
        <Icon name={expenseIcon(expense)} size="large" />
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

type LedgerContribution = LedgerData['contributions'][number];
type LedgerMember = LedgerData['members'][number];
type MemberTimelineItem =
  | { kind: 'expense'; value: LedgerExpense }
  | { kind: 'contribution'; value: LedgerContribution };

type MemberFinancialSummary = {
  member: LedgerMember;
  paidMinor: number;
  shareMinor: number;
  depositMinor: number;
  sponsorMinor: number;
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

  return {
    member,
    paidMinor,
    shareMinor,
    depositMinor,
    sponsorMinor,
    balanceMinor: paidMinor + depositMinor - shareMinor,
  };
}

function GroupSummaryCard({
  summary,
  currency,
  locale,
  decimalPlaces,
  onSelect,
  pendingSettlementIds,
  settling,
  onSettle,
}: {
  summary: MemberFinancialSummary;
  currency: string;
  locale: string;
  decimalPlaces: number;
  onSelect: () => void;
  pendingSettlementIds: string[];
  settling: boolean;
  onSettle: (settlementIds: string[]) => void;
}) {
  const { t } = useTranslation('common');
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
      endActionLabel={t('ledger.markMemberSettled')}
      endIcon="check"
      endDisabled={pendingSettlementIds.length === 0 || settling}
      onEndAction={() => onSettle(pendingSettlementIds)}
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
            {t('ledger.paid')}{' '}
            {formatMoney(summary.paidMinor, currency, locale, decimalPlaces)}
          </span>
          <span>
            {t('ledger.share')}{' '}
            {formatMoney(summary.shareMinor, currency, locale, decimalPlaces)}
          </span>
          {summary.depositMinor > 0 && (
            <span>
              {t('ledger.deposit')}{' '}
              {formatMoney(
                summary.depositMinor,
                currency,
                locale,
                decimalPlaces,
              )}
            </span>
          )}
          {summary.sponsorMinor > 0 && (
            <span>
              {t('ledger.sponsor')}{' '}
              {formatMoney(
                summary.sponsorMinor,
                currency,
                locale,
                decimalPlaces,
              )}
            </span>
          )}
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
  sponsorMinor,
  depositMinor,
  currency,
  locale,
  decimalPlaces,
}: {
  memberName: string;
  paidMinor: number;
  shareMinor: number;
  sponsorMinor: number;
  depositMinor: number;
  currency: string;
  locale: string;
  decimalPlaces: number;
}) {
  const { t } = useTranslation('common');
  const balanceMinor = paidMinor + depositMinor - shareMinor;
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
            {formatMoney(paidMinor, currency, locale, decimalPlaces)}
          </dd>
        </div>
        <div>
          <dt>{t('ledger.fairShare')}</dt>
          <dd className="ledger-money--share">
            {formatMoney(shareMinor, currency, locale, decimalPlaces)}
          </dd>
        </div>
        <div>
          <dt>{t('ledger.deposit')}</dt>
          <dd className="ledger-money--deposit">
            {formatMoney(depositMinor, currency, locale, decimalPlaces)}
          </dd>
        </div>
        <div>
          <dt>{t('ledger.sponsor')}</dt>
          <dd className="ledger-money--sponsor">
            {formatMoney(sponsorMinor, currency, locale, decimalPlaces)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function LedgerPanel({ trip, locale, repository }: LedgerPanelProps) {
  const { t } = useTranslation('common');
  const query = useLedgerExpenses(trip.id, repository);
  const markMemberSettled = useMarkMemberSettled(trip.id, repository);
  const [view, setView] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const groups = useMemo(() => {
    const filtered = (query.data?.expenses ?? []).filter((item) =>
      view.startsWith('member:')
        ? item.shares.some(({ member }) => member.id === view.slice(7)) ||
          item.payer?.id === view.slice(7)
        : true,
    );
    return filtered.reduce<Map<string, LedgerExpense[]>>((result, expense) => {
      const key = ledgerDateKey(expense.expense.occurred_at, trip.timezone);
      result.set(key, [...(result.get(key) ?? []), expense]);
      return result;
    }, new Map());
  }, [query.data?.expenses, trip.timezone, view]);
  const selectedMember = query.data?.members.find(
    ({ id }) => view === `member:${id}`,
  );
  const memberGroups = useMemo(() => {
    if (!selectedMember || !query.data) {
      return new Map<string, MemberTimelineItem[]>();
    }

    const items: Array<{ occurredAt: string; item: MemberTimelineItem }> = [
      ...query.data.expenses.flatMap((expense) =>
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
      ...query.data.contributions.flatMap((contribution) =>
        contribution.member?.id === selectedMember.id
          ? [
              {
                occurredAt: contribution.contribution.occurred_at,
                item: { kind: 'contribution', value: contribution } as const,
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
  }, [query.data, selectedMember, trip.timezone]);
  const memberTotals = useMemo(() => {
    if (!selectedMember || !query.data) return null;
    return calculateMemberSummary(query.data, selectedMember);
  }, [query.data, selectedMember]);
  const groupSummaries = useMemo(
    () =>
      query.data
        ? [...query.data.members]
            .sort((left, right) =>
              left.display_name.localeCompare(right.display_name, undefined, {
                sensitivity: 'base',
              }),
            )
            .map((member) => calculateMemberSummary(query.data!, member))
        : [],
    [query.data],
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
      <label className="ledger-view-picker">
        <span className="ledger-view-avatar">
          {selectedMember ? (
            <Avatar
              name={selectedMember.display_name}
              src={selectedMember.avatar_url ?? undefined}
              initialCount={2}
            />
          ) : (
            'GS'
          )}
        </span>
        <span className="ledger-view-copy">
          <small>{t('ledger.viewingAs')}</small>
          <strong>
            {selectedMember?.display_name ??
              (view === 'summary'
                ? t('ledger.groupSummary')
                : t('ledger.allExpenses'))}
          </strong>
        </span>
        <select
          aria-label={t('ledger.viewingAs')}
          value={view}
          onChange={(event) => setView(event.target.value)}
        >
          <option value="all">{t('ledger.allExpenses')}</option>
          <option value="summary">{t('ledger.groupSummary')}</option>
          {(query.data?.members ?? []).map((member) => (
            <option key={member.id} value={`member:${member.id}`}>
              {member.display_name}
            </option>
          ))}
        </select>
        <Icon name="forward" />
      </label>

      {view === 'all' && (
        <p className="ledger-tip">
          {t('ledger.tipDetails')}
          <br />
          {t('ledger.tipActions')}
        </p>
      )}

      {view === 'summary' && (
        <p className="ledger-tip">
          {t('ledger.groupSummaryTip')}
          <br />
          {t('ledger.groupSummarySettleTip')}
        </p>
      )}

      {selectedMember && memberTotals && (
        <MemberBalanceSummary
          memberName={selectedMember.display_name}
          paidMinor={memberTotals.paidMinor}
          shareMinor={memberTotals.shareMinor}
          sponsorMinor={memberTotals.sponsorMinor}
          depositMinor={memberTotals.depositMinor}
          currency={trip.default_currency}
          locale={locale}
          decimalPlaces={trip.currency_decimal_places}
        />
      )}

      {view === 'all' && (query.data?.contributions.length ?? 0) > 0 && (
        <section className="ledger-date-group">
          <header>
            <h3>{t('ledger.fundActivity')}</h3>
          </header>
          {query.data?.contributions.map(
            ({ contribution, member, fundName, fundIsDefault }) => (
              <article className="ledger-expense-card" key={contribution.id}>
                <div
                  className={`ledger-expense-icon ledger-contribution-icon${contribution.contribution_type === 'sponsor' ? ' ledger-contribution-icon--sponsor' : ''}`}
                >
                  <Icon
                    name={
                      contribution.contribution_type === 'sponsor'
                        ? 'savings'
                        : 'wallet'
                    }
                    size="large"
                  />
                </div>
                <div className="ledger-expense-main">
                  <h4>
                    {contribution.note ||
                      t(
                        contribution.contribution_type === 'sponsor'
                          ? 'ledger.sponsor'
                          : 'ledger.deposit',
                      )}
                  </h4>
                  <p>
                    {member?.display_name ?? t('ledger.unknownMember')} ·{' '}
                    {fundIsDefault ? t('ledger.defaultFund') : fundName}
                  </p>
                </div>
                <div className="ledger-expense-amount">
                  <strong>
                    {formatMoney(
                      contribution.amount_minor,
                      contribution.currency,
                      locale,
                      trip.currency_decimal_places,
                    )}
                  </strong>
                  <span>
                    {t(
                      contribution.contribution_type === 'sponsor'
                        ? 'ledger.sponsor'
                        : 'ledger.deposit',
                    )}
                  </span>
                </div>
              </article>
            ),
          )}
        </section>
      )}

      {view === 'summary' ? (
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
                onSelect={() => setView(`member:${summary.member.id}`)}
                pendingSettlementIds={(query.data?.settlements ?? []).flatMap(
                  (settlement) =>
                    settlement.status === 'pending' &&
                    (settlement.from_member_id === summary.member.id ||
                      settlement.to_member_id === summary.member.id)
                      ? [settlement.id]
                      : [],
                )}
                settling={markMemberSettled.isPending}
                onSettle={(settlementIds) =>
                  markMemberSettled.mutate(settlementIds)
                }
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
                ) : (
                  <MemberContributionCard
                    key={`contribution:${item.value.contribution.id}`}
                    item={item.value}
                    locale={locale}
                    decimalPlaces={trip.currency_decimal_places}
                  />
                ),
              )}
            </section>
          ))
        )
      ) : groups.size === 0 && (query.data?.contributions.length ?? 0) === 0 ? (
        <div className="ledger-state">
          <Icon name="wallet" size="large" />
          <h2>{t('ledger.emptyTitle')}</h2>
          <p>{t('ledger.emptyDescription')}</p>
        </div>
      ) : (
        [...groups.entries()].map(([dateKey, expenses]) => (
          <section className="ledger-date-group" key={dateKey}>
            <header>
              <h3>
                {formatGroupDate(dateKey, locale, trip.timezone, dateLabels)}
              </h3>
              <span>
                {t('ledger.total', {
                  amount: formatMoney(
                    expenses.reduce(
                      (sum, item) => sum + item.expense.amount_minor,
                      0,
                    ),
                    expenses[0].expense.currency,
                    locale,
                    trip.currency_decimal_places,
                  ),
                })}
              </span>
            </header>
            {expenses.map((expense) => (
              <ExpenseCard
                key={expense.expense.id}
                expense={expense}
                locale={locale}
                decimalPlaces={trip.currency_decimal_places}
              />
            ))}
          </section>
        ))
      )}
      {query.data && (
        <>
          <FabButton
            label={t('ledger.addEntry')}
            icon="add"
            onClick={() => setAddOpen(true)}
          />
          <AddLedgerEntryModal
            open={addOpen}
            trip={trip}
            data={query.data}
            repository={repository}
            onDismiss={() => setAddOpen(false)}
          />
        </>
      )}
    </section>
  );
}
