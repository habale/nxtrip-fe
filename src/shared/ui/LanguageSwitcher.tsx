import { useTranslation } from 'react-i18next';

import { changeLanguage } from '../i18n';
import { Button } from './Button';

export function LanguageSwitcher() {
  const { t } = useTranslation('common');

  return (
    <section aria-label={t('language.label')} className="language-switcher">
      <Button onClick={() => void changeLanguage('en')} size="small">
        {t('language.english')}
      </Button>
      <Button onClick={() => void changeLanguage('vi')} size="small">
        {t('language.vietnamese')}
      </Button>
    </section>
  );
}
