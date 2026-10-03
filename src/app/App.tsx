import { IonApp, IonButton, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';

import { changeLanguage } from '../shared/i18n';

export function App() {
  const { t } = useTranslation('common');

  return (
    <IonApp>
      <IonContent className="app-content">
        <main className="app-home">
          <h1>{t('app.name')}</h1>
          <section
            aria-label={t('language.label')}
            className="language-switcher"
          >
            <IonButton onClick={() => void changeLanguage('en')} size="small">
              {t('language.english')}
            </IonButton>
            <IonButton onClick={() => void changeLanguage('vi')} size="small">
              {t('language.vietnamese')}
            </IonButton>
          </section>
        </main>
      </IonContent>
    </IonApp>
  );
}
