import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import { Button, Icon } from '../../../shared/ui';
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
  const inviteQuery = useTripInvite(tripId, true, repository);
  const createInvite = useCreateTripInvite(repository);
  const revokeInvite = useRevokeTripInvite(repository);
  const [copied, setCopied] = useState(false);
  const invite = inviteQuery.data;

  function getShareUrl(currentInvite: TripInvite) {
    const url = new URL(routes.addTrip, window.location.origin);
    url.searchParams.set('code', currentInvite.code);
    url.searchParams.set('guest', '1');
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
    await navigator.share({
      title: tripName,
      text: t('tripInvite.shareText', { trip: tripName }),
      url: getShareUrl(currentInvite),
    });
  }

  const error = inviteQuery.error ?? createInvite.error ?? revokeInvite.error;

  return (
    <section className="trip-invite-panel">
      <div className="trip-invite-panel__heading">
        <div>
          <p>{t('tripInvite.ownerOnly')}</p>
          <h2>{t('tripInvite.title')}</h2>
        </div>
      </div>
      <p className="trip-invite-panel__description">
        {t('tripInvite.sharedDescription')}
      </p>

      {invite ? (
        <div className="trip-invite-panel__invite">
          <div className="trip-invite-panel__code">
            <div>
              <span>{t('tripInvite.code')}</span>
              <strong>{invite.code}</strong>
            </div>
            <Button
              size="small"
              variant="quiet"
              onClick={() => void copyLink(invite)}
            >
              <Icon size="large" name={copied ? 'check' : 'copy'} />
            </Button>
          </div>
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
            <Button onClick={() => void shareLink(invite)}>
              <Icon name="share" />
              {t('tripInvite.share')}
            </Button>
            <Button
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

      {error && (
        <p className="trip-info-error" role="alert">
          {t('tripInvite.error')}
        </p>
      )}
    </section>
  );
}
