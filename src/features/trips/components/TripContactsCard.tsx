import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import { Button, Icon, Skeleton } from '../../../shared/ui';
import { useTripContacts } from '../contact-hooks';
import type { ContactRepository } from '../contact-repository';

type TripContactsCardProps = {
  tripId: string;
  canEdit: boolean;
  repository?: ContactRepository;
};

export function TripContactsCard({
  tripId,
  canEdit,
  repository,
}: TripContactsCardProps) {
  const { t } = useTranslation('common');
  const contactsQuery = useTripContacts(tripId, repository);

  return (
    <section
      className="trip-contacts-card"
      aria-labelledby="trip-contacts-title"
    >
      <div className="trip-contacts-card__heading">
        <div>
          <h2 id="trip-contacts-title">{t('tripContacts.title')}</h2>
        </div>
        {canEdit && (
          <Button
            ariaLabel={t('tripContacts.edit')}
            href={routes.editTripContacts(tripId)}
            navigationDirection="forward"
            size="small"
            variant="quiet"
          >
            <Icon name="edit" />
          </Button>
        )}
      </div>

      {contactsQuery.isPending ? (
        <div className="trip-contacts-card__loading">
          <Skeleton height="3.5rem" />
          <Skeleton height="3.5rem" />
        </div>
      ) : contactsQuery.isError ? (
        <p className="trip-contacts-card__empty" role="alert">
          {t('tripContacts.loadError')}
        </p>
      ) : contactsQuery.data.length === 0 ? (
        <p className="trip-contacts-card__empty">
          {t(canEdit ? 'tripContacts.emptyOwner' : 'tripContacts.empty')}
        </p>
      ) : (
        <div className="trip-contacts-card__list">
          {contactsQuery.data.map((contact) => (
            <div className="trip-contact-row" key={contact.id}>
              <span className="trip-contact-row__name">{contact.name}</span>
              <div className="trip-contact-row__actions">
                {contact.phone && (
                  <a
                    aria-label={t('tripContacts.call', { name: contact.name })}
                    className="trip-contact-row__action"
                    href={`tel:${contact.phone}`}
                  >
                    <Icon name="phone" />
                  </a>
                )}
                {contact.email && (
                  <a
                    aria-label={t('tripContacts.emailContact', {
                      name: contact.name,
                    })}
                    className="trip-contact-row__action"
                    href={`mailto:${contact.email}`}
                  >
                    <Icon name="mail" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
