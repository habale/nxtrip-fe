import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import { Avatar, Button, Icon, Page } from '../../../shared/ui';
import { useAuth } from '../../auth/auth-context';
import { useCurrentProfile } from '../../profile/profile-hooks';
import { TripCard } from '../components/TripCard';
import { TripListSkeleton } from '../components/TripListSkeleton';
import { useTripList } from '../trip-hooks';
import type { Trip } from '../trip-repository';

import './home.css';

type TripFilter = 'all' | Trip['status'];

const filters: TripFilter[] = [
  'all',
  'ongoing',
  'planning',
  'pending_settlement',
  'completed',
];

export function HomePage() {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const profileQuery = useCurrentProfile();
  const profile = profileQuery.data;
  const tripQuery = useTripList();
  const [filter, setFilter] = useState<TripFilter>('all');
  const displayName =
    profile?.display_name ??
    (typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : (user?.email ?? t('home.traveler')));
  const firstName = displayName.trim().split(/\s+/)[0] || t('home.traveler');
  const avatarUrl =
    profile?.avatar_url ??
    (typeof user?.user_metadata?.avatar_url === 'string'
      ? user.user_metadata.avatar_url
      : undefined);
  const trips = tripQuery.data ?? [];
  const filteredTrips =
    filter === 'all'
      ? trips
      : trips.filter(({ trip }) => trip.status === filter);

  return (
    <Page
      onRefresh={() =>
        Promise.all([profileQuery.refetch(), tripQuery.refetch()])
      }
      headerStart={<span className="home-wordmark">NxTrip</span>}
      headerEnd={
        <div className="home-profile-action">
          <Button
            ariaLabel={t('settings.openProfile')}
            href={routes.settings}
            navigationDirection="forward"
            variant="quiet"
          >
            <Avatar name={displayName} src={avatarUrl} size="small" />
          </Button>
        </div>
      }
    >
      <main className="home-page">
        <section className="home-intro">
          <div>
            <h1>{t('home.greeting', { name: firstName })}</h1>
          </div>
          <Button href={routes.addTrip} navigationDirection="forward">
            <span className="home-new-trip">
              <Icon name="add" />
              {t('home.newTrip')}
            </span>
          </Button>
        </section>

        {!tripQuery.isPending && !tripQuery.isError && trips.length > 0 && (
          <nav className="home-filters" aria-label={t('home.filterLabel')}>
            {filters.map((option) => {
              const count =
                option === 'all'
                  ? trips.length
                  : trips.filter(({ trip }) => trip.status === option).length;

              return (
                <Button
                  key={option}
                  ariaLabel={t('home.filterAriaLabel', {
                    filter: t(`home.filters.${option}`),
                    count,
                  })}
                  selected={filter === option}
                  variant="filter"
                  onClick={() => setFilter(option)}
                >
                  {t(`home.filters.${option}`)} ({count})
                </Button>
              );
            })}
          </nav>
        )}

        {tripQuery.isPending ? (
          <TripListSkeleton />
        ) : tripQuery.isError ? (
          <section className="home-state" role="alert">
            <Icon name="location" size="large" />
            <h2>{t('home.loadErrorTitle')}</h2>
            <p>{t('home.loadErrorDescription')}</p>
            <Button onClick={() => void tripQuery.refetch()}>
              {t('actions.retry')}
            </Button>
          </section>
        ) : trips.length === 0 ? (
          <section className="home-state">
            <Icon name="location" size="large" />
            <h2>{t('home.emptyTitle')}</h2>
            <p>{t('home.emptyDescription')}</p>
          </section>
        ) : filteredTrips.length === 0 ? (
          <section className="home-state">
            <h2>{t('home.noFilteredTrips')}</h2>
            <Button variant="quiet" onClick={() => setFilter('all')}>
              {t('home.showAll')}
            </Button>
          </section>
        ) : (
          <section className="trip-list" aria-label={t('home.tripListLabel')}>
            {filteredTrips.map((item, index) => (
              <TripCard
                key={item.trip.id}
                featured={index === 0 && item.trip.status === 'ongoing'}
                item={item}
              />
            ))}
          </section>
        )}
      </main>
    </Page>
  );
}
