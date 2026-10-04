import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Page } from '../../shared/ui';
import { routes } from '../routes';

type PlaceholderPageProps = PropsWithChildren<{
  titleKey: string;
  descriptionKey: string;
}>;

export function PlaceholderPage({
  titleKey,
  descriptionKey,
  children,
}: PlaceholderPageProps) {
  const { t } = useTranslation('navigation');
  const title = t(titleKey);

  return (
    <Page title={title}>
      <main className="route-placeholder">
        <h1>{title}</h1>
        <p>{t(descriptionKey)}</p>
        {children}
      </main>
    </Page>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation('navigation');

  return (
    <Page title={t('pages.notFound.title')}>
      <main className="route-placeholder">
        <h1>{t('pages.notFound.title')}</h1>
        <p>{t('pages.notFound.description')}</p>
        <Button href={routes.home} navigationDirection="root">
          {t('actions.goHome')}
        </Button>
      </main>
    </Page>
  );
}
