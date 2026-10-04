import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { routes } from '../../../app/routes';
import { AppError } from '../../../shared/api/app-error';
import {
  Button,
  DatePicker,
  Icon,
  Page,
  TextArea,
  TextInput,
} from '../../../shared/ui';
import {
  type CreateTripFormValues,
  validateCreateTripForm,
} from '../create-trip-form';
import { useCreateTrip } from '../trip-hooks';

import './create-trip.css';

function getInitialValues(): CreateTripFormValues {
  return {
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    defaultCurrency: 'VND',
  };
}

export function CreateTripPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const createTrip = useCreateTrip();
  const [values, setValues] = useState(getInitialValues);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateCreateTripForm(values) : {};

  function update<Field extends keyof CreateTripFormValues>(
    field: Field,
    value: CreateTripFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateCreateTripForm(values)).length > 0) return;

    const tripId = await createTrip.mutateAsync(values).catch(() => undefined);
    if (tripId) navigate(routes.tripInfo(tripId), { replace: true });
  }

  const errorText = (field: keyof CreateTripFormValues) => {
    const code = errors[field];
    return code ? t(`createTrip.validation.${code}`) : undefined;
  };

  return (
    <Page hideHeader padded={false}>
      <main className="create-trip-page">
        <header className="create-trip-header">
          <Button
            ariaLabel={t('actions.back')}
            href={routes.home}
            navigationDirection="back"
            variant="quiet"
          >
            <Icon name="back" size="large" />
          </Button>
          <div>
            <p>{t('createTrip.eyebrow')}</p>
            <h1>{t('createTrip.title')}</h1>
          </div>
        </header>

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
            <div className="create-trip-dates">
              <div>
                <span>{t('createTrip.startDate')}</span>
                <DatePicker
                  label={t('createTrip.startDate')}
                  value={values.startDate || undefined}
                  onValueChange={(value) =>
                    update('startDate', value.slice(0, 10))
                  }
                />
              </div>
              <div>
                <span>{t('createTrip.endDate')}</span>
                <DatePicker
                  label={t('createTrip.endDate')}
                  min={values.startDate || undefined}
                  value={values.endDate || undefined}
                  onValueChange={(value) =>
                    update('endDate', value.slice(0, 10))
                  }
                />
                {errorText('endDate') && (
                  <p className="create-trip-field-error">
                    {errorText('endDate')}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="create-trip-card create-trip-settings">
            <TextInput
              required
              errorText={errorText('timezone')}
              helperText={t('createTrip.timezoneHelp')}
              label={t('createTrip.timezone')}
              placeholder="Asia/Ho_Chi_Minh"
              value={values.timezone}
              onValueChange={(value) => update('timezone', value)}
            />
            <TextInput
              required
              errorText={errorText('defaultCurrency')}
              label={t('createTrip.defaultCurrency')}
              maxlength={3}
              placeholder="VND"
              value={values.defaultCurrency}
              onValueChange={(value) =>
                update('defaultCurrency', value.toUpperCase())
              }
            />
          </section>

          {createTrip.error && (
            <p className="create-trip-submit-error" role="alert">
              {t(
                createTrip.error instanceof AppError
                  ? createTrip.error.translationKey
                  : 'errors:generic',
              )}
            </p>
          )}

          <div className="create-trip-actions">
            <Button block href={routes.home} variant="quiet">
              {t('actions.cancel')}
            </Button>
            <Button block loading={createTrip.isPending} type="submit">
              {createTrip.isPending
                ? t('createTrip.creating')
                : t('createTrip.submit')}
            </Button>
          </div>
        </form>
      </main>
    </Page>
  );
}
