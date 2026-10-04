import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Icon,
  Item,
  Skeleton,
  type IconName,
} from '../../../shared/ui';
import type { Trip } from '../../trips/trip-repository';
import { getItineraryCategory } from '../itinerary-category';
import { useItineraryWindow } from '../itinerary-hooks';
import type { ItineraryRepository } from '../itinerary-repository';
import type { ItineraryNode, MoveNode } from '../itinerary-types';
import {
  getInitialItineraryWindow,
  itineraryDays,
  localDateForInstant,
} from '../itinerary-window';

import './itinerary.css';

type ItineraryPanelProps = {
  trip: Trip;
  repository?: ItineraryRepository;
};

const iconByKey: Record<string, IconName> = {
  accommodation: 'hotel',
  activity: 'activity',
  bus: 'vehicle',
  car: 'vehicle',
  cafe: 'cafe',
  ferry: 'ferry',
  flight: 'flight',
  food: 'restaurant',
  hotel: 'hotel',
  misc: 'misc',
  others: 'others',
  rail: 'train',
  restaurant: 'restaurant',
  shopping: 'shopping',
  sightseeing: 'sightseeing',
  ticket: 'ticket',
  train: 'train',
  walk: 'walk',
};

function nodeIcon(node: ItineraryNode): IconName {
  const key = node.iconKey?.toLowerCase();
  if (key && iconByKey[key]) return iconByKey[key];
  if (node.nodeType === 'move') {
    const mode = node.transportMode?.toLowerCase();
    return mode && iconByKey[mode] ? iconByKey[mode] : 'vehicle';
  }
  return 'location';
}

function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function formatNodeTime(
  node: ItineraryNode,
  locale: string,
  fallbackTimeZone: string,
) {
  if (node.allDay) return null;
  if (!node.startAt) return null;
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: node.timezone ?? fallbackTimeZone,
  }).format(new Date(node.startAt));
}

function MoveConnector({ node }: { node: MoveNode }) {
  const { t } = useTranslation('common');
  const label =
    node.operator?.trim() ||
    node.title.trim() ||
    node.transportMode?.trim() ||
    t('itinerary.move');

  return (
    <Item
      className={`itinerary-move itinerary-category--${getItineraryCategory(node)}`}
      dataNodeId={node.id}
    >
      <span className="itinerary-move__line" />
      <div className="itinerary-move__pill">
        <Icon name={nodeIcon(node)} />
        <span>{label}</span>
        {node.durationMinutes !== null && (
          <span>
            • {t('itinerary.minutes', { count: node.durationMinutes })}
          </span>
        )}
      </div>
    </Item>
  );
}

function StopCard({
  node,
  locale,
  timeZone,
}: {
  node: ItineraryNode;
  locale: string;
  timeZone: string;
}) {
  const { t } = useTranslation('common');
  const directionsUrl = safeExternalUrl(node.googleMapsUrl);
  const time = formatNodeTime(node, locale, timeZone);

  return (
    <Item
      className={`itinerary-stop itinerary-category--${getItineraryCategory(node)}`}
      dataNodeId={node.id}
    >
      <div className="itinerary-stop__layout">
        <div className="itinerary-stop__icon">
          <Icon name={nodeIcon(node)} size="large" />
        </div>
        <div className="itinerary-stop__content">
          {time && <time dateTime={node.startAt ?? undefined}>{time}</time>}
          <h3>{node.title || t('itinerary.untitledStop')}</h3>
          {node.additionalLines.length > 0 && (
            <div className="itinerary-stop__lines">
              {node.additionalLines.map((line, index) => (
                <p key={`${line.type}-${index}`}>{line.text}</p>
              ))}
            </div>
          )}
          {node.attachments.length > 0 && (
            <ul className="itinerary-stop__attachments">
              {node.attachments.map((item) => (
                <li key={item.id}>
                  <Icon name="attachment" />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {directionsUrl && (
          <a
            className="itinerary-stop__directions"
            href={directionsUrl}
            rel="noreferrer"
            target="_blank"
          >
            <Icon name="directions" />
            <span>{t('itinerary.directions')}</span>
          </a>
        )}
      </div>
    </Item>
  );
}

export function ItineraryPanel({ trip, repository }: ItineraryPanelProps) {
  const { t, i18n } = useTranslation('common');
  const initial = useMemo(() => getInitialItineraryWindow(trip), [trip]);
  const window = useMemo(
    () => ({
      tripId: initial.tripId,
      startDate: initial.startDate,
      endDate: initial.endDate,
    }),
    [initial],
  );
  const [selectedDate, setSelectedDate] = useState(initial.selectedDate);
  const query = useItineraryWindow(window, repository);
  const locale = i18n.resolvedLanguage === 'vi' ? 'vi-VN' : 'en-US';
  const days = itineraryDays(window.startDate, window.endDate);
  const selectedNodes = (query.data?.nodes ?? []).filter(
    (node) => node.localDate === selectedDate,
  );
  const tripStart = trip.start_at
    ? localDateForInstant(new Date(trip.start_at), trip.timezone)
    : window.startDate;
  const tripDayNumber = (day: string) =>
    Math.round(
      (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${tripStart}T00:00:00Z`)) /
        86_400_000,
    ) + 1;
  const dayFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const headingFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeZone: 'UTC',
  });

  return (
    <section className="itinerary-panel">
      <div className="itinerary-day-navigation">
        <div className="itinerary-day-navigation__days">
          {days.map((day) => (
            <button
              key={day}
              aria-pressed={selectedDate === day}
              className={selectedDate === day ? 'is-selected' : ''}
              type="button"
              onClick={() => setSelectedDate(day)}
            >
              {t('itinerary.dayOption', {
                day: tripDayNumber(day),
                date: dayFormatter.format(new Date(`${day}T00:00:00Z`)),
              })}
            </button>
          ))}
        </div>
      </div>

      <header className="itinerary-day-heading">
        <p>{t('itinerary.dayLabel', { day: tripDayNumber(selectedDate) })}</p>
        <h2>
          {headingFormatter.format(new Date(`${selectedDate}T00:00:00Z`))}
        </h2>
      </header>

      {query.isPending ? (
        <div className="itinerary-timeline" aria-label={t('states.loading')}>
          <Skeleton height="9rem" />
          <Skeleton height="3rem" />
          <Skeleton height="9rem" />
        </div>
      ) : query.isError ? (
        <div className="itinerary-state" role="alert">
          <Icon name="location" size="large" />
          <h2>{t('itinerary.loadErrorTitle')}</h2>
          <p>{t('itinerary.loadErrorDescription')}</p>
          <Button variant="quiet" onClick={() => void query.refetch()}>
            {t('actions.retry')}
          </Button>
        </div>
      ) : selectedNodes.length === 0 ? (
        <div className="itinerary-state">
          <Icon name="calendar" size="large" />
          <h2>{t('itinerary.emptyDayTitle')}</h2>
          <p>{t('itinerary.emptyDayDescription')}</p>
        </div>
      ) : (
        <div className="itinerary-timeline">
          {selectedNodes.map((node) =>
            node.nodeType === 'move' ? (
              <MoveConnector key={node.id} node={node} />
            ) : (
              <StopCard
                key={node.id}
                locale={locale}
                node={node}
                timeZone={trip.timezone}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}
