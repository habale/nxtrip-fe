import { IonButton } from '@ionic/react';
import { useTranslation } from 'react-i18next';

import { changeLanguage } from '../i18n';

export function LanguageSwitcher() {
  const { t } = useTranslation('common');

  return (
    <section aria-label={t('language.label')} className="language-switcher">
      <IonButton onClick={() => void changeLanguage('en')} size="small">
        {t('language.english')}
      </IonButton>
      <IonButton onClick={() => void changeLanguage('vi')} size="small">
        {t('language.vietnamese')}
      </IonButton>
    </section>
  );
}
