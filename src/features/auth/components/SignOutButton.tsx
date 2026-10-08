import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { clearAuthReturnTo } from '../../../app/auth-return';
import { Button, ConfirmDialog } from '../../../shared/ui';
import { useAuth } from '../auth-context';

export function SignOutButton() {
  const { t } = useTranslation('common');
  const { signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    try {
      await signOut();
      clearAuthReturnTo();
    } catch (caughtError) {
      setSubmitting(false);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t('auth.unexpectedError'),
      );
    }
  }

  return (
    <div className="auth-actions">
      <Button
        variant="danger"
        loading={submitting}
        onClick={() => setConfirmOpen(true)}
      >
        {t('auth.signOut')}
      </Button>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        destructive
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('auth.signOut')}
        message={t('auth.signOutDescription')}
        open={confirmOpen}
        title={t('auth.signOutTitle')}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleSignOut()}
      />
    </div>
  );
}
