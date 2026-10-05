import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  FilePicker,
  Icon,
  ImagePicker,
  Modal,
  TextArea,
  TextInput,
} from '../../../shared/ui';
import type { Trip } from '../../trips/trip-repository';
import type { ItineraryCategory } from '../itinerary-category';
import {
  useAddItineraryNodeAttachment,
  useCreateItineraryNode,
  useUpdateItineraryNode,
} from '../itinerary-hooks';
import {
  initialNodeFormValues,
  localDateTimeToIso,
  validateItineraryNodeForm,
  type ItineraryNodeFormValues,
} from '../itinerary-node-form';
import type { ItineraryRepository } from '../itinerary-repository';
import type { ItineraryNode } from '../itinerary-types';
import type { IconName } from '../../../shared/ui';

const categoryIcon: Record<ItineraryNodeFormValues['category'], IconName> = {
  moving: 'vehicle',
  lodging: 'hotel',
  dining: 'restaurant',
  cafe: 'cafe',
  activity: 'activity',
  sightseeing: 'sightseeing',
  others: 'others',
  misc: 'misc',
  shopping: 'shopping',
};

const stopIcons: Array<{
  category: Exclude<ItineraryCategory, 'moving'>;
  iconKey: string;
  icon: IconName;
}> = [
  { category: 'lodging', iconKey: 'hotel', icon: 'hotel' },
  { category: 'dining', iconKey: 'restaurant', icon: 'restaurant' },
  { category: 'cafe', iconKey: 'cafe', icon: 'cafe' },
  { category: 'activity', iconKey: 'activity', icon: 'activity' },
  { category: 'sightseeing', iconKey: 'location', icon: 'location' },
  { category: 'sightseeing', iconKey: 'sightseeing', icon: 'sightseeing' },
  { category: 'shopping', iconKey: 'shopping', icon: 'shopping' },
  { category: 'others', iconKey: 'others', icon: 'others' },
  { category: 'misc', iconKey: 'misc', icon: 'misc' },
];

const moveIcons: Array<{ iconKey: string; icon: IconName }> = [
  { iconKey: 'car', icon: 'vehicle' },
  { iconKey: 'bus', icon: 'vehicle' },
  { iconKey: 'rail', icon: 'train' },
  { iconKey: 'train', icon: 'train' },
  { iconKey: 'flight', icon: 'flight' },
  { iconKey: 'ferry', icon: 'ferry' },
  { iconKey: 'walk', icon: 'walk' },
];

function selectedIcon(values: ItineraryNodeFormValues): IconName {
  return (
    [...stopIcons, ...moveIcons].find(
      (option) => option.iconKey === values.iconKey,
    )?.icon ?? categoryIcon[values.category]
  );
}

type ItineraryNodeEditorProps = {
  trip: Trip;
  localDate: string;
  sortKey?: string;
  node?: ItineraryNode;
  repository?: ItineraryRepository;
  onClose: () => void;
};

