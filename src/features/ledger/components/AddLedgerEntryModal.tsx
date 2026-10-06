import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppError } from '../../../shared/api/app-error';
import {
  Avatar,
  Button,
  Checkbox,
  Icon,
  Modal,
  Segment,
  Select,
  TextInput,
} from '../../../shared/ui';
import type { Trip } from '../../trips/trip-repository';
import type { IconName } from '../../../shared/ui/Icon';
import { useSaveLedgerEntry } from '../ledger-hooks';
import type { LedgerRepository } from '../ledger-repository';
import type {
  LedgerData,
  LedgerEntryType,
  LedgerSplitMode,
} from '../ledger-types';

type Props = {
  open: boolean;
  trip: Trip;
  data: LedgerData;
  repository?: LedgerRepository;
  onDismiss: () => void;
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
}: Props) {
  const { t } = useTranslation('common');
  const { t: tError } = useTranslation('errors');
  const mutation = useSaveLedgerEntry(repository);
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
  const [total, setTotal] = useState('');
  const [splitMode, setSplitMode] = useState<LedgerSplitMode>('equal');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<
    'total-to-split' | 'split-to-total'
  >('total-to-split');

  useEffect(() => {
    if (!open) return;
    setPayerId((current) => current || data.members[0]?.id || '');
    setSelectedIds((current) =>
      current.length ? current : data.members.map(({ id }) => id),
    );
  }, [data.members, open]);

  const activeMembers = sortedMembers.filter(({ id }) =>
    selectedIds.includes(id),
  );
  const enteredAmountsTotalMinor = activeMembers.reduce(
    (sum, member) => sum + Math.round((Number(values[member.id]) || 0) * 100),
    0,
  );
  const derivesTotal = type === 'expense' && direction === 'split-to-total';
  const totalMinor = derivesTotal
    ? enteredAmountsTotalMinor
    : Math.round((Number(total) || 0) * 100);
  const displayedTotal = derivesTotal
    ? (enteredAmountsTotalMinor / 100).toFixed(2)
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
            : Math.round(entered * 100);
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
  }, [activeMembers, splitMode, totalMinor, values]);
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
    title.trim() &&
    payerId &&
    totalMinor > 0 &&
    (type !== 'expense' || (activeMembers.length > 0 && allocationValid));

  const resetForm = () => {
    mutation.reset();
    setType('expense');
    setDate(todayInputValue());
    setTitle('');
    setCategory('misc');
    setPayerId('');
    setTotal('');
    setSplitMode('equal');
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
    await mutation.mutateAsync({
      tripId: trip.id,
      type,
      title,
      category,
      occurredAt: new Date(`${date}T12:00:00`).toISOString(),
      amountMinor: totalMinor,
      currency: trip.default_currency,
      paidByMemberId: payerId,
      splitMode,
      shares: computedShares,
    });
    resetAndDismiss();
  };

  return (
    <Modal
      open={open}
      title={t('ledger.modal.title')}
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
            { value: 'deposit', label: t('ledger.modal.deposit') },
            { value: 'sponsor', label: t('ledger.modal.sponsor') },
          ]}
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
            onValueChange={setDate}
          />
          <TextInput
            label={t('ledger.modal.name')}
            value={title}
            required
            maxlength={200}
            placeholder={
              type === 'expense'
                ? t('ledger.modal.expensePlaceholder')
                : t('ledger.modal.entryPlaceholder', {
                    type: t(`ledger.modal.${type}`),
                  })
            }
            onValueChange={setTitle}
          />
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
            <span>2</span> {t('ledger.modal.whoPaid')}
          </legend>
          <Select
            label={t('ledger.modal.member')}
            value={payerId}
            options={sortedMembers.map((member) => ({
              value: member.id,
              label: member.display_name,
            }))}
            onValueChange={(value) => setPayerId(String(value))}
          />
        </fieldset>

        <fieldset>
          <legend>
            <span>3</span>{' '}
            {type === 'expense'
              ? t('ledger.modal.totalAndSplit')
              : t('ledger.modal.amount')}
          </legend>
          <TextInput
            label={t('ledger.modal.totalCurrency', {
              currency: trip.default_currency,
            })}
            type="number"
            inputMode="decimal"
            value={displayedTotal}
            required
            disabled={derivesTotal}
            onValueChange={setTotal}
          />

          {type === 'expense' && (
            <>
              <div className="ledger-split-control">
                <Button
                  type="button"
                  variant="quiet"
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
                      setTotal((enteredAmountsTotalMinor / 100).toFixed(2));
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
                  options={
                    direction === 'split-to-total'
                      ? [{ value: 'amount', label: t('ledger.modal.number') }]
                      : [
                          { value: 'equal', label: t('ledger.modal.equal') },
                          { value: 'percent', label: '%' },
                          { value: 'amount', label: t('ledger.modal.number') },
                        ]
                  }
                  onValueChange={(value) =>
                    setSplitMode(value as LedgerSplitMode)
                  }
                />
              </div>

              <div className="ledger-split-members">
                {sortedMembers.map((member) => {
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
                        initialCount={2}
                      />
                      <span className="ledger-split-member__name">
                        {member.display_name}
                      </span>
                      {splitMode === 'equal' ? (
                        <strong>
                          {((computed?.amountMinor ?? 0) / 100).toFixed(2)}
                        </strong>
                      ) : (
                        <TextInput
                          label={
                            splitMode === 'percent'
                              ? '%'
                              : trip.default_currency
                          }
                          type="number"
                          inputMode="decimal"
                          value={values[member.id] ?? ''}
                          disabled={!checked}
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

        {mutation.error && (
          <p className="ledger-form-error">
            {mutation.error instanceof AppError
              ? tError(`codes.${mutation.error.code}`, {
                  defaultValue: tError('generic'),
                })
              : tError('generic')}
          </p>
        )}
        <div className="ledger-form-actions">
          <Button type="button" variant="quiet" onClick={resetAndDismiss}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={!canSave || mutation.isPending}>
            {mutation.isPending
              ? t('ledger.modal.saving')
              : t('ledger.modal.add', { type: t(`ledger.modal.${type}`) })}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
