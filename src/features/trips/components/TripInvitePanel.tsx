import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import { Button, Icon } from '../../../shared/ui';
import { useAuth } from '../../auth/auth-context';
import {
  useCreateTripInvite,
  useRevokeTripInvite,
  useTripInvite,
} from '../trip-hooks';
import type { TripInvite, TripRepository } from '../trip-repository';

type TripInvitePanelProps = {
  repository?: TripRepository;
  tripId: string;
  tripName: string;
};

export function TripInvitePanel({
  repository,
  tripId,
  tripName,
}: TripInvitePanelProps) {
  const { t, i18n } = useTranslation('common');
  const { user } = useAuth();
  const inviteQuery = useTripInvite(tripId, true, repository);
  const createInvite = useCreateTripInvite(repository);
  const revokeInvite = useRevokeTripInvite(repository);
  const [copied, setCopied] = useState(false);
  const invite = inviteQuery.data;

  function getShareUrl(currentInvite: TripInvite) {
    if (!currentInvite.code) throw new Error('Invitation code is unavailable.');
    const url = new URL(routes.guest, window.location.origin);
    url.hash = new URLSearchParams({ code: currentInvite.code }).toString();
    return url.toString();
  }

  async function copyLink(currentInvite: TripInvite) {
    await navigator.clipboard.writeText(getShareUrl(currentInvite));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink(currentInvite: TripInvite) {
    if (!navigator.share) {
      await copyLink(currentInvite);
      return;
    }
    const metadataName = user?.user_metadata?.full_name;
    const ownerName =
      (typeof metadataName === 'string' && metadataName.trim()) ||
      user?.email ||
      t('home.traveler');

    await navigator.share({
      title: tripName,
      text: t('tripInvite.shareText', { ownerName, trip: tripName }),
      url: getShareUrl(currentInvite),
    });
  }

  const error = inviteQuery.error ?? createInvite.error ?? revokeInvite.error;

  return (
    <section className="trip-invite-panel">
      <div className="trip-invite-panel__section">
        <div className="trip-invite-panel__heading">
          <div>
            <h2>{t('tripInvite.sharedAccessTitle')}</h2>
          </div>
        </div>
        <p className="trip-invite-panel__description">
          {t('tripInvite.sharedAccessDescription')}
        </p>

        {invite ? (
          <div className="trip-invite-panel__invite">
            {invite.code && (
              <div className="trip-invite-panel__code">
                <small>{t('tripInvite.codeOneTimeNotice')}</small>
                <div className="trip-invite-panel__code-value">
                  <strong>{invite.code}</strong>
                  <Button
                    size="small"
                    variant="quiet"
                    onClick={() => void copyLink(invite)}
                  >
                    <Icon size="large" name={copied ? 'check' : 'copy'} />
                  </Button>
                </div>
              </div>
            )}
            {invite.expires_at && (
              <small>
                {t('tripInvite.expires', {
                  date: new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                    dateStyle: 'medium',
                  }).format(new Date(invite.expires_at)),
                })}
              </small>
            )}
            <div className="trip-invite-panel__actions">
              {invite.code ? (
                <Button size="small" onClick={() => void shareLink(invite)}>
                  <Icon name="share" />
                  {t('tripInvite.share')}
                </Button>
              ) : (
                <Button
                  size="small"
                  loading={createInvite.isPending}
                  onClick={() => void createInvite.mutateAsync(tripId)}
                >
                  <Icon name="refresh" />
                  {t('tripInvite.regenerate')}
                </Button>
              )}
              <Button
                size="small"
                disabled={revokeInvite.isPending}
                variant="danger-text"
                onClick={() =>
                  void revokeInvite.mutateAsync({ tripId, inviteId: invite.id })
                }
              >
                {t('tripInvite.revoke')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            loading={createInvite.isPending}
            onClick={() => void createInvite.mutateAsync(tripId)}
          >
            <Icon name="share" />
            {createInvite.isPending
              ? t('tripInvite.creating')
              : t('tripInvite.createShared')}
          </Button>
        )}
      </div>

      {error && (
        <p className="trip-info-error" role="alert">
          {t('tripInvite.error')}
        </p>
      )}
    </section>
  );
}
