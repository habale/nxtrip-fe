import { useTranslation } from 'react-i18next';

import { Page, Spinner } from '../../../shared/ui';

export function AuthLoadingPage() {
  const { t } = useTranslation('common');

  return (
    <Page hideHeader title={t('app.name')}>
      <main className="auth-loading">
        <Spinner label={t('auth.restoringSession')} size="large" />
        <p>{t('auth.restoringSession')}</p>
      </main>
    </Page>
  );
}
