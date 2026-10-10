import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  ConfirmDialog,
  ContextMenu,
  Icon,
  Skeleton,
  TextArea,
  TextInput,
  type IconName,
} from '../../../shared/ui';
import type { Trip } from '../../trips/trip-repository';
import {
  useCreateBookmark,
  useRemoveBookmark,
  useTripBookmarks,
  useUpdateBookmark,
} from '../bookmark-hooks';
import type { Bookmark, BookmarkRepository } from '../bookmark-repository';

import './bookmarks.css';

const categories: Array<{ category: string; iconKey: string; icon: IconName }> =
  [
    { category: 'misc', iconKey: 'misc', icon: 'misc' },
    { category: 'location', iconKey: 'location', icon: 'location' },
    { category: 'lodging', iconKey: 'hotel', icon: 'hotel' },
    { category: 'dining', iconKey: 'restaurant', icon: 'restaurant' },
    { category: 'cafe', iconKey: 'cafe', icon: 'cafe' },
    { category: 'activity', iconKey: 'activity', icon: 'activity' },
    { category: 'sightseeing', iconKey: 'sightseeing', icon: 'sightseeing' },
    { category: 'shopping', iconKey: 'shopping', icon: 'shopping' },
  ];

function bookmarkMetadata(bookmark: Bookmark) {
  const data = bookmark.source_data;
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    return categories[0];
  }
  const iconKey = typeof data.icon_key === 'string' ? data.icon_key : 'misc';
  return categories.find((item) => item.iconKey === iconKey) ?? categories[0];
}

type Props = {
  trip: Trip;
  canManage?: boolean;
  repository?: BookmarkRepository;
};

