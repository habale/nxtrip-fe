import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import {
  Button,
  Checkbox,
  Icon,
  IconButton,
  Page,
  ProgressBar,
  Skeleton,
} from '../../../shared/ui';
import { useTripDetail } from '../../trips/trip-hooks';
import { hasTripPermission } from '../../trips/trip-permissions';
import { useChecklist, useSetChecklistItemChecked } from '../checklist-hooks';

import './checklists.css';

export function ChecklistPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { tripId = '', checklistId = '' } = useParams();
  const checklist = useChecklist(tripId, checklistId);
  const trip = useTripDetail(tripId);
  const setChecked = useSetChecklistItemChecked();
  const canEdit = Boolean(
    trip.data && hasTripPermission(trip.data, 'itinerary.manage'),
  );
  const canCheck = trip.data?.role === 'owner' || trip.data?.role === 'member';
  const items = checklist.data?.items ?? [];
  const completed = items.filter((item) => item.is_checked).length;

  return (
    <Page
      padded={false}
      title={checklist.data?.resource.title ?? t('checklists.title')}
      headerStart={
        <IconButton
          icon="back"
          label={t('actions.back')}
          onClick={() => navigate(routes.tripItinerary(tripId))}
        />
      }
      headerEnd={
        canEdit ? (
          <Button
            size="small"
            variant="quiet"
            href={routes.editTripChecklist(tripId, checklistId)}
          >
            <Icon name="edit" />
            {t('actions.edit')}
          </Button>
        ) : undefined
      }
    >
      {checklist.isPending || trip.isPending ? (
        <main className="checklist-page">
          <Skeleton height="8rem" />
        </main>
      ) : checklist.isError || trip.isError || !checklist.data ? (
        <main className="checklist-state" role="alert">
          <h1>{t('checklists.notFoundTitle')}</h1>
          <p>{t('checklists.notFoundDescription')}</p>
        </main>
      ) : (
        <main className="checklist-page">
          <header className="checklist-page__header">
            <div className="checklist-page__title">
              <span className="checklist-page__icon">
                <Icon name="checklist" size="large" />
              </span>
              <div>
                <h1>{checklist.data.resource.title}</h1>
                {checklist.data.resource.description && (
                  <p>{checklist.data.resource.description}</p>
                )}
              </div>
            </div>
            <div className="checklist-page__progress">
              <span>
                {t('checklists.progress', {
                  completed,
                  total: items.length,
                })}
              </span>
              <ProgressBar
                label={t('checklists.progress', {
                  completed,
                  total: items.length,
                })}
                value={items.length ? completed / items.length : 0}
              />
            </div>
          </header>

          {items.length === 0 ? (
            <p className="checklist-page__empty">{t('checklists.empty')}</p>
          ) : (
            <ul className="checklist-items">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={item.is_checked ? 'is-checked' : ''}
                >
                  <Checkbox
                    ariaLabel={item.label}
                    checked={item.is_checked}
                    disabled={!canCheck || setChecked.isPending}
                    onCheckedChange={(checked) =>
                      setChecked.mutate({
                        tripId,
                        checklistId,
                        itemId: item.id,
                        checked,
                      })
                    }
                  />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          )}
          {setChecked.error && <p role="alert">{t('errors:generic')}</p>}
        </main>
      )}
    </Page>
  );
}
