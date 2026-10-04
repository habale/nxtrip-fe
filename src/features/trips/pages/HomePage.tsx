import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import { useAuth } from '../../auth/auth-context';
import { useCurrentProfile } from '../../profile/profile-hooks';
import { Avatar, Button, Page } from '../../../shared/ui';

import './home.css';

export function HomePage() {
  const { t } = useTranslation(['navigation', 'common']);
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const displayName =
    profile?.display_name ??
    (typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : (user?.email ?? 'Traveler'));
  const avatarUrl =
    profile?.avatar_url ??
    (typeof user?.user_metadata?.avatar_url === 'string'
      ? user.user_metadata.avatar_url
      : undefined);

  return (
    <Page
      title={t('navigation:pages.home.title')}
      headerEnd={
        <div className="home-profile-action">
          <Button
            ariaLabel={t('common:settings.openProfile')}
            href={routes.settings}
            navigationDirection="forward"
            variant="quiet"
          >
            <Avatar name={displayName} src={avatarUrl} size="small" />
          </Button>
        </div>
      }
    >
      <main className="route-placeholder">
        <h1>{t('navigation:pages.home.title')}</h1>
        <p>{t('navigation:pages.home.description')}</p>
      </main>
    </Page>
  );
}
