import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import {
  Checkbox,
  Icon,
  IconButton,
  Page,
  ProgressBar,
  Skeleton,
} from '../../../shared/ui';
import { getGuestRepository } from '../../guest/guest-repository';
import { readGuestCode } from '../../guest/guest-session';

import './checklists.css';

export function GuestChecklistPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { checklistId = '' } = useParams();
  const code = readGuestCode();
  const checklist = useQuery({
    queryKey: ['guest', 'checklist', checklistId],
    enabled: Boolean(code && checklistId),
    retry: false,
    queryFn: () => getGuestRepository().getChecklist(code, checklistId),
  });
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
          onClick={() => navigate(routes.guest)}
        />
      }
    >
      {checklist.isPending ? (
        <main className="checklist-page">
          <Skeleton height="8rem" />
        </main>
      ) : checklist.isError || !checklist.data ? (
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
          <ul className="checklist-items">
            {items.map((item) => (
              <li key={item.id} className={item.is_checked ? 'is-checked' : ''}>
                <Checkbox
                  ariaLabel={item.label}
                  checked={item.is_checked}
                  disabled
                />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </main>
      )}
    </Page>
  );
}
