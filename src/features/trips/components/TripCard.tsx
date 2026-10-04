import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import { Avatar, Button, Icon } from '../../../shared/ui';
import { formatTripDateRange } from '../trip-date';
import type { TripListItem } from '../trip-repository';

type TripCardProps = {
  item: TripListItem;
  featured?: boolean;
};

export function TripCard({ item, featured = false }: TripCardProps) {
  const { t, i18n } = useTranslation('common');
  const { trip, members, coverThumbnailUrl } = item;
  const dateRange = formatTripDateRange(
    trip.start_at,
    trip.end_at,
    i18n.language,
    trip.timezone,
  );
  const visibleMembers = members.slice(0, 3);
  const remainingMembers = members.length - visibleMembers.length;
  const style = coverThumbnailUrl
    ? { backgroundImage: `url(${JSON.stringify(coverThumbnailUrl)})` }
    : undefined;

  return (
    <article
      className={`trip-card trip-card--${trip.status}${featured ? ' trip-card--featured' : ''}${coverThumbnailUrl ? ' trip-card--cover' : ''}`}
      style={style}
    >
      <div className="trip-card__overlay" />
      <div className="trip-card__content">
        <header className="trip-card__meta">
          <span className="trip-status">{t(`home.status.${trip.status}`)}</span>
          {dateRange && <time>{dateRange}</time>}
        </header>

        <div>
          <h2>{trip.name}</h2>
          {trip.description && (
            <p className="trip-card__description">{trip.description}</p>
          )}
        </div>

        <div className="trip-card__footer">
          <div
            className="trip-members"
            aria-label={t('home.memberCount', { count: members.length })}
          >
            {visibleMembers.map((member) => (
              <Avatar
                key={member.id}
                name={member.display_name}
                src={member.avatar_url ?? undefined}
                size="small"
                initialCount={2}
              />
            ))}
            {remainingMembers > 0 && (
              <span className="trip-members__more">+{remainingMembers}</span>
            )}
            {members.length === 0 && (
              <span className="trip-members__count">{t('home.noMembers')}</span>
            )}
          </div>

          <Button
            href={routes.trip(trip.id)}
            navigationDirection="forward"
            variant={featured ? 'secondary' : 'quiet'}
          >
            <span className="trip-card__action">
              {trip.status === 'completed'
                ? t('home.viewRecap')
                : t('home.openTrip')}
              <Icon name="forward" />
            </span>
          </Button>
        </div>
      </div>
    </article>
  );
}
