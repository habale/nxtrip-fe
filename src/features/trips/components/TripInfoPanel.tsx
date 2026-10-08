import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import { Button, Icon } from '../../../shared/ui';
import {
  deriveTripStatus,
  formatTripDateRange,
  getTripDuration,
} from '../trip-date';
import { getCurrencyLabel } from '../trip-options';
import type { TripDetail } from '../trip-repository';
import { TripStatusBadge } from './TripStatusBadge';

type TripInfoPanelProps = {
  detail: TripDetail;
  locale: string;
};

export function TripInfoPanel({ detail, locale }: TripInfoPanelProps) {
  const { t } = useTranslation('common');
  const { trip, role } = detail;
  const dateRange = formatTripDateRange(
    trip.start_at,
    trip.end_at,
    locale,
    trip.timezone,
  );
  const duration = getTripDuration(trip.start_at, trip.end_at, trip.timezone);
  const status = deriveTripStatus(trip);

  return (
    <section className="trip-info-view">
      <div className="trip-info-view__topline">
        <TripStatusBadge status={status} />
        {role === 'owner' && (
          <Button
            href={routes.editTrip(trip.id)}
            navigationDirection="forward"
            size="small"
            variant="quiet"
          >
            {t('tripInfo.edit')}
          </Button>
        )}
      </div>
      <h2>{trip.name}</h2>
      {dateRange && (
        <>
          <p className="trip-detail-date">
            <Icon name="calendar" />
            <span>{dateRange}</span>
          </p>
          {duration && (
            <div className="trip-info-duration">
              {t('tripInfo.dayCount', { count: duration.days })}{' '}
              {t('tripInfo.nightCount', { count: duration.nights })}
            </div>
          )}
        </>
      )}
      {trip.description && (
        <p className="trip-info-description">{trip.description}</p>
      )}
      <p className="trip-info-description trip-info-metadata">
        {t('tripInfo.timezone')}: {trip.timezone}
        <br />
        {t('tripInfo.defaultCurrency')}:{' '}
        {getCurrencyLabel(trip.default_currency, locale)}
        <br />
        {t('tripInfo.decimalPlaces')}: {trip.currency_decimal_places}
      </p>
    </section>
  );
}
