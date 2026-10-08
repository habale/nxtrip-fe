import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { routes } from '../../../app/routes';
import { Avatar, Button, Icon } from '../../../shared/ui';
import {
  deriveTripStatus,
  formatTripDateRange,
  getTripProgress,
} from '../trip-date';
import type { TripListItem } from '../trip-repository';

type TripCardProps = {
  item: TripListItem;
  featured?: boolean;
};

export function TripCard({ item, featured = false }: TripCardProps) {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const { trip, members, coverThumbnailUrl } = item;
  const status = deriveTripStatus(trip);
  const progress = status === 'ongoing' ? getTripProgress(trip) : null;
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
      aria-label={trip.name}
      className={`trip-card trip-card--${status}${featured ? ' trip-card--featured' : ''}${coverThumbnailUrl ? ' trip-card--cover' : ''}`}
      role="link"
      style={style}
      tabIndex={0}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('button, a, ion-button, ion-router-link')
        ) {
          return;
        }
        navigate(routes.trip(trip.id));
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        navigate(routes.trip(trip.id));
      }}
    >
      <div className="trip-card__overlay" />
      <div className="trip-card__content">
        <header className="trip-card__meta">
          <span className="trip-status">{t(`home.status.${status}`)}</span>
          {dateRange && <time>{dateRange}</time>}
        </header>

        <div>
          <h2>{trip.name}</h2>
          {trip.description && (
            <p className="trip-card__description">{trip.description}</p>
          )}
          {progress && (
            <section className="trip-progress-card">
              <div className="trip-progress-card__heading">
                <span>{t('tripInfo.progressTitle')}</span>
                <strong>
                  {t('tripInfo.progressDay', {
                    current: progress.currentDay,
                    total: progress.totalDays,
                  })}
                </strong>
              </div>
              <div
                aria-label={t('tripInfo.progressDay', {
                  current: progress.currentDay,
                  total: progress.totalDays,
                })}
                aria-valuemax={progress.totalDays}
                aria-valuemin={1}
                aria-valuenow={progress.currentDay}
                className="trip-progress-card__segments"
                role="progressbar"
              >
                {Array.from({ length: progress.totalDays }, (_, index) => (
                  <span
                    key={index}
                    className={
                      index < progress.currentDay ? 'is-complete' : undefined
                    }
                  />
                ))}
              </div>
            </section>
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
              {status === 'completed'
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
