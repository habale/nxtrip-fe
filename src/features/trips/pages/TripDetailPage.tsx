import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { routes } from '../../../app/routes';
import { AppError } from '../../../shared/api/app-error';
import { Button, Icon, Page, Skeleton, TabLink } from '../../../shared/ui';
import { ItineraryPanel } from '../../itinerary/components/ItineraryPanel';
import type { ItineraryRepository } from '../../itinerary/itinerary-repository';
import { LedgerPanel } from '../../ledger/components/LedgerPanel';
import type { LedgerRepository } from '../../ledger/ledger-repository';
import { TripInfoPanel } from '../components/TripInfoPanel';
import { TripMembersPanel } from '../components/TripMembersPanel';
import { formatTripDateRange } from '../trip-date';
import { useTripDetail } from '../trip-hooks';
import type { TripRepository } from '../trip-repository';

import './trip-detail.css';

export type TripSection =
  'info' | 'itinerary' | 'ledger' | 'attachments' | 'bookmarks';

const sectionIcons = {
  info: 'document',
  itinerary: 'location',
  ledger: 'wallet',
  attachments: 'attachment',
  bookmarks: 'bookmark',
} as const;

type TripDetailPageProps = {
  section?: TripSection;
  repository?: TripRepository;
  itineraryRepository?: ItineraryRepository;
  ledgerRepository?: LedgerRepository;
};

function isTripSection(value: string | undefined): value is TripSection {
  return (
    value === 'info' ||
    value === 'itinerary' ||
    value === 'ledger' ||
    value === 'attachments' ||
    value === 'bookmarks'
  );
}

export function TripDetailPage({
  section: sectionOverride,
  repository,
  itineraryRepository,
  ledgerRepository,
}: TripDetailPageProps) {
  const { t, i18n } = useTranslation('common');
  const { tripId = '', section: routeSection } = useParams();
  const section =
    sectionOverride ?? (isTripSection(routeSection) ? routeSection : 'info');
  const tripQuery = useTripDetail(tripId, repository);
  const detail = tripQuery.data;
  const trip = detail?.trip;
  const locale = i18n.resolvedLanguage === 'vi' ? 'vi-VN' : 'en-US';
  const sections: TripSection[] = [
    'info',
    'itinerary',
    'ledger',
    'attachments',
    'bookmarks',
  ];

  if (tripQuery.isPending) {
    return (
      <Page hideHeader padded={false}>
        <main className="trip-detail-state" aria-label={t('states.loading')}>
          <Skeleton width="70%" height="3rem" />
          <Skeleton width="100%" height="5rem" />
          <Skeleton width="100%" height="18rem" />
        </main>
      </Page>
    );
  }

  if (!trip) {
    const accessDenied =
      tripQuery.error instanceof AppError &&
      tripQuery.error.code === 'TRIP_ACCESS_DENIED';

    return (
      <Page hideHeader padded={false}>
        <main className="trip-detail-state trip-detail-state--message">
          <Icon name={accessDenied ? 'person' : 'location'} size="large" />
          <h1>
            {t(
              accessDenied
                ? 'tripDetail.accessDeniedTitle'
                : 'tripDetail.notFoundTitle',
            )}
          </h1>
          <p>
            {t(
              accessDenied
                ? 'tripDetail.accessDeniedDescription'
                : 'tripDetail.notFoundDescription',
            )}
          </p>
          <Button href={routes.home} navigationDirection="root">
            {t('tripDetail.backToTrips')}
          </Button>
        </main>
      </Page>
    );
  }

  const dateRange = formatTripDateRange(
    trip.start_at,
    trip.end_at,
    locale,
    trip.timezone,
  );
  const sectionPath = (nextSection: TripSection) => {
    if (nextSection === 'info') return routes.tripInfo(trip.id);
    if (nextSection === 'itinerary') return routes.tripItinerary(trip.id);
    if (nextSection === 'ledger') return routes.tripLedger(trip.id);
    if (nextSection === 'attachments') return routes.tripAttachments(trip.id);
    return routes.tripBookmarks(trip.id);
  };

  return (
    <Page hideHeader padded={false}>
      <div className="trip-detail-page">
        <header className="trip-detail-header">
          <Button
            ariaLabel={t('actions.back')}
            href={routes.home}
            navigationDirection="back"
            variant="quiet"
          >
            <Icon name="back" size="large" />
          </Button>
          <div className="trip-detail-heading">
            <h1>{trip.name}</h1>
            {dateRange && <p>{dateRange}</p>}
          </div>
          <Button
            disabled
            ariaLabel={t('tripDetail.moreActions')}
            variant="quiet"
          >
            <Icon name="more" size="large" />
          </Button>
        </header>

        <div className="trip-detail-layout">
          <nav
            className="trip-detail-nav"
            aria-label={t('tripDetail.navigation')}
          >
            {sections.map((item) => (
              <TabLink
                key={item}
                ariaLabel={
                  item === 'attachments' || item === 'bookmarks'
                    ? t(`tripDetail.sections.${item}`)
                    : undefined
                }
                href={sectionPath(item)}
                selected={section === item}
              >
                {item === 'attachments' || item === 'bookmarks' ? (
                  <Icon name={sectionIcons[item]} />
                ) : (
                  t(`tripDetail.sections.${item}`)
                )}
              </TabLink>
            ))}
          </nav>

          <main className="trip-detail-content">
            {section === 'info' ? (
              <>
                {/*<TripCover detail={detail} repository={repository} />*/}
                <TripInfoPanel
                  detail={detail}
                  locale={locale}
                  repository={repository}
                />
                <TripMembersPanel
                  repository={repository}
                  tripId={trip.id}
                  viewerRole={detail.role}
                />
              </>
            ) : section === 'itinerary' ? (
              <ItineraryPanel repository={itineraryRepository} trip={trip} />
            ) : section === 'ledger' ? (
              <LedgerPanel
                repository={ledgerRepository}
                trip={trip}
                locale={locale}
              />
            ) : (
              <section className="trip-detail-placeholder">
                <Icon name={sectionIcons[section]} size="large" />
                <h2>{t(`tripDetail.sections.${section}`)}</h2>
                <p>{t(`tripDetail.placeholders.${section}`)}</p>
              </section>
            )}
          </main>
        </div>
      </div>
    </Page>
  );
}
