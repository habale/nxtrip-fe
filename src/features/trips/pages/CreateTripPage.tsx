import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { routes } from '../../../app/routes';
import { AppError } from '../../../shared/api/app-error';
import {
  Button,
  DateRangePicker,
  Icon,
  Page,
  Select,
  Skeleton,
  TextArea,
  TextInput,
} from '../../../shared/ui';
import {
  type CreateTripFormValues,
  validateCreateTripForm,
} from '../create-trip-form';
import { tripInstantToLocalDate } from '../trip-date';
import {
  useCreateTrip,
  useTripDetail,
  useUpdateTripMetadata,
} from '../trip-hooks';
import { getCurrencyOptions, getTimezoneOptions } from '../trip-options';
import type { Trip } from '../trip-repository';

import './create-trip.css';

function getInitialValues(): CreateTripFormValues {
  return {
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    defaultCurrency: 'VND',
    currencyDecimalPlaces: 0,
  };
}

function getValuesFromTrip(trip: Trip): CreateTripFormValues {
  return {
    name: trip.name,
    description: trip.description ?? '',
    startDate: tripInstantToLocalDate(trip.start_at, trip.timezone),
    endDate: tripInstantToLocalDate(trip.end_at, trip.timezone),
    timezone: trip.timezone,
    defaultCurrency: trip.default_currency,
    currencyDecimalPlaces: trip.currency_decimal_places,
  };
}

export function CreateTripPage() {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId: string }>();
  const editing = Boolean(tripId);
  const tripQuery = useTripDetail(tripId ?? '');
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTripMetadata();
  const [draftValues, setDraftValues] = useState<CreateTripFormValues | null>(
    () => (editing ? null : getInitialValues()),
  );
  const [submitted, setSubmitted] = useState(false);
  const trip = tripQuery.data?.trip;
  const initialValues = trip ? getValuesFromTrip(trip) : getInitialValues();
  const values = draftValues ?? initialValues;
  const errors = submitted ? validateCreateTripForm(values) : {};
  const mutation = editing ? updateTrip : createTrip;
  const cancelPath = editing && tripId ? routes.tripInfo(tripId) : routes.home;
  const pageHeader = (
    <div className="create-trip-header">
      <Button
        ariaLabel={t('actions.back')}
        href={cancelPath}
        navigationDirection="back"
        variant="quiet"
      >
        <Icon name="back" size="large" />
      </Button>
      <div>
        <p>{t(editing ? 'createTrip.editEyebrow' : 'createTrip.eyebrow')}</p>
        <h1>{t(editing ? 'createTrip.editTitle' : 'createTrip.title')}</h1>
      </div>
    </div>
  );

  function update<Field extends keyof CreateTripFormValues>(
    field: Field,
    value: CreateTripFormValues[Field],
  ) {
    setDraftValues((current) => ({
      ...(current ?? initialValues),
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateCreateTripForm(values)).length > 0) return;

    if (editing && trip) {
      const updated = await updateTrip
        .mutateAsync({ ...values, tripId: trip.id, version: trip.version })
        .catch(() => undefined);
      if (updated) navigate(routes.tripInfo(updated.id), { replace: true });
      return;
    }

    const createdTripId = await createTrip
      .mutateAsync(values)
      .catch(() => undefined);
    if (createdTripId) {
      navigate(routes.tripInfo(createdTripId), { replace: true });
    }
  }

  const errorText = (field: keyof CreateTripFormValues) => {
    const code = errors[field];
    return code ? t(`createTrip.validation.${code}`) : undefined;
  };

  if (editing && tripQuery.isPending) {
    return (
      <Page
        padded={false}
        headerClassName="create-trip-ion-header"
        toolbarClassName="create-trip-toolbar"
        headerContent={pageHeader}
      >
        <main className="create-trip-page">
          <div className="create-trip-form">
            <Skeleton height="5rem" />
            <Skeleton height="16rem" />
            <Skeleton height="16rem" />
          </div>
        </main>
      </Page>
    );
  }

  if (editing && (!tripQuery.data || tripQuery.data.role !== 'owner')) {
    return (
      <Navigate replace to={tripId ? routes.tripInfo(tripId) : routes.home} />
    );
  }

  return (
    <Page
      padded={false}
      headerClassName="create-trip-ion-header"
      toolbarClassName="create-trip-toolbar"
      headerContent={pageHeader}
    >
      <main className="create-trip-page">
        <form className="create-trip-form" onSubmit={handleSubmit}>
          <section className="create-trip-card">
            <TextInput
              required
              errorText={errorText('name')}
              label={t('createTrip.name')}
              maxlength={160}
              placeholder={t('createTrip.namePlaceholder')}
              value={values.name}
              onValueChange={(value) => update('name', value)}
            />
            <TextArea
              label={t('createTrip.description')}
              placeholder={t('createTrip.descriptionPlaceholder')}
              rows={3}
              value={values.description}
              onValueChange={(value) => update('description', value)}
            />
          </section>

          <section className="create-trip-card">
            <div className="create-trip-section-heading">
              <h2>{t('createTrip.datesTitle')}</h2>
              <p>{t('createTrip.datesDescription')}</p>
            </div>
            <DateRangePicker
              endDate={values.endDate}
              errorText={errorText('endDate')}
              label={t('createTrip.datesTitle')}
              startDate={values.startDate}
              onValueChange={({ startDate, endDate }) =>
                setDraftValues((current) => ({
                  ...(current ?? initialValues),
                  startDate,
                  endDate,
                }))
              }
            />
          </section>

          <section className="create-trip-card create-trip-settings">
            <Select
              required
              errorText={errorText('timezone')}
              helperText={t('createTrip.timezoneHelp')}
              label={t('createTrip.timezone')}
              options={getTimezoneOptions(values.timezone)}
              value={values.timezone}
              onValueChange={(value) => update('timezone', String(value))}
            />
            <Select
              required
              disabled={editing}
              errorText={errorText('defaultCurrency')}
              helperText={editing ? t('createTrip.currencyLocked') : undefined}
              label={t('createTrip.defaultCurrency')}
              options={getCurrencyOptions(
                values.defaultCurrency,
                i18n.resolvedLanguage ?? i18n.language,
              )}
              value={values.defaultCurrency}
              onValueChange={(value) =>
                update('defaultCurrency', String(value).toUpperCase())
              }
            />
            <TextInput
              required
              disabled={editing}
              errorText={errorText('currencyDecimalPlaces')}
              helperText={
                editing
                  ? t('createTrip.currencyDecimalPlacesLocked')
                  : t('createTrip.currencyDecimalPlacesHelp')
              }
              inputMode="numeric"
              label={t('createTrip.currencyDecimalPlaces')}
              type="number"
              value={String(values.currencyDecimalPlaces)}
              onValueChange={(value) =>
                update('currencyDecimalPlaces', Number(value))
              }
            />
          </section>

          {mutation.error && (
            <p className="create-trip-submit-error" role="alert">
              {t(
                mutation.error instanceof AppError
                  ? mutation.error.translationKey
                  : 'errors:generic',
              )}
            </p>
          )}

          <div className="create-trip-actions">
            <Button block href={cancelPath} variant="quiet">
              {t('actions.cancel')}
            </Button>
            <Button block loading={mutation.isPending} type="submit">
              {mutation.isPending
                ? t(editing ? 'tripInfo.saving' : 'createTrip.creating')
                : t(editing ? 'actions.save' : 'createTrip.submit')}
            </Button>
          </div>
        </form>
      </main>
    </Page>
  );
}
