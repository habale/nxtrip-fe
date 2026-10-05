import { useMemo, useState } from 'react';
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
  useRemoveItineraryNode,
  useReorderItineraryNode,
} from '../itinerary-hooks';
import type { ItineraryRepository } from '../itinerary-repository';
import type { ItineraryNode, MoveNode } from '../itinerary-types';
import { generateSortKeyBetween } from '../itinerary-sort-key';
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

function MoveConnector({
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
          <div className="itinerary-move__summary">
            <Icon name={nodeIcon(node)} />
            {time && <time dateTime={node.startAt ?? undefined}>{time}</time>}
            <span>{title}</span>
          </div>
          {node.additionalLines.length > 0 && (
            <div className="itinerary-move__lines">
              {node.additionalLines.map((line, index) => (
                <p key={`${line.type}-${index}`}>{line.text}</p>
              ))}
            </div>
          )}
        </div>
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
            <img alt="" className="itinerary-stop__cover" src={coverUrl} />
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
          </div>
        </div>
      ) : (
        <div className="itinerary-stop__layout">
          <div className="itinerary-stop__icon">
            <Icon name={nodeIcon(node)} size="large" />
          </div>
          <div className="itinerary-stop__content">
            <div className="itinerary-stop__summary">
              {time && <time dateTime={node.startAt ?? undefined}>{time}</time>}
              <h3>{node.title || t('itinerary.untitledStop')}</h3>
            </div>
            {node.additionalLines.length > 0 && (
              <div className="itinerary-stop__lines">
                {node.additionalLines.map((line, index) => (
                  <p key={`${line.type}-${index}`}>{line.text}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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
  const removeNode = useRemoveItineraryNode(repository);
  const reorderNode = useReorderItineraryNode(window, repository);
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
                setEditor({
                  type: 'create',
                  sortKey: generateSortKeyBetween(
                    null,
                    selectedNodes[0]?.sortKey ?? null,
                  ),
                })
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
                      onClick={() =>
                        setEditor({
                          type: 'create',
                          afterNodeId: node.id,
                          sortKey: generateSortKeyBetween(
                            node.sortKey,
                            selectedNodes[index + 1]?.sortKey ?? null,
                          ),
                        })
                      }
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
