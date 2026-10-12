import { useTranslation } from 'react-i18next';

import { Icon } from '../../../shared/ui';
import type { GuestContact } from '../guest-repository';

export function GuestContactsCard({ contacts }: { contacts: GuestContact[] }) {
  const { t } = useTranslation('common');
  return (
    <section
      className="trip-contacts-card"
      aria-labelledby="guest-contacts-title"
    >
      <div className="trip-contacts-card__heading">
        <div>
          <h2 id="guest-contacts-title">{t('tripContacts.title')}</h2>
        </div>
      </div>
      {contacts.length === 0 ? (
        <p className="trip-contacts-card__empty">{t('tripContacts.empty')}</p>
      ) : (
        <div className="trip-contacts-card__list">
          {contacts.map((contact) => (
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
