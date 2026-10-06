import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getAuthReturnTo } from '../../../app/auth-return';
import { Button, Icon, LanguageSwitcher, Page } from '../../../shared/ui';
import { useAuth } from '../auth-context';

export function LoginPage() {
  const { t } = useTranslation('common');
  const { error, signInAsGuest, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const returnTo = getAuthReturnTo() ?? undefined;
  const guestInvite = (() => {
    if (!returnTo?.startsWith('/')) return false;
    const query = returnTo.split('?')[1] ?? '';
    return new URLSearchParams(query).get('guest') === '1';
  })();

  async function handleGoogleSignIn() {
    setSubmitting(true);
    try {
      await signInWithGoogle(returnTo);
    } catch {
      setSubmitting(false);
    }
  }

  async function handleGuestSignIn() {
    setSubmitting(true);
    try {
      await signInAsGuest();
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <Page hideHeader padded={false}>
      <main className="auth-page">
        <div className="auth-language">
          <LanguageSwitcher />
        </div>

        <div className="auth-layout">
          <div className="auth-brand" aria-label="NxTrip">
            NxTrip
          </div>

          <img
            alt=""
            className="auth-illustration"
            src="/assets/login-travelers.png"
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
                disabled={!guestInvite || submitting}
                variant="quiet"
                onClick={() => void handleGuestSignIn()}
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
      </main>
    </Page>
  );
}
