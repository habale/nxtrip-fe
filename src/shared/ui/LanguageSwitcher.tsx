import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import { Button, ButtonVariant } from './Button';

export function LanguageSwitcher({ variant }: { variant: ButtonVariant }) {
  const { t } = useTranslation('common');

  return (
    <section aria-label={t('language.label')} className="language-switcher">
      <Button variant={variant} onClick={() => void changeLanguage('en')} size="small">
        {t('language.english')}
      </Button>
      <Button variant={variant} onClick={() => void changeLanguage('vi')} size="small">
        {t('language.vietnamese')}
      </Button>
    </section>
  );
}