export function BookmarksPanel({ trip, canManage = false, repository }: Props) {
  const { t } = useTranslation('common');
  const bookmarks = useTripBookmarks(trip.id, repository);
  const createBookmark = useCreateBookmark(repository);
  const updateBookmark = useUpdateBookmark(repository);
  const removeBookmark = useRemoveBookmark(repository);
  const [editor, setEditor] = useState<'new' | Bookmark | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Bookmark | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [submitted, setSubmitted] = useState(false);
  const isPending = createBookmark.isPending || updateBookmark.isPending;

  const resetEditor = () => {
    setEditor(null);
    setTitle('');
    setNotes('');
    setSourceUrl('');
    setCategory(categories[0]);
    setSubmitted(false);
    createBookmark.reset();
    updateBookmark.reset();
  };

  const openCreate = () => {
    resetEditor();
    setEditor('new');
  };

  const openEdit = (bookmark: Bookmark) => {
    setEditor(bookmark);
    setTitle(bookmark.title);
    setNotes(bookmark.notes ?? '');
    setSourceUrl(bookmark.source_url ?? '');
    setCategory(bookmarkMetadata(bookmark));
    setSubmitted(false);
    createBookmark.reset();
    updateBookmark.reset();
  };

  const save = async () => {
    setSubmitted(true);
    if (!title.trim()) return;
    if (sourceUrl.trim()) {
      try {
        const url = new URL(sourceUrl);
        if (!['http:', 'https:'].includes(url.protocol)) return;
      } catch {
        return;
      }
    }

    const values = {
      tripId: trip.id,
      title,
      notes,
      sourceUrl,
      category: category.category,
      iconKey: category.iconKey,
    };
    const result =
      editor === 'new'
        ? await createBookmark.mutateAsync(values).catch(() => undefined)
        : editor
          ? await updateBookmark
              .mutateAsync({
                ...values,
                bookmarkId: editor.id,
                version: editor.version,
              })
              .catch(() => undefined)
          : undefined;
    if (result) resetEditor();
  };

  const remove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    await removeBookmark
      .mutateAsync({
        tripId: trip.id,
        bookmarkId: target.id,
        version: target.version,
      })
      .catch(() => undefined);
  };

  return (
    <section className="bookmarks-panel">
      {canManage && !editor && (
        <Button variant="quiet" onClick={openCreate}>
          {t('bookmarks.add')}
        </Button>
      )}

      {canManage && editor && (
        <section
          className={`bookmark-editor itinerary-category--${category.category}`}
        >
          <h2>
            {t(editor === 'new' ? 'bookmarks.addTitle' : 'bookmarks.editTitle')}
          </h2>
          <div className="bookmark-editor__card">
            <div
              className="bookmark-editor__icons"
              aria-label={t('bookmarks.chooseIcon')}
            >
              {categories.map((option) => (
                <button
                  key={option.iconKey}
                  aria-pressed={option.iconKey === category.iconKey}
                  className={`itinerary-category--${option.category}`}
                  disabled={isPending}
                  type="button"
                  onClick={() => setCategory(option)}
                >
                  <Icon name={option.icon} />
                </button>
              ))}
            </div>
            <TextInput
              required
              disabled={isPending}
              errorText={
                submitted && !title.trim()
                  ? t('bookmarks.titleRequired')
                  : undefined
              }
              label={t('bookmarks.title')}
              maxlength={300}
              value={title}
              onValueChange={setTitle}
            />
            <TextArea
              disabled={isPending}
              label={t('bookmarks.notes')}
              rows={3}
              value={notes}
              onValueChange={setNotes}
            />
            <TextInput
              disabled={isPending}
              label={t('bookmarks.mapsUrl')}
              type="url"
              value={sourceUrl}
              onValueChange={setSourceUrl}
            />
          </div>
          {(createBookmark.error || updateBookmark.error) && (
            <p role="alert">{t('errors:generic')}</p>
          )}
          <div className="bookmark-editor__actions">
            <Button disabled={isPending} variant="quiet" onClick={resetEditor}>
              {t('actions.cancel')}
            </Button>
            <Button
              loading={isPending}
              disabled={isPending}
              onClick={() => void save()}
            >
              {t('actions.save')}
            </Button>
          </div>
        </section>
      )}

      {removeBookmark.error && <p role="alert">{t('errors:generic')}</p>}

      {bookmarks.isPending ? (
        <div className="bookmarks-list">
          <Skeleton height="8rem" />
          <Skeleton height="8rem" />
        </div>
      ) : bookmarks.error ? (
        <p role="alert">{t('errors:generic')}</p>
      ) : bookmarks.data?.length ? (
        <div className="bookmarks-list">
          {bookmarks.data.map((bookmark) => {
            const metadata = bookmarkMetadata(bookmark);
            return (
              <article
                key={bookmark.id}
                className={`bookmark-card itinerary-category--${metadata.category}`}
              >
                <span className="bookmark-card__icon">
                  <Icon name={metadata.icon} size="large" />
                </span>
                <div className="bookmark-card__content">
                  <h2>{bookmark.title}</h2>
                  {bookmark.notes && <p>{bookmark.notes}</p>}
                  {bookmark.source_url && (
                    <a
                      href={bookmark.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon name="directions" /> {t('bookmarks.openLink')}
                    </a>
                  )}
                </div>
                {canManage && (
                  <ContextMenu
                    label={t('bookmarks.actionsFor', {
                      title: bookmark.title,
                    })}
                    items={[
                      {
                        label: t('actions.edit'),
                        icon: 'edit',
                        onSelect: () => openEdit(bookmark),
                      },
                      {
                        label: t('actions.remove'),
                        icon: 'trash',
                        destructive: true,
                        onSelect: () => setRemoveTarget(bookmark),
                      },
                    ]}
                  />
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bookmarks-empty">
          <Icon name="bookmark" size="large" />
          <p>{t('tripDetail.placeholders.bookmarks')}</p>
        </div>
      )}

      <ConfirmDialog
        destructive
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('actions.remove')}
        message={t('bookmarks.removeDescription', {
          title: removeTarget?.title ?? '',
        })}
        open={Boolean(removeTarget)}
        title={t('bookmarks.removeTitle')}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void remove()}
      />
    </section>
  );
}
