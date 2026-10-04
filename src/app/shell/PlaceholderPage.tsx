import {
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

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
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <main className="route-placeholder">
          <h1>{title}</h1>
          <p>{t(descriptionKey)}</p>
          {children}
        </main>
      </IonContent>
    </IonPage>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation('navigation');

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('pages.notFound.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <main className="route-placeholder">
          <h1>{t('pages.notFound.title')}</h1>
          <p>{t('pages.notFound.description')}</p>
          <IonButton routerLink={routes.home} routerDirection="root">
            {t('actions.goHome')}
          </IonButton>
        </main>
      </IonContent>
    </IonPage>
  );
}
