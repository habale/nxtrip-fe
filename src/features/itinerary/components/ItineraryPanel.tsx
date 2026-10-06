import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  ConfirmDialog,
  FabButton,
  FabMenu,
  Icon,
  Item,
  ReorderHandle,
  ReorderList,
  Skeleton,
  SwipeItem,
  type IconName,
  IconButton,
} from '../../../shared/ui';
import type { Trip } from '../../trips/trip-repository';
import { ItineraryNodeEditor } from './ItineraryNodeEditor';
import { getItineraryCategory } from '../itinerary-category';
import {
  useItineraryWindow,
  usePrefetchItineraryWindows,
  useRemoveItineraryNode,
  useReorderItineraryNode,
} from '../itinerary-hooks';
import type { ItineraryRepository } from '../itinerary-repository';
import type {
  ItineraryNode,
  MoveNode,
  NodeAttachment,
} from '../itinerary-types';
import { generateSortKeyBetween } from '../itinerary-sort-key';
import {
  getInitialItineraryWindow,
  getAdjacentItineraryWindows,
  getItineraryWindowForDate,
  getTripItineraryBounds,
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

function DirectionsLink({ url }: { url: string | null }) {
  const { t } = useTranslation('common');
  const safeUrl = safeExternalUrl(url);
  if (!safeUrl) return null;

  return (
    <a
      aria-label={t('itinerary.directions')}
      className="itinerary-node__directions"
      href={safeUrl}
      rel="noreferrer"
      target="_blank"
    >
      <Icon name="directions" />
      <span>{t('itinerary.directions')}</span>
    </a>
  );
}

function AttachmentLinks({ attachments }: { attachments: NodeAttachment[] }) {
  const visibleAttachments = attachments.filter(
    (attachment) => attachment.role !== 'cover',
  );
  if (visibleAttachments.length === 0) return null;

  return (
    <ul className="itinerary-node__attachments">
      {visibleAttachments.map((item) => {
        const fileUrl = safeExternalUrl(item.fileUrl);
        return (
          <li key={item.id}>
            <Icon name="attachment" />
            {fileUrl ? (
              <a href={fileUrl} rel="noreferrer" target="_blank">
                {item.label}
              </a>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
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

const MoveConnector = memo(function MoveConnector({
  node,
  locale,
  timeZone,
}: {
  node: MoveNode;
  locale: string;
  timeZone: string;
}) {
  const { t } = useTranslation('common');
  const time = formatNodeTime(node, locale, timeZone);
  const title = node.title.trim() || t('itinerary.move');

  return (
    <Item
      className={`itinerary-move itinerary-category--${getItineraryCategory(node)}`}
      dataNodeId={node.id}
    >
      <span className="itinerary-move__line" />
      <div className="itinerary-move__content">
        <div className="itinerary-move__pill">
          <div className="itinerary-move__header">
            <div className="itinerary-move__summary">
              <Icon name={nodeIcon(node)} />
              {time && <time dateTime={node.startAt ?? undefined}>{time}</time>}
              <span>{title}</span>
            </div>
          </div>
          {node.additionalLines.length > 0 && (
            <div className="itinerary-move__lines">
              {node.additionalLines.map((line, index) => (
                <p key={`${line.type}-${index}`}>{line.text}</p>
              ))}
            </div>
          )}
          <AttachmentLinks attachments={node.attachments} />
          <DirectionsLink url={node.googleMapsUrl} />
        </div>
      </div>
    </Item>
  );
});

const StopCard = memo(function StopCard({
  node,
  locale,
  timeZone,
}: {
  node: ItineraryNode;
  locale: string;
  timeZone: string;
}) {
  const { t } = useTranslation('common');
  const time = formatNodeTime(node, locale, timeZone);
  const cover = node.attachments.find(
    (item) =>
      item.role === 'cover' && item.attachment.mime_type?.startsWith('image/'),
  );
  const coverUrl = cover?.thumbnailUrl ?? cover?.fileUrl;

  return (
    <Item
      className={`itinerary-stop itinerary-category--${getItineraryCategory(node)}${coverUrl ? ' itinerary-stop--cover' : ''}`}
      dataNodeId={node.id}
    >
      {coverUrl ? (
        <div className="itinerary-stop__covered-card">
          <div className="itinerary-stop__hero">
            <img
              alt=""
              className="itinerary-stop__cover"
              decoding="async"
              loading="lazy"
              src={coverUrl}
            />
            <div className="itinerary-stop__hero-content">
              <div className="itinerary-stop__icon">
                <Icon name={nodeIcon(node)} size="large" />
              </div>
              <div className="itinerary-stop__summary">
                {time && (
                  <time dateTime={node.startAt ?? undefined}>{time}</time>
                )}
                <h3>{node.title || t('itinerary.untitledStop')}</h3>
              </div>
            </div>
          </div>
          <div className="itinerary-stop__cover-body">
            {node.additionalLines.length > 0 && (
              <div className="itinerary-stop__lines">
                {node.additionalLines.map((line, index) => (
                  <p key={`${line.type}-${index}`}>{line.text}</p>
                ))}
              </div>
            )}
            <AttachmentLinks attachments={node.attachments} />
            <DirectionsLink url={node.googleMapsUrl} />
          </div>
        </div>
      ) : (
        <div className="itinerary-stop__layout">
          <div className="itinerary-stop__header">
            <div className="itinerary-stop__icon">
              <Icon name={nodeIcon(node)} size="large" />
            </div>
            <div className="itinerary-stop__summary">
              {time && <time dateTime={node.startAt ?? undefined}>{time}</time>}
              <h3>{node.title || t('itinerary.untitledStop')}</h3>
            </div>
          </div>
          {(node.additionalLines.length > 0 ||
            node.attachments.length > 0 ||
            node.googleMapsUrl) && (
            <div className="itinerary-stop__body">
              {node.additionalLines.length > 0 && (
                <div className="itinerary-stop__lines">
                  {node.additionalLines.map((line, index) => (
                    <p key={`${line.type}-${index}`}>{line.text}</p>
                  ))}
                </div>
              )}
              <AttachmentLinks attachments={node.attachments} />
              <DirectionsLink url={node.googleMapsUrl} />
            </div>
          )}
        </div>
      )}
    </Item>
  );
});

export function ItineraryPanel({ trip, repository }: ItineraryPanelProps) {
  const { t, i18n } = useTranslation('common');
  const initial = useMemo(() => getInitialItineraryWindow(trip), [trip]);
  const [selectedDate, setSelectedDate] = useState(initial.selectedDate);
  const dayNavigationRef = useRef<HTMLDivElement>(null);
  const [dayNavigationScrollable, setDayNavigationScrollable] = useState(false);
  const window = useMemo(
    () => getItineraryWindowForDate(trip, selectedDate),
    [selectedDate, trip],
  );
  const adjacentWindows = useMemo(
    () => getAdjacentItineraryWindows(trip, window),
    [trip, window],
  );
  const [mode, setMode] = useState<'view' | 'edit' | 'reorder'>('view');
  const [editor, setEditor] = useState<
    | { type: 'create'; sortKey: string; afterNodeId?: string }
    | { type: 'edit'; node: ItineraryNode }
    | null
  >(null);
  const [nodePendingRemoval, setNodePendingRemoval] =
    useState<ItineraryNode | null>(null);
  const [reorderKeyError, setReorderKeyError] = useState(false);
  const query = useItineraryWindow(window, repository);
  usePrefetchItineraryWindows(adjacentWindows, repository);
  const removeNode = useRemoveItineraryNode(repository);
  const reorderNode = useReorderItineraryNode(window, repository);
  const locale = i18n.resolvedLanguage === 'vi' ? 'vi-VN' : 'en-US';
  const tripBounds = useMemo(
    () => getTripItineraryBounds(trip, selectedDate),
    [selectedDate, trip],
  );
  const days = useMemo(
    () => itineraryDays(tripBounds.startDate, tripBounds.endDate),
    [tripBounds],
  );
  const selectedNodes = useMemo(
    () =>
      (query.data?.nodes ?? [])
        .filter((node) => node.localDate === selectedDate)
        .sort((left, right) =>
          left.sortKey < right.sortKey
            ? -1
            : left.sortKey > right.sortKey
              ? 1
              : left.id.localeCompare(right.id),
        ),
    [query.data?.nodes, selectedDate],
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

  useEffect(() => {
    const navigation = dayNavigationRef.current;
    if (!navigation) return;

    const updateScrollable = () => {
      const buttons = Array.from(
        navigation.querySelectorAll<HTMLElement>('[data-itinerary-day]'),
      );
      const gap =
        Number.parseFloat(getComputedStyle(navigation).columnGap) || 0;
      const contentWidth =
        buttons.reduce((total, button) => total + button.offsetWidth, 0) +
        Math.max(0, buttons.length - 1) * gap;
      setDayNavigationScrollable(contentWidth > navigation.clientWidth + 1);
    };

    updateScrollable();
    const resizeObserver = globalThis.ResizeObserver
      ? new ResizeObserver(updateScrollable)
      : null;
    resizeObserver?.observe(navigation);
    navigation
      .querySelectorAll<HTMLElement>('[data-itinerary-day]')
      .forEach((button) => resizeObserver?.observe(button));
    globalThis.addEventListener('resize', updateScrollable);

    return () => {
      resizeObserver?.disconnect();
      globalThis.removeEventListener('resize', updateScrollable);
    };
  }, [days, locale]);

  useEffect(() => {
    if (!dayNavigationScrollable) return;
    const navigation = dayNavigationRef.current;
    const selectedButton = navigation?.querySelector<HTMLElement>(
      `[data-itinerary-day="${selectedDate}"]`,
    );
    if (!navigation || !selectedButton) return;

    const left =
      selectedButton.offsetLeft -
      (navigation.clientWidth - selectedButton.offsetWidth) / 2;
    const reduceMotion =
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false;
    navigation.scrollTo?.({
      left: Math.max(0, left),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [dayNavigationScrollable, selectedDate]);

  function moveNode(from: number, to: number) {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= selectedNodes.length ||
      to >= selectedNodes.length ||
      reorderNode.isPending
    ) {
      return;
    }

    setReorderKeyError(false);
    const reordered = [...selectedNodes];
    const [movedNode] = reordered.splice(from, 1);
    reordered.splice(to, 0, movedNode);

    try {
      const sortKey = generateSortKeyBetween(
        reordered[to - 1]?.sortKey ?? null,
        reordered[to + 1]?.sortKey ?? null,
      );
      reorderNode.mutate({
        tripId: trip.id,
        nodeId: movedNode.id,
        version: movedNode.version,
        sortKey,
      });
    } catch {
      setReorderKeyError(true);
    }
  }

  function openCreateEditor(
    previousSortKey: string | null,
    nextSortKey: string | null,
    afterNodeId?: string,
  ) {
    setReorderKeyError(false);
    try {
      setEditor({
        type: 'create',
        afterNodeId,
        sortKey: generateSortKeyBetween(previousSortKey, nextSortKey),
      });
    } catch {
      setReorderKeyError(true);
    }
  }

  return (
    <section className="itinerary-panel">
      <div className="itinerary-day-navigation">
        <div
          ref={dayNavigationRef}
          className={`itinerary-day-navigation__days${
            dayNavigationScrollable ? ' is-scrollable' : ''
          }`}
        >
          {days.map((day) => (
            <button
              key={day}
              aria-pressed={selectedDate === day}
              className={selectedDate === day ? 'is-selected' : ''}
              data-itinerary-day={day}
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
        <div>
          <p>{t('itinerary.dayLabel', { day: tripDayNumber(selectedDate) })}</p>
          <h2>
            {headingFormatter.format(new Date(`${selectedDate}T00:00:00Z`))}
          </h2>
        </div>
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
      ) : (
        <div className="itinerary-edit-context">
          {mode === 'edit' && editor === null && (
            <IconButton
              icon="add_circle"
              label={t('itinerary.editor.addBetween')}
              size="large"
              onClick={() =>
                openCreateEditor(null, selectedNodes[0]?.sortKey ?? null)
              }
            />
          )}
          {editor?.type === 'create' && !editor.afterNodeId && (
            <ItineraryNodeEditor
              localDate={selectedDate}
              repository={repository}
              sortKey={editor.sortKey}
              trip={trip}
              onClose={() => setEditor(null)}
            />
          )}

          {selectedNodes.length === 0 && mode !== 'edit' ? (
            <div className="itinerary-state">
              <Icon name="calendar" size="large" />
              <h2>{t('itinerary.emptyDayTitle')}</h2>
              <p>{t('itinerary.emptyDayDescription')}</p>
            </div>
          ) : (
            <ReorderList
              className="itinerary-timeline"
              disabled={mode !== 'reorder' || reorderNode.isPending}
              onReorder={moveNode}
            >
              {selectedNodes.map((node, index) => (
                <div
                  key={node.id}
                  className={`itinerary-node-context${
                    mode === 'reorder'
                      ? ' itinerary-node-context--reordering'
                      : ''
                  }${
                    editor?.type === 'edit' && editor.node.id === node.id
                      ? ' itinerary-node-context--editing'
                      : ''
                  }`}
                >
                  {mode === 'reorder' && (
                    <div className="itinerary-reorder-anchor">
                      <ReorderHandle
                        label={t('itinerary.editor.dragNode', {
                          title:
                            node.title || t('itinerary.editor.untitledNode'),
                        })}
                      />
                    </div>
                  )}
                  <SwipeItem
                    disabled={mode !== 'edit' || editor !== null}
                    editLabel={t('itinerary.editor.editNode')}
                    removeDisabled={removeNode.isPending}
                    removeLabel={t('itinerary.editor.removeNode')}
                    onEdit={() => setEditor({ type: 'edit', node })}
                    onRemove={() => setNodePendingRemoval(node)}
                  >
                    {node.nodeType === 'move' ? (
                      <MoveConnector
                        locale={locale}
                        node={node}
                        timeZone={trip.timezone}
                      />
                    ) : (
                      <StopCard
                        locale={locale}
                        node={node}
                        timeZone={trip.timezone}
                      />
                    )}
                  </SwipeItem>
                  {mode === 'edit' && editor === null && (
                    <IconButton
                      icon="add_circle"
                      label={t('itinerary.editor.addBetween')}
                      size="large"
                      onClick={() => {
                        const nextSortKey = selectedNodes
                          .slice(index + 1)
                          .find(
                            (candidate) => candidate.sortKey > node.sortKey,
                          )?.sortKey;
                        openCreateEditor(
                          node.sortKey,
                          nextSortKey ?? null,
                          node.id,
                        );
                      }}
                    />
                  )}
                  {editor?.type === 'create' &&
                    editor.afterNodeId === node.id && (
                      <ItineraryNodeEditor
                        localDate={selectedDate}
                        repository={repository}
                        sortKey={editor.sortKey}
                        trip={trip}
                        onClose={() => setEditor(null)}
                      />
                    )}
                  {editor?.type === 'edit' && editor.node.id === node.id && (
                    <ItineraryNodeEditor
                      localDate={selectedDate}
                      node={node}
                      repository={repository}
                      trip={trip}
                      onClose={() => setEditor(null)}
                    />
                  )}
                </div>
              ))}
            </ReorderList>
          )}

          {selectedNodes.length > 0 && (
            <div className="itinerary-end-of-day" role="note">
              <span>{t('itinerary.endOfDay')}</span>
            </div>
          )}

          {(reorderNode.isError || reorderKeyError) && (
            <p className="itinerary-reorder-error" role="alert">
              {t('itinerary.editor.reorderError')}
            </p>
          )}
        </div>
      )}
      <ConfirmDialog
        destructive
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('itinerary.editor.removeNode')}
        message={t('itinerary.editor.removeDescription', {
          title:
            nodePendingRemoval?.title || t('itinerary.editor.untitledNode'),
        })}
        open={nodePendingRemoval !== null}
        title={t('itinerary.editor.removeTitle')}
        onCancel={() => setNodePendingRemoval(null)}
        onConfirm={() => {
          if (!nodePendingRemoval) return;
          removeNode.mutate({
            tripId: trip.id,
            nodeId: nodePendingRemoval.id,
            localDate: nodePendingRemoval.localDate ?? selectedDate,
            version: nodePendingRemoval.version,
          });
          setNodePendingRemoval(null);
        }}
      />
      {mode === 'view' && !query.isPending && !query.isError && (
        <FabMenu
          icon="edit"
          label={t('itinerary.editor.actionsMenu')}
          actions={[
            {
              icon: 'edit',
              label: t('itinerary.editor.editItinerary'),
              onClick: () => setMode('edit'),
            },
            {
              icon: 'drag',
              label: t('itinerary.editor.rearrangeItinerary'),
              disabled: selectedNodes.length < 2,
              onClick: () => setMode('reorder'),
            },
          ]}
        />
      )}
      {mode !== 'view' && (
        <FabButton
          hideWhenKeyboardOpen
          icon="check"
          label={t('itinerary.editor.done')}
          onClick={() => {
            setMode('view');
            setEditor(null);
          }}
        />
      )}
    </section>
  );
}
