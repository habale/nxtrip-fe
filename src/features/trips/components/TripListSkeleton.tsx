import { Skeleton } from '../../../shared/ui';

export function TripListSkeleton() {
  return (
    <div className="trip-list" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div className="trip-card trip-card--skeleton" key={item}>
          <Skeleton width="7rem" height="1.5rem" />
          <Skeleton width="65%" height="2.75rem" />
          <Skeleton width="100%" height="5rem" />
          <Skeleton width="45%" height="3rem" />
        </div>
      ))}
    </div>
  );
}
