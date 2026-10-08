import { useTranslation } from 'react-i18next';

import type { DerivedTripStatus } from '../trip-date';

import './trip-status-badge.css';

type TripStatusBadgeProps = {
  status: DerivedTripStatus;
};

export function TripStatusBadge({ status }: TripStatusBadgeProps) {
  const { t } = useTranslation('common');

  return (
    <span className={`trip-status trip-status--${status}`}>
      {t(`home.status.${status}`)}
    </span>
  );
}
