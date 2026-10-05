import { useMemo, useState } from 'react';

import { Avatar, Icon, Skeleton } from '../../../shared/ui';
import type { IconName } from '../../../shared/ui/Icon';
import type { Trip } from '../../trips/trip-repository';
import { useLedgerExpenses } from '../ledger-hooks';
import type { LedgerRepository } from '../ledger-repository';
import {
  formatMoney,
  ledgerDateKey,
  type LedgerExpense,
} from '../ledger-types';

import './ledger.css';

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
  return value && iconNames.has(value) ? value : 'wallet';
}

function formatGroupDate(dateKey: string, locale: string, timezone: string) {
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
  if (dateKey === today) return `Today, ${formatted}`;
  if (dateKey === yesterday) return `Yesterday, ${formatted}`;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function MemberStack({ expense }: { expense: LedgerExpense }) {
  const visible = expense.shares.slice(0, 3);
  return (
    <div
      className="ledger-member-stack"
      aria-label={`${expense.shares.length} members`}
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
}: {
  expense: LedgerExpense;
  locale: string;
}) {
  const equalAmount = expense.shares[0]?.amountMinor;
  const equalSplit =
    expense.expense.split_method === 'equal' &&
    equalAmount !== undefined &&
    expense.shares.every(({ amountMinor }) => amountMinor === equalAmount);
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
            ? 'Paid from group fund'
            : `Paid by ${expense.payer?.display_name ?? 'Unknown member'}`}
        </p>
        <div className="ledger-expense-meta">
          <MemberStack expense={expense} />
          <strong>
            {equalSplit && equalAmount !== undefined
              ? `${formatMoney(equalAmount, expense.expense.currency, locale)} / each`
              : `${expense.shares.length} people joined`}
          </strong>
        </div>
        {(expense.expense.itinerary_node_id || expense.attachmentCount > 0) && (
          <div className="ledger-expense-links">
            {expense.expense.itinerary_node_id && (
              <span>
                <Icon name="location" size="small" /> Itinerary
              </span>
            )}
            {expense.attachmentCount > 0 && (
              <span>
                <Icon name="attachment" size="small" />{' '}
                {expense.attachmentCount}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="ledger-expense-amount">
        <strong>
          {formatMoney(
            expense.expense.amount_minor,
            expense.expense.currency,
            locale,
          )}
        </strong>
        <span>
          {equalSplit
            ? `${expense.shares.length} split equally`
            : 'Custom split'}
        </span>
      </div>
    </article>
  );
}

export function LedgerPanel({ trip, locale, repository }: LedgerPanelProps) {
  const query = useLedgerExpenses(trip.id, repository);
  const [view, setView] = useState('all');
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

  if (query.isPending) {
    return (
      <section className="ledger-panel" aria-label="Loading ledger">
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
        <h2>We couldn’t load the ledger.</h2>
        <p>Please try again.</p>
      </section>
    );
  }

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
          <small>Viewing ledger as</small>
          <strong>{selectedMember?.display_name ?? 'All expense list'}</strong>
        </span>
        <select
          aria-label="Viewing ledger as"
          value={view}
          onChange={(event) => setView(event.target.value)}
        >
          <option value="all">All expense list</option>
          {(query.data?.members ?? []).map((member) => (
            <option key={member.id} value={`member:${member.id}`}>
              {member.display_name}
            </option>
          ))}
        </select>
        <Icon name="forward" />
      </label>

      <p className="ledger-tip">
        Tap an item to view details
        <br />
        Swipe left for actions
      </p>

      {groups.size === 0 ? (
        <div className="ledger-state">
          <Icon name="wallet" size="large" />
          <h2>No expenses yet</h2>
          <p>Trip expenses will appear here once they are added.</p>
        </div>
      ) : (
        [...groups.entries()].map(([dateKey, expenses]) => (
          <section className="ledger-date-group" key={dateKey}>
            <header>
              <h3>{formatGroupDate(dateKey, locale, trip.timezone)}</h3>
              <span>
                Total:{' '}
                {formatMoney(
                  expenses.reduce(
                    (sum, item) => sum + item.expense.amount_minor,
                    0,
                  ),
                  expenses[0].expense.currency,
                  locale,
                )}
              </span>
            </header>
            {expenses.map((expense) => (
              <ExpenseCard
                key={expense.expense.id}
                expense={expense}
                locale={locale}
              />
            ))}
          </section>
        ))
      )}
    </section>
  );
}
