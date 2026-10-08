import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getAuthReturnTo } from '../../../app/auth-return';
import { routes } from '../../../app/routes';
import { Button, Icon, LanguageSwitcher, Page } from '../../../shared/ui';
import { useAuth } from '../auth-context';

export function LoginPage() {
  const { t } = useTranslation('common');
  const { error, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const returnTo = getAuthReturnTo() ?? undefined;

  async function handleGoogleSignIn() {
    setSubmitting(true);
    try {
      await signInWithGoogle(returnTo);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <Page hideHeader padded={false}>
      <main className="auth-page">
        <div className="auth-language">
          <LanguageSwitcher variant="primary" />
        </div>

        <div className="auth-layout">
          <div className="auth-brand" aria-label="NxTrip">
            NxTrip
          </div>

          <img
            alt=""
            className="auth-illustration"
            src="/assets/login-graphic.webp"
          />

          <div className="auth-login-actions">
            <div className="auth-google-button">
              <Button
                ariaLabel={t('auth.continueWithGoogle')}
                block
                loading={submitting}
                onClick={() => void handleGoogleSignIn()}
              >
                <span className="auth-google-content">
                  <img
                    alt=""
                    className="auth-google-mark"
                    src="/assets/google-logo.svg"
                  />
                  <span>{t('auth.continueWithGoogle')}</span>
                  <span className="auth-arrow" aria-hidden="true">
                    <Icon name="forward" />
                  </span>
                </span>
              </Button>
            </div>

            <div className="auth-guest-button">
              <Button
                ariaLabel={t('auth.accessAsGuest')}
                block
                href={routes.guest}
                navigationDirection="forward"
                variant="quiet"
              >
                {t('auth.accessAsGuest')}
              </Button>
            </div>

            {error && (
              <p className="auth-error" role="alert">
                {error.message}
              </p>
            )}
          </div>
        </div>

        <p className="auth-version">{t('auth.betaVersion')}</p>
      </main>
    </Page>
  );
}
