import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import {
  Button,
  Icon,
  IconButton,
  Page,
  ReorderHandle,
  ReorderList,
  Skeleton,
  TextArea,
  TextInput,
} from '../../../shared/ui';
import { useTripDetail } from '../../trips/trip-hooks';
import { hasTripPermission } from '../../trips/trip-permissions';
import {
  useChecklist,
  useCreateChecklist,
  useUpdateChecklist,
} from '../checklist-hooks';
import type { Checklist, ChecklistDraftItem } from '../checklist-types';

import './checklists.css';

export function ChecklistEditorPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { tripId = '', nodeId = '', checklistId = '' } = useParams();
  const editing = Boolean(checklistId);
  const checklist = useChecklist(tripId, checklistId);
  const trip = useTripDetail(tripId);
  const canEdit = Boolean(
    trip.data && hasTripPermission(trip.data, 'itinerary.manage'),
  );
  const back = () =>
    navigate(
      editing
        ? routes.tripChecklist(tripId, checklistId)
        : `${routes.tripItinerary(tripId)}${nodeId ? `#itinerary-node-${nodeId}` : ''}`,
      { replace: true },
    );

  if (trip.isPending || (editing && checklist.isPending)) {
    return (
      <Page title={t('checklists.title')}>
        <Skeleton height="8rem" />
      </Page>
    );
  }

  if (!canEdit || trip.isError || (editing && checklist.isError)) {
    return (
      <Page
        title={t('checklists.title')}
        headerStart={
          <IconButton icon="back" label={t('actions.back')} onClick={back} />
        }
      >
        <div className="checklist-state" role="alert">
          <h1>{t('states.accessDeniedTitle')}</h1>
          <p>{t('states.accessDeniedDescription')}</p>
        </div>
      </Page>
    );
  }

  return (
    <ChecklistEditorForm
      checklist={checklist.data}
      checklistId={checklistId}
      editing={editing}
      nodeId={nodeId}
      tripId={tripId}
      onBack={back}
      onSaved={(savedId) =>
        navigate(routes.tripChecklist(tripId, savedId), { replace: true })
      }
    />
  );
}

function ChecklistEditorForm({
  checklist,
  checklistId,
  editing,
  nodeId,
  tripId,
  onBack,
  onSaved,
}: {
  checklist?: Checklist;
  checklistId: string;
  editing: boolean;
  nodeId: string;
  tripId: string;
  onBack: () => void;
  onSaved: (checklistId: string) => void;
}) {
  const { t } = useTranslation('common');
  const createChecklist = useCreateChecklist();
  const updateChecklist = useUpdateChecklist();
  const mutation = editing ? updateChecklist : createChecklist;
  const [title, setTitle] = useState(checklist?.resource.title ?? '');
  const [description, setDescription] = useState(
    checklist?.resource.description ?? '',
  );
  const [items, setItems] = useState<ChecklistDraftItem[]>(
    () =>
      checklist?.items.map((item) => ({ id: item.id, label: item.label })) ??
      [],
  );
  const [submitted, setSubmitted] = useState(false);

  function addItem() {
    setItems((current) => [...current, { id: crypto.randomUUID(), label: '' }]);
  }

  async function save() {
    setSubmitted(true);
    if (!title.trim() || items.some((item) => !item.label.trim())) return;

    const input = { tripId, title, description, items };
    const savedId = editing
      ? await updateChecklist
          .mutateAsync({
            ...input,
            checklistId,
            version: checklist?.resource.version ?? 0,
          })
          .catch(() => undefined)
      : await createChecklist
          .mutateAsync({ ...input, nodeId })
          .catch(() => undefined);
    if (savedId) onSaved(savedId);
  }

  return (
    <Page
      padded={false}
      title={t(editing ? 'checklists.editTitle' : 'checklists.createTitle')}
      headerStart={
        <IconButton icon="back" label={t('actions.back')} onClick={onBack} />
      }
    >
      <main className="checklist-editor-page">
        <div className="checklist-editor-page__fields">
          <TextInput
            required
            errorText={
              submitted && !title.trim()
                ? t('checklists.validation.titleRequired')
                : undefined
            }
            label={t('checklists.name')}
            maxlength={300}
            value={title}
            onValueChange={setTitle}
          />
          <TextArea
            label={t('checklists.description')}
            maxlength={2000}
            rows={3}
            value={description}
            onValueChange={setDescription}
          />
        </div>

        <section className="checklist-editor-page__items">
          <div className="checklist-editor-page__heading">
            <h2>{t('checklists.items')}</h2>
            <Button size="small" variant="quiet" onClick={addItem}>
              <Icon name="add" />
              {t('checklists.addItem')}
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="checklist-editor-page__empty">
              {t('checklists.emptyEditor')}
            </p>
          ) : (
            <ReorderList
              className="checklist-editor-list"
              disabled={mutation.isPending}
              onReorder={(from, to) => {
                setItems((current) => {
                  const next = [...current];
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved);
                  return next;
                });
              }}
            >
              {items.map((item, index) => (
                <div className="checklist-editor-item" key={item.id}>
                  <ReorderHandle
                    label={t('checklists.reorderItem', { item: index + 1 })}
                  />
                  <TextInput
                    errorText={
                      submitted && !item.label.trim()
                        ? t('checklists.validation.itemRequired')
                        : undefined
                    }
                    label={t('checklists.itemLabel', { item: index + 1 })}
                    maxlength={300}
                    value={item.label}
                    onValueChange={(label) =>
                      setItems((current) =>
                        current.map((candidate) =>
                          candidate.id === item.id
                            ? { ...candidate, label }
                            : candidate,
                        ),
                      )
                    }
                  />
                  <IconButton
                    icon="trash"
                    label={t('checklists.removeItem', { item: index + 1 })}
                    variant="danger"
                    onClick={() =>
                      setItems((current) =>
                        current.filter((candidate) => candidate.id !== item.id),
                      )
                    }
                  />
                </div>
              ))}
            </ReorderList>
          )}
        </section>

        {mutation.error && <p role="alert">{t('errors:generic')}</p>}
        <footer className="checklist-editor-page__footer">
          <Button
            disabled={mutation.isPending}
            variant="quiet"
            onClick={onBack}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={mutation.isPending}
            onClick={() => void save()}
          >
            {t(editing ? 'actions.save' : 'checklists.create')}
          </Button>
        </footer>
      </main>
    </Page>
  );
}
