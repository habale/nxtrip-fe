import { useTranslation } from 'react-i18next';

import { SignOutButton } from '../../auth/components/SignOutButton';
import { routes } from '../../../app/routes';
import {
  Avatar,
  Button,
  Icon,
  IconButton,
  Page,
  Segment,
  Skeleton,
} from '../../../shared/ui';
import { AppError } from '../../../shared/api/app-error';
import { useCurrentProfile, useUpdateProfileLanguage } from '../profile-hooks';

import './settings.css';

export function SettingsPage() {
  const { t, i18n } = useTranslation('common');
  const profileQuery = useCurrentProfile();
  const languageMutation = useUpdateProfileLanguage();
  const profile = profileQuery.data;
  const language = profile?.language === 'vi' ? 'vi' : 'en';

  return (
    <Page hideHeader padded={false}>
      <main className="settings-page">
        <header className="settings-header">
          <Button
            ariaLabel={t('actions.back')}
            href={routes.home}
            navigationDirection="back"
            variant="quiet"
          >
            <Icon name="back" size="large" />
          </Button>
          <h1>{t('settings.title')}</h1>
        </header>

        <div className="settings-content">
          <section
            className="settings-profile"
            aria-label={t('settings.profile')}
          >
            {profileQuery.isPending ? (
              <>
                <Skeleton width="7rem" height="7rem" />
                <Skeleton width="12rem" height="2.5rem" />
                <Skeleton width="15rem" height="1.25rem" />
              </>
            ) : profile ? (
              <>
                <div className="settings-avatar">
                  <Avatar
                    name={profile.display_name}
                    src={profile.avatar_url ?? undefined}
                    size="large"
                  />
                </div>
                <h2>{profile.display_name}</h2>
                {profile.email && <p>{profile.email}</p>}
              </>
            ) : (
              <p className="settings-error" role="alert">
                {t(
                  profileQuery.error instanceof AppError
                    ? profileQuery.error.translationKey
                    : 'errors:generic',
                )}
              </p>
            )}
          </section>

          <section className="settings-preferences">
            <div className="settings-section-title">
              <span aria-hidden="true">
                <Icon name="tune" />
              </span>
              <h2>{t('settings.preferences')}</h2>
            </div>

            <div className="settings-field">
              <h3>{t('settings.language')}</h3>
              <Segment
                disabled={!profile || languageMutation.isPending}
                label={t('language.label')}
                value={language}
                options={[
                  { value: 'en', label: t('settings.englishOption') },
                  { value: 'vi', label: t('settings.vietnameseOption') },
                ]}
                onValueChange={(value) => {
                  if (value === 'en' || value === 'vi') {
                    languageMutation.mutate(value);
                  }
                }}
              />
              {languageMutation.error && (
                <p className="settings-error" role="alert">
                  {t('errors:generic')}
                </p>
              )}
            </div>
          </section>

          <div className="settings-logout">
            <SignOutButton />
          </div>

          <span className="sr-only" aria-live="polite">
            {languageMutation.isPending
              ? t('settings.savingLanguage')
              : i18n.language}
          </span>
        </div>
      </main>
    </Page>
  );
}
