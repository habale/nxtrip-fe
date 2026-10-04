import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppError } from '../../../shared/api/app-error';
import {
  Badge,
  Button,
  DatePicker,
  Icon,
  TextArea,
  TextInput,
} from '../../../shared/ui';
import {
  type CreateTripFormValues,
  validateCreateTripForm,
} from '../create-trip-form';
import {
  formatTripDateRange,
  getTripDuration,
  tripInstantToLocalDate,
} from '../trip-date';
import { useUpdateTripMetadata } from '../trip-hooks';
import type { TripDetail, TripRepository } from '../trip-repository';

type TripInfoPanelProps = {
  detail: TripDetail;
  locale: string;
  repository?: TripRepository;
};

function valuesFromDetail({ trip }: TripDetail): CreateTripFormValues {
  return {
    name: trip.name,
    description: trip.description ?? '',
    startDate: tripInstantToLocalDate(trip.start_at, trip.timezone),
    endDate: tripInstantToLocalDate(trip.end_at, trip.timezone),
    timezone: trip.timezone,
    defaultCurrency: trip.default_currency,
  };
}

export function TripInfoPanel({
  detail,
  locale,
  repository,
}: TripInfoPanelProps) {
  const { t } = useTranslation('common');
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState(() => valuesFromDetail(detail));
  const updateTrip = useUpdateTripMetadata(repository);
  const { trip, role } = detail;
  const errors = submitted ? validateCreateTripForm(values) : {};
  const dateRange = formatTripDateRange(
    trip.start_at,
    trip.end_at,
    locale,
    trip.timezone,
  );
  const duration = getTripDuration(trip.start_at, trip.end_at, trip.timezone);

  function update<Field extends keyof CreateTripFormValues>(
    field: Field,
    value: CreateTripFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    setSubmitted(true);
    if (Object.keys(validateCreateTripForm(values)).length > 0) return;

    const updated = await updateTrip
      .mutateAsync({
        ...values,
        tripId: trip.id,
        version: trip.version,
      })
      .catch(() => undefined);

    if (updated) {
      setValues(valuesFromDetail({ ...detail, trip: updated }));
      setEditing(false);
      setSubmitted(false);
    }
  }

  const errorText = (field: keyof CreateTripFormValues) => {
    const code = errors[field];
    return code ? t(`createTrip.validation.${code}`) : undefined;
  };

  if (editing) {
    return (
      <section
        className="trip-info-editor"
        aria-label={t('tripInfo.editTitle')}
      >
        <div className="trip-info-editor__heading">
          <div>
            <p>{t('tripInfo.ownerOnly')}</p>
            <h2>{t('tripInfo.editTitle')}</h2>
          </div>
          <span>{t('tripInfo.version', { version: trip.version })}</span>
        </div>

        <TextInput
          required
          errorText={errorText('name')}
          label={t('createTrip.name')}
          maxlength={160}
          value={values.name}
          onValueChange={(value) => update('name', value)}
        />
        <TextArea
          label={t('createTrip.description')}
          rows={3}
          value={values.description}
          onValueChange={(value) => update('description', value)}
        />

        <div className="trip-info-editor__dates">
          <label>
            <span>{t('createTrip.startDate')}</span>
            <DatePicker
              label={t('createTrip.startDate')}
              value={values.startDate || undefined}
              onValueChange={(value) => update('startDate', value.slice(0, 10))}
            />
          </label>
          <label>
            <span>{t('createTrip.endDate')}</span>
            <DatePicker
              label={t('createTrip.endDate')}
              min={values.startDate || undefined}
              value={values.endDate || undefined}
              onValueChange={(value) => update('endDate', value.slice(0, 10))}
            />
            {errorText('endDate') && <small>{errorText('endDate')}</small>}
          </label>
        </div>

        <div className="trip-info-editor__settings">
          <TextInput
            required
            errorText={errorText('timezone')}
            label={t('createTrip.timezone')}
            value={values.timezone}
            onValueChange={(value) => update('timezone', value)}
          />
          <TextInput
            required
            errorText={errorText('defaultCurrency')}
            label={t('createTrip.defaultCurrency')}
            maxlength={3}
            value={values.defaultCurrency}
            onValueChange={(value) =>
              update('defaultCurrency', value.toUpperCase())
            }
          />
        </div>

        {updateTrip.error && (
          <p className="trip-info-error" role="alert">
            {t(
              updateTrip.error instanceof AppError
                ? updateTrip.error.translationKey
                : 'errors:generic',
            )}
          </p>
        )}

        <div className="trip-info-editor__actions">
          <Button
            disabled={updateTrip.isPending}
            variant="quiet"
            onClick={() => {
              setValues(valuesFromDetail(detail));
              setEditing(false);
              setSubmitted(false);
              updateTrip.reset();
            }}
          >
            {t('actions.cancel')}
          </Button>
          <Button loading={updateTrip.isPending} onClick={() => void save()}>
            {updateTrip.isPending ? t('tripInfo.saving') : t('actions.save')}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="trip-info-view">
      <div className="trip-info-view__topline">
        <Badge tone={trip.status === 'ongoing' ? 'info' : 'brand'}>
          {t(`home.status.${trip.status}`)}
        </Badge>
        {role === 'owner' && (
          <div
            className="trip-info-edit-action"
            onClick={() => setEditing(true)}
          >
            {t('tripInfo.edit')}
          </div>
        )}
      </div>
      <h2>{trip.name}</h2>
      {dateRange && (
        <p className="trip-detail-date">
          <Icon name="calendar" />
          <span>{dateRange}</span>
          {duration && (
            <span className="trip-info-duration">
              <span aria-hidden="true">•</span>{' '}
              {t('tripInfo.dayCount', { count: duration.days })}{' '}
              {t('tripInfo.nightCount', { count: duration.nights })}
            </span>
          )}
        </p>
      )}
      {trip.description && (
        <p className="trip-info-description">{trip.description}</p>
      )}
      <dl className="trip-info-metadata">
        <div>
          <dt>{t('tripInfo.timezone')}</dt>
          <dd>{trip.timezone}</dd>
        </div>
        <div>
          <dt>{t('tripInfo.defaultCurrency')}</dt>
          <dd>{trip.default_currency}</dd>
        </div>
      </dl>
    </section>
  );
}
