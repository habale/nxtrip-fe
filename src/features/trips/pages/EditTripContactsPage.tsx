import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { routes } from '../../../app/routes';
import { AppError } from '../../../shared/api/app-error';
import { Button, Icon, Page, Skeleton, TextInput } from '../../../shared/ui';
import { useReplaceTripContacts, useTripContacts } from '../contact-hooks';
import type { ContactDraft } from '../contact-repository';
import { useTripDetail } from '../trip-hooks';

import './edit-trip-contacts.css';

const emptyContact = (): ContactDraft => ({ name: '', phone: '', email: '' });

export function EditTripContactsPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { tripId = '' } = useParams<{ tripId: string }>();
  const tripQuery = useTripDetail(tripId);
  const contactsQuery = useTripContacts(tripId);
  const saveContacts = useReplaceTripContacts();
  const [contacts, setContacts] = useState<ContactDraft[] | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const initialValues = (contactsQuery.data ?? []).map(
    ({ name, phone, email }) => ({
      name,
      phone: phone ?? '',
      email: email ?? '',
    }),
  );
  const values = contacts ?? initialValues;
  const hasErrors = values.some(
    (contact) =>
      !contact.name.trim() ||
      (Boolean(contact.email?.trim()) &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email!.trim())),
  );

  function update(index: number, field: keyof ContactDraft, value: string) {
    setContacts((current) =>
      (current ?? initialValues).map((contact, itemIndex) =>
        itemIndex === index ? { ...contact, [field]: value } : contact,
      ),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors) return;
    const saved = await saveContacts
      .mutateAsync({ tripId, contacts: values })
      .then(() => true)
      .catch(() => false);
    if (saved) navigate(routes.tripInfo(tripId), { replace: true });
  }

  const header = (
    <div className="edit-contacts-header">
      <Button
        ariaLabel={t('actions.back')}
        href={routes.tripInfo(tripId)}
        navigationDirection="back"
        variant="quiet"
      >
        <Icon name="back" size="large" />
      </Button>
      <div>
        <p>{tripQuery.data?.trip.name}</p>
        <h1>{t('tripContacts.editTitle')}</h1>
      </div>
    </div>
  );

  if (tripQuery.isPending || contactsQuery.isPending) {
    return (
      <Page padded={false} headerContent={header}>
        <main className="edit-contacts-page">
          <Skeleton height="14rem" />
        </main>
      </Page>
    );
  }

  if (!tripQuery.data || tripQuery.data.role !== 'owner') {
    return (
      <Navigate replace to={tripId ? routes.tripInfo(tripId) : routes.home} />
    );
  }

  return (
    <Page padded={false} headerContent={header}>
      <main className="edit-contacts-page">
        <form className="edit-contacts-form" onSubmit={handleSubmit}>
          <div className="edit-contacts-intro">
            <h2>{t('tripContacts.title')}</h2>
            <p>{t('tripContacts.editDescription')}</p>
          </div>

          {values.map((contact, index) => (
            <section className="edit-contact-card" key={index}>
              <div className="edit-contact-card__heading">
                <h3>{t('tripContacts.contactNumber', { count: index + 1 })}</h3>
                <Button
                  ariaLabel={t('tripContacts.remove', {
                    name: contact.name || index + 1,
                  })}
                  size="small"
                  variant="danger-text"
                  onClick={() =>
                    setContacts((current) =>
                      (current ?? initialValues).filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    )
                  }
                >
                  <Icon name="trash" />
                </Button>
              </div>
              <TextInput
                required
                errorText={
                  submitted && !contact.name.trim()
                    ? t('tripContacts.nameRequired')
                    : undefined
                }
                label={t('tripContacts.name')}
                maxlength={160}
                value={contact.name}
                onValueChange={(value) => update(index, 'name', value)}
              />
              <TextInput
                inputMode="tel"
                label={t('tripContacts.phone')}
                maxlength={50}
                value={contact.phone ?? ''}
                onValueChange={(value) => update(index, 'phone', value)}
              />
              <TextInput
                errorText={
                  submitted &&
                  contact.email?.trim() &&
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())
                    ? t('tripContacts.emailInvalid')
                    : undefined
                }
                inputMode="email"
                label={t('tripContacts.email')}
                maxlength={320}
                type="email"
                value={contact.email ?? ''}
                onValueChange={(value) => update(index, 'email', value)}
              />
            </section>
          ))}

          <Button
            block
            variant="secondary"
            onClick={() => setContacts([...values, emptyContact()])}
          >
            <Icon name="add" /> {t('tripContacts.add')}
          </Button>

          {saveContacts.error && (
            <p className="edit-contacts-error" role="alert">
              {t(
                saveContacts.error instanceof AppError
                  ? saveContacts.error.translationKey
                  : 'errors:generic',
              )}
            </p>
          )}

          <div className="edit-contacts-actions">
            <Button block href={routes.tripInfo(tripId)} variant="quiet">
              {t('actions.cancel')}
            </Button>
            <Button block loading={saveContacts.isPending} type="submit">
              {saveContacts.isPending
                ? t('tripInfo.saving')
                : t('actions.save')}
            </Button>
          </div>
        </form>
      </main>
    </Page>
  );
}
