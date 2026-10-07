import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppError } from '../../../shared/api/app-error';
import {
  Avatar,
  Button,
  Checkbox,
  Icon,
  Modal,
  SearchField,
  Segment,
  Select,
  TextInput,
} from '../../../shared/ui';
import type { Trip } from '../../trips/trip-repository';
import type { IconName } from '../../../shared/ui/Icon';
import { useRecordTripTransfer, useSaveLedgerEntry } from '../ledger-hooks';
import type { LedgerRepository } from '../ledger-repository';
import type {
  LedgerData,
  LedgerEntryType,
  LedgerSplitMode,
} from '../ledger-types';
import {
  formatAmountInput,
  getCurrencySymbol,
  toStoredAmount,
} from '../ledger-types';

type Props = {
  open: boolean;
  trip: Trip;
  data: LedgerData;
  repository?: LedgerRepository;
  onDismiss: () => void;
  editExpense?: LedgerData['expenses'][number] | null;
  editTransfer?: LedgerData['transfers'][number] | null;
};

const categories = [
  { value: 'misc', icon: 'misc' },
  { value: 'moving', icon: 'train' },
  { value: 'dining', icon: 'restaurant' },
  { value: 'cafe', icon: 'cafe' },
  { value: 'lodging', icon: 'hotel' },
  { value: 'shopping', icon: 'shopping' },
  { value: 'sightseeing', icon: 'sightseeing' },
  { value: 'activity', icon: 'activity' },
] satisfies Array<{ value: string; icon: IconName }>;

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function distribute(total: number, count: number) {
  if (!count) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

export function AddLedgerEntryModal({
  open,
  trip,
  data,
  repository,
  onDismiss,
  editExpense = null,
  editTransfer = null,
}: Props) {
  const { t, i18n } = useTranslation('common');
  const { t: tError } = useTranslation('errors');
  const entryMutation = useSaveLedgerEntry(repository);
  const transferMutation = useRecordTripTransfer(repository);
  const sortedMembers = useMemo(
    () =>
      [...data.members].sort((left, right) =>
        left.display_name.localeCompare(right.display_name, undefined, {
          sensitivity: 'base',
        }),
      ),
    [data.members],
  );
  const [type, setType] = useState<LedgerEntryType>('expense');
  const [date, setDate] = useState(todayInputValue);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('misc');
  const [payerId, setPayerId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [total, setTotal] = useState('');
  const [splitMode, setSplitMode] = useState<LedgerSplitMode>('equal');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<
    'total-to-split' | 'split-to-total'
  >('total-to-split');
  const decimalPlaces = trip.currency_decimal_places;
  const currencySymbol = getCurrencySymbol(
    trip.default_currency,
    i18n.resolvedLanguage ?? i18n.language,
  );

  useEffect(() => {
    if (!open) return;
    const defaultPayerId = data.currentMemberId ?? data.members[0]?.id ?? '';
    /* eslint-disable react-hooks/set-state-in-effect -- initialize the reusable modal whenever it opens with freshly loaded trip members. */
    if (editTransfer) {
      setType('transfer');
      setDate(editTransfer.transfer.occurred_at.slice(0, 10));
      setPayerId(editTransfer.fromMember.id);
      setReceiverId(editTransfer.toMember.id);
      setTotal(
        formatAmountInput(editTransfer.transfer.amount_minor, decimalPlaces),
      );
    } else if (editExpense) {
      const expense = editExpense.expense;
      const categoryMatch = expense.note?.match(/^Category: ([a-z]+)$/i)?.[1];
      setType('expense');
      setDate(expense.occurred_at.slice(0, 10));
      setTitle(expense.title);
      setCategory(categoryMatch ?? 'misc');
      setPayerId(expense.paid_by_member_id ?? defaultPayerId);
      setTotal(formatAmountInput(expense.amount_minor, decimalPlaces));
      setSplitMode(expense.split_method === 'equal' ? 'equal' : 'amount');
      setSelectedIds(editExpense.shares.map(({ member }) => member.id));
      setValues(
        Object.fromEntries(
          editExpense.shares.map(({ member, amountMinor }) => [
            member.id,
            formatAmountInput(amountMinor, decimalPlaces),
          ]),
        ),
      );
      setDirection('total-to-split');
    } else {
      setPayerId((current) => current || defaultPayerId);
    }
    if (!editTransfer) {
      setReceiverId((current) => {
        if (current && current !== defaultPayerId) return current;
        return data.treasurerMemberId !== defaultPayerId
          ? (data.treasurerMemberId ?? '')
          : '';
      });
    }
    if (!editExpense && !editTransfer) {
      setSelectedIds((current) =>
        current.length ? current : data.members.map(({ id }) => id),
      );
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    data.currentMemberId,
    data.members,
    data.treasurerMemberId,
    decimalPlaces,
    editExpense,
    editTransfer,
    open,
  ]);

  const activeMembers = sortedMembers.filter(({ id }) =>
    selectedIds.includes(id),
  );
  const normalizedMemberSearch = memberSearch.trim().toLocaleLowerCase();
  const visibleMembers = sortedMembers.filter(
    ({ display_name }) =>
      !normalizedMemberSearch ||
      display_name.toLocaleLowerCase().includes(normalizedMemberSearch),
  );
  const allVisibleMembersSelected =
    visibleMembers.length > 0 &&
    visibleMembers.every(({ id }) => selectedIds.includes(id));
  const enteredAmountsTotalMinor = activeMembers.reduce(
    (sum, member) =>
      sum + toStoredAmount(Number(values[member.id]) || 0, decimalPlaces),
    0,
  );
  const derivesTotal = type === 'expense' && direction === 'split-to-total';
  const totalMinor = derivesTotal
    ? enteredAmountsTotalMinor
    : toStoredAmount(Number(total) || 0, decimalPlaces);
  const displayedTotal = derivesTotal
    ? formatAmountInput(enteredAmountsTotalMinor, decimalPlaces)
    : total;
  const computedShares = useMemo(() => {
    const equalAmounts = distribute(totalMinor, activeMembers.length);
    const shares = activeMembers.map((member, index) => {
      const entered = Number(values[member.id]) || 0;
      const amountMinor =
        splitMode === 'equal'
          ? equalAmounts[index]
          : splitMode === 'percent'
            ? Math.round((totalMinor * entered) / 100)
            : toStoredAmount(entered, decimalPlaces);
      return { memberId: member.id, amountMinor };
    });
    if (splitMode === 'percent' && shares.length) {
      const roundedTotal = shares.reduce(
        (sum, share) => sum + share.amountMinor,
        0,
      );
      shares[shares.length - 1].amountMinor += totalMinor - roundedTotal;
    }
    return shares;
  }, [activeMembers, decimalPlaces, splitMode, totalMinor, values]);
  const allocatedMinor = computedShares.reduce(
    (sum, share) => sum + share.amountMinor,
    0,
  );
  const percentTotal = activeMembers.reduce(
    (sum, member) => sum + (Number(values[member.id]) || 0),
    0,
  );
  const allocationValid =
    splitMode === 'equal' ||
    (splitMode === 'percent' && Math.abs(percentTotal - 100) < 0.001) ||
    (splitMode === 'amount' && allocatedMinor === totalMinor);
  const canSave =
    payerId &&
    totalMinor > 0 &&
    (type === 'transfer'
      ? receiverId && receiverId !== payerId
      : title.trim() &&
        (type !== 'expense' || (activeMembers.length > 0 && allocationValid)));
  const isPending = entryMutation.isPending || transferMutation.isPending;
  const mutationError = entryMutation.error ?? transferMutation.error;

  const resetForm = () => {
    entryMutation.reset();
    transferMutation.reset();
    setType('expense');
    setDate(todayInputValue());
    setTitle('');
    setCategory('misc');
    setPayerId('');
    setReceiverId('');
    setTotal('');
    setSplitMode('equal');
    setMemberSearch('');
    setSelectedIds([]);
    setValues({});
    setDirection('total-to-split');
  };
  const resetAndDismiss = () => {
    resetForm();
    onDismiss();
  };
  const save = async () => {
    if (!canSave) return;
    const occurredAt = new Date(`${date}T12:00:00`).toISOString();
    if (type === 'transfer') {
      await transferMutation.mutateAsync({
        tripId: trip.id,
        fromMemberId: payerId,
        toMemberId: receiverId,
        amountMinor: totalMinor,
        currency: trip.default_currency,
        occurredAt,
        transferId: editTransfer?.transfer.id,
      });
    } else {
      await entryMutation.mutateAsync({
        tripId: trip.id,
        type,
        title,
        category,
        occurredAt,
        amountMinor: totalMinor,
        currency: trip.default_currency,
        paidByMemberId: payerId,
        splitMode,
        shares: computedShares,
        expenseId: editExpense?.expense.id,
      });
    }
    resetAndDismiss();
  };

  return (
    <Modal
      open={open}
      title={t(
        editExpense
          ? 'ledger.modal.editTitle'
          : editTransfer
            ? 'ledger.modal.editTransferTitle'
            : 'ledger.modal.title',
      )}
      onDismiss={resetAndDismiss}
    >
      <form
        className="ledger-entry-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Segment
          label={t('ledger.modal.entryType')}
          value={type}
          options={[
            { value: 'expense', label: t('ledger.modal.expense') },
            { value: 'transfer', label: t('ledger.modal.transfer') },
          ]}
          disabled={isPending || Boolean(editExpense || editTransfer)}
          onValueChange={(value) => setType(value as LedgerEntryType)}
        />

        <fieldset>
          <legend>
            <span>1</span> {t('ledger.modal.details')}
          </legend>
          <TextInput
            label={t('ledger.modal.date')}
            type="date"
            value={date}
            required
            disabled={isPending}
            onValueChange={setDate}
          />
          {type !== 'transfer' && (
            <TextInput
              label={t('ledger.modal.name')}
              value={title}
              required
              disabled={isPending}
              maxlength={200}
              placeholder={t('ledger.modal.expensePlaceholder')}
              onValueChange={setTitle}
            />
          )}
          {type === 'expense' && (
            <div
              className="ledger-category-select"
              role="group"
              aria-label={t('ledger.modal.category')}
            >
              {categories.map((option) => (
                <div
                  className={`ledger-category-option ledger-category-option--${option.value}`}
                  key={option.value}
                >
                  <Button
                    type="button"
                    variant="filter"
                    selected={category === option.value}
                    disabled={isPending}
                    ariaLabel={t(`ledger.modal.categories.${option.value}`)}
                    onClick={() => setCategory(option.value)}
                  >
                    <Icon name={option.icon} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>
            <span>2</span>{' '}
            {type === 'transfer'
              ? t('ledger.modal.transferFrom')
              : t('ledger.modal.whoPaid')}
          </legend>
          <Select
            label={t('ledger.modal.member')}
            value={payerId}
            disabled={isPending}
            options={sortedMembers.map((member) => ({
              value: member.id,
              label: member.display_name,
            }))}
            onValueChange={(value) => {
              const nextPayerId = String(value);
              setPayerId(nextPayerId);
              if (receiverId === nextPayerId) setReceiverId('');
            }}
          />
        </fieldset>

        {type === 'transfer' && (
          <fieldset>
            <legend>
              <span>3</span> {t('ledger.modal.transferTo')}
            </legend>
            <Select
              label={t('ledger.modal.member')}
              value={receiverId}
              disabled={isPending}
              placeholder={t('ledger.modal.selectReceiver')}
              options={sortedMembers
                .filter(({ id }) => id !== payerId)
                .map((member) => ({
                  value: member.id,
                  label: member.display_name,
                }))}
              onValueChange={(value) => setReceiverId(String(value))}
            />
          </fieldset>
        )}

        <fieldset>
          <legend>
            <span>{type === 'transfer' ? 4 : 3}</span>{' '}
            {type === 'expense'
              ? t('ledger.modal.totalAndSplit')
              : t('ledger.modal.amount')}
          </legend>
          <TextInput
            label={t('ledger.modal.totalCurrency', {
              currency: currencySymbol,
            })}
            type="number"
            inputMode="decimal"
            value={displayedTotal}
            required
            disabled={derivesTotal || isPending}
            onValueChange={setTotal}
          />

          {type === 'expense' && (
            <>
              <div className="ledger-split-control">
                <Button
                  type="button"
                  variant="quiet"
                  disabled={isPending}
                  ariaLabel={
                    direction === 'total-to-split'
                      ? t('ledger.modal.calculateFromMembers')
                      : t('ledger.modal.splitBetweenMembers')
                  }
                  onClick={() => {
                    if (direction === 'total-to-split') {
                      setSplitMode('amount');
                      setDirection('split-to-total');
                    } else {
                      setTotal(
                        formatAmountInput(
                          enteredAmountsTotalMinor,
                          decimalPlaces,
                        ),
                      );
                      setDirection('total-to-split');
                    }
                  }}
                >
                  <Icon
                    name={
                      direction === 'total-to-split' ? 'forward' : 'previous'
                    }
                    size="large"
                  />
                </Button>
                <Segment
                  label={t('ledger.modal.splitMethod')}
                  value={splitMode}
                  disabled={isPending}
                  options={
                    direction === 'split-to-total'
                      ? [
                          {
                            value: 'amount',
                            label: t('ledger.modal.byAmount', {
                              currency: currencySymbol,
                            }),
                          },
                        ]
                      : [
                          { value: 'equal', label: t('ledger.modal.equal') },
                          {
                            value: 'percent',
                            label: t('ledger.modal.byPercent'),
                          },
                          {
                            value: 'amount',
                            label: t('ledger.modal.byAmount', {
                              currency: currencySymbol,
                            }),
                          },
                        ]
                  }
                  onValueChange={(value) =>
                    setSplitMode(value as LedgerSplitMode)
                  }
                />
              </div>

              <div className="ledger-split-members__toolbar">
                <Checkbox
                  ariaLabel={t(
                    allVisibleMembersSelected
                      ? 'ledger.modal.deselectAll'
                      : 'ledger.modal.selectAll',
                  )}
                  checked={allVisibleMembersSelected}
                  disabled={isPending || visibleMembers.length === 0}
                  onCheckedChange={() => {
                    const visibleIds = new Set(
                      visibleMembers.map(({ id }) => id),
                    );
                    setSelectedIds((current) =>
                      allVisibleMembersSelected
                        ? current.filter((id) => !visibleIds.has(id))
                        : [...new Set([...current, ...visibleIds])],
                    );
                  }}
                />
                <SearchField
                  label={t('ledger.modal.searchMembers')}
                  placeholder={t('ledger.modal.searchMembersPlaceholder')}
                  value={memberSearch}
                  disabled={isPending}
                  onValueChange={setMemberSearch}
                />
              </div>

              <div className="ledger-split-members">
                {visibleMembers.map((member) => {
                  const checked = selectedIds.includes(member.id);
                  const computed = computedShares.find(
                    ({ memberId }) => memberId === member.id,
                  );
                  return (
                    <div className="ledger-split-member" key={member.id}>
                      <Checkbox
                        ariaLabel={t('ledger.modal.includeMember', {
                          name: member.display_name,
                        })}
                        checked={checked}
                        disabled={isPending}
                        onCheckedChange={(next) =>
                          setSelectedIds((current) =>
                            next
                              ? [...current, member.id]
                              : current.filter((id) => id !== member.id),
                          )
                        }
                      />
                      <Avatar
                        name={member.display_name}
                        src={member.avatar_url ?? undefined}
                        size="small"
                        initialCount={2}
                      />
                      <span className="ledger-split-member__name">
                        {member.display_name}
                      </span>
                      {splitMode === 'equal' ? (
                        <strong>
                          {formatAmountInput(
                            computed?.amountMinor ?? 0,
                            decimalPlaces,
                          )}
                        </strong>
                      ) : (
                        <TextInput
                          label={splitMode === 'percent' ? '%' : currencySymbol}
                          type="number"
                          inputMode="decimal"
                          value={values[member.id] ?? ''}
                          disabled={!checked || isPending}
                          onValueChange={(value) =>
                            setValues((current) => ({
                              ...current,
                              [member.id]: value,
                            }))
                          }
                        />
                      )}
                    </div>
                  );
                })}
                {visibleMembers.length === 0 && (
                  <p className="ledger-split-members__empty">
                    {t('ledger.modal.noMemberResults')}
                  </p>
                )}
              </div>
              {!allocationValid && (
                <p className="ledger-form-error">
                  {splitMode === 'percent'
                    ? t('ledger.modal.percentValidation', {
                        total: percentTotal,
                      })
                    : t('ledger.modal.amountValidation')}
                </p>
              )}
            </>
          )}
        </fieldset>

        {mutationError && (
          <p className="ledger-form-error">
            {mutationError instanceof AppError
              ? tError(`codes.${mutationError.code}`, {
                  defaultValue: tError('generic'),
                })
              : tError('generic')}
          </p>
        )}
        <div className="ledger-form-actions">
          <Button
            type="button"
            variant="quiet"
            disabled={isPending}
            onClick={resetAndDismiss}
          >
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={!canSave || isPending}>
            {isPending
              ? t(
                  editExpense || editTransfer
                    ? 'ledger.modal.updating'
                    : 'ledger.modal.saving',
                )
              : editExpense || editTransfer
                ? t(
                    editExpense
                      ? 'ledger.modal.updateExpense'
                      : 'ledger.modal.updateTransfer',
                  )
                : t('ledger.modal.add', {
                    type: t(`ledger.modal.${type}`),
                  })}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