export function ItineraryNodeEditor({
  trip,
  localDate,
  sortKey,
  node,
  repository,
  onClose,
}: ItineraryNodeEditorProps) {
  const { t } = useTranslation('common');
  const createNode = useCreateItineraryNode(repository);
  const updateNode = useUpdateItineraryNode(repository);
  const addAttachment = useAddItineraryNodeAttachment(repository);
  const [values, setValues] = useState(() =>
    initialNodeFormValues(localDate, trip.timezone, node),
  );
  const [persistedNode, setPersistedNode] = useState(node);
  const [submitted, setSubmitted] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(Boolean(node?.googleMapsUrl));
  const [cover, setCover] = useState<File>();
  const [coverPreview, setCoverPreview] = useState<string>();
  const [files, setFiles] = useState<File[]>([]);
  const errors = submitted ? validateItineraryNodeForm(values) : {};
  const mutation = persistedNode ? updateNode : createNode;
  const busy = mutation.isPending || addAttachment.isPending;
  const existingCover = node?.attachments.find(
    (item) =>
      item.role === 'cover' && item.attachment.mime_type?.startsWith('image/'),
  );
  const displayedCoverUrl =
    values.nodeType === 'stop'
      ? (coverPreview ?? existingCover?.thumbnailUrl ?? existingCover?.fileUrl)
      : undefined;

  useEffect(
    () => () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    },
    [coverPreview],
  );

  function update<Field extends keyof ItineraryNodeFormValues>(
    field: Field,
    value: ItineraryNodeFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    mutation.reset();
  }

  const errorText = (field: keyof ItineraryNodeFormValues) => {
    const code = errors[field];
    return code ? t(`itinerary.editor.validation.${code}`) : undefined;
  };

  async function save() {
    setSubmitted(true);
    if (Object.keys(validateItineraryNodeForm(values)).length > 0) return;
    if (!persistedNode && !sortKey) {
      throw new Error(
        'A sort key is required when creating an itinerary node.',
      );
    }

    const notes = values.notes.trim();
    const additionalData = {
      ...(persistedNode?.additionalData ?? {}),
      category: values.nodeType === 'move' ? 'moving' : values.category,
      note: notes || undefined,
      lines: notes
        ? notes
            .split('\n')
            .map((text) => text.trim())
            .filter(Boolean)
            .map((text) => ({ type: 'text', text }))
        : [],
      transport_mode:
        values.nodeType === 'move'
          ? values.transportMode.trim() || undefined
          : undefined,
      operator:
        values.nodeType === 'move'
          ? values.operator.trim() || undefined
          : undefined,
    };
    const shared = {
      tripId: trip.id,
      nodeType: values.nodeType,
      title: values.title,
      localDate: values.localDate,
      startAt: localDateTimeToIso(
        values.localDate,
        values.startTime,
        trip.timezone,
      ),
      endAt: localDateTimeToIso(
        values.localDate,
        values.endTime,
        trip.timezone,
      ),
      timezone: trip.timezone,
      allDay: values.allDay,
      durationMinutes: values.durationMinutes
        ? Number(values.durationMinutes)
        : null,
      sortKey: persistedNode?.sortKey ?? sortKey!,
      googleMapsUrl: values.googleMapsUrl,
      iconKey: values.iconKey,
      additionalData,
    };

    const saved = persistedNode
      ? await updateNode
          .mutateAsync({
            ...shared,
            nodeId: persistedNode.id,
            version: persistedNode.version,
          })
          .catch(() => undefined)
      : await createNode.mutateAsync(shared).catch(() => undefined);
    if (!saved) return;
    setPersistedNode(saved);

    const uploads = [
      ...(cover ? [{ file: cover, role: 'cover' as const }] : []),
      ...files.map((file) => ({ file, role: 'attachment' as const })),
    ];
    try {
      for (const [sortOrder, upload] of uploads.entries()) {
        await addAttachment.mutateAsync({
          tripId: trip.id,
          nodeId: saved.id,
          file: upload.file,
          role: upload.role,
          sortOrder,
        });
        if (upload.role === 'cover') {
          if (coverPreview) URL.revokeObjectURL(coverPreview);
          setCover(undefined);
          setCoverPreview(undefined);
        } else {
          setFiles((current) => current.filter((file) => file !== upload.file));
        }
      }
      onClose();
    } catch {
      // The persisted node remains open so the user can retry failed uploads.
    }
  }

  const activeCategory =
    values.nodeType === 'move' ? 'moving' : values.category;

  return (
    <section
      className={`itinerary-editor itinerary-category--${activeCategory}`}
    >
      <div className="itinerary-editor__topbar">
        <strong>
          {t(node ? 'itinerary.editor.editTitle' : 'itinerary.editor.addTitle')}
        </strong>
      </div>

      {displayedCoverUrl && (
        <div className="itinerary-editor__cover">
          <img alt="" src={displayedCoverUrl} />
          {coverPreview && (
            <Button
              variant="danger-text"
              onClick={() => {
                URL.revokeObjectURL(coverPreview);
                setCover(undefined);
                setCoverPreview(undefined);
              }}
            >
              {t('actions.delete')}
            </Button>
          )}
        </div>
      )}

      <div className="itinerary-editor__card">
        <div className="itinerary-editor__identity">
          <Button
            ariaLabel={t('itinerary.editor.chooseCategory')}
            variant="quiet"
            onClick={() => setIconPickerOpen(true)}
          >
            <span className="itinerary-editor__category-icon">
              <Icon name={selectedIcon(values)} size="large" />
            </span>
          </Button>
          <div className="itinerary-editor__main">
            {!values.allDay && (
              <div className="itinerary-editor__times">
                <TextInput
                  errorText={errorText('startTime')}
                  label={t('itinerary.editor.startTime')}
                  type="time"
                  value={values.startTime}
                  onValueChange={(value) => update('startTime', value)}
                />
              </div>
            )}
            <TextInput
              required
              errorText={errorText('title')}
              label={t('itinerary.editor.title')}
              maxlength={300}
              value={values.title}
              onValueChange={(value) => update('title', value)}
            />
          </div>
        </div>

        <TextArea
          label={t('itinerary.editor.notes')}
          rows={3}
          value={values.notes}
          onValueChange={(value) => update('notes', value)}
        />

        {mapsOpen && (
          <TextInput
            errorText={errorText('googleMapsUrl')}
            label={t('itinerary.editor.mapsUrl')}
            type="url"
            value={values.googleMapsUrl}
            onValueChange={(value) => update('googleMapsUrl', value)}
          />
        )}

        {files.length > 0 && (
          <ul className="itinerary-editor__queued-files">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.size}-${index}`}>
                <Icon name="attachment" />
                <span>{file.name}</span>
                <Button
                  ariaLabel={t('itinerary.editor.removeQueuedFile', {
                    name: file.name,
                  })}
                  size="small"
                  variant="danger-text"
                  onClick={() =>
                    setFiles((current) =>
                      current.filter((_, fileIndex) => fileIndex !== index),
                    )
                  }
                >
                  <Icon name="close" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="itinerary-editor__tools">
          {values.nodeType === 'stop' && (
            <ImagePicker
              disabled={busy}
              label={t(
                displayedCoverUrl
                  ? 'itinerary.editor.replaceCover'
                  : 'itinerary.editor.addCover',
              )}
              onFileSelect={(file) => {
                if (coverPreview) URL.revokeObjectURL(coverPreview);
                setCover(file);
                setCoverPreview(URL.createObjectURL(file));
              }}
            />
          )}
          <FilePicker
            multiple
            disabled={busy}
            label={t('itinerary.editor.addAttachment')}
            onFilesSelect={(selected) =>
              setFiles((current) => [...current, ...selected])
            }
          />
          <Button variant="quiet" onClick={() => setMapsOpen(true)}>
            <Icon name="directions" />
            {t('itinerary.editor.addMapsLink')}
          </Button>
        </div>
      </div>

      <Modal
        open={iconPickerOpen}
        title={t('itinerary.editor.chooseIcon')}
        onDismiss={() => setIconPickerOpen(false)}
      >
        <div className="itinerary-icon-picker">
          <section>
            <h3>{t('itinerary.editor.stopIcons')}</h3>
            <div className="itinerary-icon-picker__grid">
              {stopIcons.map((option) => (
                <button
                  key={option.iconKey}
                  aria-pressed={
                    values.nodeType === 'stop' &&
                    values.iconKey === option.iconKey
                  }
                  className={`itinerary-category--${option.category}`}
                  type="button"
                  onClick={() => {
                    setValues((current) => ({
                      ...current,
                      nodeType: 'stop',
                      category: option.category,
                      iconKey: option.iconKey,
                    }));
                    mutation.reset();
                    setIconPickerOpen(false);
                  }}
                >
                  <Icon name={option.icon} size="large" />
                  <span>{t(`itinerary.categories.${option.category}`)}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3>{t('itinerary.editor.moveIcons')}</h3>
            <div className="itinerary-icon-picker__grid">
              {moveIcons.map((option) => (
                <button
                  key={option.iconKey}
                  aria-pressed={
                    values.nodeType === 'move' &&
                    values.iconKey === option.iconKey
                  }
                  className="itinerary-category--moving"
                  type="button"
                  onClick={() => {
                    if (coverPreview) URL.revokeObjectURL(coverPreview);
                    setCover(undefined);
                    setCoverPreview(undefined);
                    setValues((current) => ({
                      ...current,
                      nodeType: 'move',
                      category: 'moving',
                      iconKey: option.iconKey,
                      transportMode: option.iconKey,
                    }));
                    mutation.reset();
                    setIconPickerOpen(false);
                  }}
                >
                  <Icon name={option.icon} size="large" />
                  <span>{t(`itinerary.moveIcons.${option.iconKey}`)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </Modal>

      {(mutation.error || addAttachment.error) && (
        <p className="itinerary-editor__error" role="alert">
          {t('errors:generic')}
        </p>
      )}
      <div className="itinerary-editor__actions">
        <Button disabled={busy} variant="quiet" onClick={onClose}>
          {t('actions.cancel')}
        </Button>
        <Button loading={busy} onClick={() => void save()}>
          {busy ? t('itinerary.editor.saving') : t('actions.save')}
        </Button>
      </div>
    </section>
  );
}
