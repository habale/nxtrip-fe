import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { routes } from '../../../app/routes';
import { AppError } from '../../../shared/api/app-error';
import { Button, Icon, Page, TextInput } from '../../../shared/ui';
import { normalizeTripCode, validateTripCode } from '../join-trip-form';
import { useJoinTrip } from '../trip-hooks';

import './add-trip.css';

export function AddTripPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const joinTrip = useJoinTrip();
  const [code, setCode] = useState(() =>
    normalizeTripCode(searchParams.get('code') ?? ''),
  );
  const [submitted, setSubmitted] = useState(false);
  const validationError = submitted ? validateTripCode(code) : undefined;

  async function pasteCode() {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setCode(normalizeTripCode(clipboardText));
      setSubmitted(false);
      joinTrip.reset();
    } catch {
      // Browsers can deny clipboard access. The input remains available.
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (validateTripCode(code)) return;

    const tripId = await joinTrip
      .mutateAsync(normalizeTripCode(code))
      .catch(() => undefined);
    if (tripId) navigate(routes.tripInfo(tripId), { replace: true });
  }

  return (
    <Page
      padded={false}
      headerClassName="add-trip-ion-header"
      toolbarClassName="add-trip-toolbar"
      headerContent={
        <div className="add-trip-header">
          <Button
            ariaLabel={t('actions.back')}
            href={routes.home}
            navigationDirection="back"
            variant="quiet"
          >
            <Icon name="back" size="large" />
          </Button>
          <h1>{t('addTrip.title')}</h1>
        </div>
      }
    >
      <main className="add-trip-page">
        <div className="add-trip-content">
          <section className="add-trip-intro">
            <h2>{t('addTrip.heading')}</h2>
            <p>{t('addTrip.description')}</p>
          </section>

          <form className="add-trip-card add-trip-join" onSubmit={submit}>
            <div className="add-trip-card-heading">
              <h2>{t('addTrip.joinTitle')}</h2>
              <Button type="button" variant="quiet" onClick={pasteCode}>
                <span className="add-trip-button-label">
                  <Icon name="paste" />
                  {t('addTrip.pasteCode')}
                </span>
              </Button>
            </div>
            <p>{t('addTrip.joinDescription')}</p>
            <TextInput
              autocomplete="off"
              errorText={
                validationError
                  ? t(`addTrip.validation.${validationError}`)
                  : undefined
              }
              label={t('addTrip.codeLabel')}
              maxlength={128}
              placeholder={t('addTrip.codePlaceholder')}
              value={code}
              onValueChange={(value) => {
                setCode(value);
                joinTrip.reset();
              }}
            />
            {joinTrip.error && (
              <p className="add-trip-error" role="alert">
                {t(
                  joinTrip.error instanceof AppError
                    ? joinTrip.error.translationKey
                    : 'errors:generic',
                )}
              </p>
            )}
            <Button
              block
              variant="primary"
              loading={joinTrip.isPending}
              type="submit"
            >
              {joinTrip.isPending
                ? t('addTrip.joining')
                : t('addTrip.joinAction')}
            </Button>
          </form>

          <div className="add-trip-divider">
            <span>{t('addTrip.or')}</span>
          </div>

          <section className="add-trip-card add-trip-card--create">
            <h2>{t('addTrip.createTitle')}</h2>
            <p>{t('addTrip.createDescription')}</p>
            <Button
              block
              href={routes.newTrip}
              variant="secondary"
              navigationDirection="forward"
            >
              <span className="add-trip-button-label">
                {t('addTrip.createAction')}
                <Icon name="forward" />
              </span>
            </Button>
          </section>
        </div>
      </main>
    </Page>
  );
}
