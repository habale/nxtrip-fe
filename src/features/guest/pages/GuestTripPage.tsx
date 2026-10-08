import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { routes } from '../../../app/routes';
import {
  Button,
  Icon,
  LanguageSwitcher,
  Page,
  Skeleton,
  TextInput,
} from '../../../shared/ui';
import { useAuth } from '../../auth/auth-context';
import { BookmarksPanel } from '../../bookmarks/components/BookmarksPanel';
import { ItineraryPanel } from '../../itinerary/components/ItineraryPanel';
import { LedgerPanel } from '../../ledger/components/LedgerPanel';
import { TripInfoPanel } from '../../trips/components/TripInfoPanel';
import { useJoinTrip } from '../../trips/trip-hooks';
import type { Trip, TripDetail } from '../../trips/trip-repository';
import { guestKeys, useGuestTrip } from '../guest-hooks';
import {
  createGuestBookmarkRepository,
  createGuestItineraryRepository,
  createGuestLedgerRepository,
} from '../guest-repository';
import {
  clearGuestCode,
  consumeGuestCodeFromUrl,
  isValidGuestCode,
  normalizeGuestCode,
  saveGuestCode,
} from '../guest-session';

import './guest.css';
import '../../trips/pages/trip-detail.css';

type GuestSection = 'info' | 'itinerary' | 'ledger' | 'bookmarks';

export function GuestTripPage() {
  const { t, i18n } = useTranslation('common');
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const joinTrip = useJoinTrip();
  const joinAttemptRef = useRef('');
  const [code, setCode] = useState(() => consumeGuestCodeFromUrl());
  const [draftCode, setDraftCode] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [section, setSection] = useState<GuestSection>('info');
  const tripQuery = useGuestTrip(code);
  const guestTrip = tripQuery.data;
  const locale = i18n.resolvedLanguage === 'vi' ? 'vi-VN' : 'en-US';
  const trip = useMemo<Trip | null>(
    () =>
      guestTrip
        ? {
            ...guestTrip,
            treasurer_member_id: null,
            created_by: null,
            created_at: '',
            updated_at: '',
            version: 1,
            deleted_at: null,
          }
        : null,
    [guestTrip],
  );
  const detail = useMemo<TripDetail | null>(
    () =>
      trip
        ? {
            trip,
            role: 'viewer',
            coverImageUrl: guestTrip?.coverImageUrl ?? null,
            coverThumbnailUrl: guestTrip?.coverThumbnailUrl ?? null,
          }
        : null,
    [guestTrip, trip],
  );
  const itineraryRepository = useMemo(
    () => createGuestItineraryRepository(code),
    [code],
  );
  const bookmarkRepository = useMemo(
    () => createGuestBookmarkRepository(code),
    [code],
  );
  const ledgerRepository = useMemo(
    () => createGuestLedgerRepository(code),
    [code],
  );

  useEffect(() => {
    if (!user || !code) return;

    const attemptKey = `${user.id}:${code}`;
    if (joinAttemptRef.current === attemptKey) return;
    joinAttemptRef.current = attemptKey;

    void joinTrip
      .mutateAsync(code)
      .then((tripId) => {
        clearGuestCode();
        navigate(routes.tripInfo(tripId), { replace: true });
      })
      .catch(() => undefined);
  }, [code, joinTrip, navigate, user]);

  function openTrip() {
    setSubmitted(true);
    if (!saveGuestCode(draftCode)) return;
    void queryClient.removeQueries({ queryKey: guestKeys.all });
    void queryClient.removeQueries({ queryKey: ['itinerary'] });
    void queryClient.removeQueries({ queryKey: ['bookmarks'] });
    void queryClient.removeQueries({ queryKey: ['ledger'] });
    setCode(normalizeGuestCode(draftCode));
    setDraftCode('');
    setSubmitted(false);
  }

  function enter(event: FormEvent) {
    event.preventDefault();
    openTrip();
  }

  async function pasteCode() {
    try {
      setDraftCode(normalizeGuestCode(await navigator.clipboard.readText()));
      setSubmitted(false);
    } catch {
      // Clipboard access can be denied; manual entry remains available.
    }
  }

  function exitGuestView() {
    clearGuestCode();
    void queryClient.removeQueries({ queryKey: guestKeys.all });
    void queryClient.removeQueries({ queryKey: ['itinerary'] });
    void queryClient.removeQueries({ queryKey: ['bookmarks'] });
    void queryClient.removeQueries({ queryKey: ['ledger'] });
    setCode('');
    setSection('info');
  }

  if (!code)
    return (
      <Page hideHeader padded={false}>
        <main className="guest-entry">
          <div className="guest-entry__topbar">
            <div className="guest-wordmark">NxTrip</div>
            <div className="guest-language">
              <LanguageSwitcher variant="quiet" />
            </div>
          </div>
          <div className="guest-entry__card">
            <h1>{t('guest.enterTitle')}</h1>
            <div className="guest-entry__description">
              <p>{t('guest.enterDescription')}</p>
              <Button
                size="small"
                variant="quiet"
                onClick={() => void pasteCode()}
              >
                <Icon name="paste" />
                {t('guest.pasteCode')}
              </Button>
            </div>
            <form onSubmit={enter}>
              <TextInput
                autocomplete="off"
                errorText={
                  submitted && !isValidGuestCode(draftCode)
                    ? t('guest.invalidCode')
                    : undefined
                }
                label={t('guest.codeLabel')}
                maxlength={32}
                value={draftCode}
                onValueChange={(value) => {
                  setDraftCode(value);
                  setSubmitted(false);
                }}
              />
              <Button block onClick={openTrip}>
                {t('guest.openTrip')}
              </Button>
              <Button block href={routes.login} variant="quiet">
                {t('guest.backToLogin')}
              </Button>
            </form>
          </div>
        </main>
      </Page>
    );

  if (tripQuery.isPending)
    return (
      <Page hideHeader padded={false}>
        <main className="guest-state" aria-label={t('states.loading')}>
          <Skeleton width="60%" height="3rem" />
          <Skeleton width="100%" height="10rem" />
        </main>
      </Page>
    );

  if (!trip || !detail)
    return (
      <Page hideHeader padded={false}>
        <main className="guest-state guest-state--message">
          <Icon name="location" size="large" />
          <h1>{t('guest.unavailableTitle')}</h1>
          <p>{t('guest.unavailableDescription')}</p>
          <Button onClick={exitGuestView}>{t('guest.enterAnotherCode')}</Button>
          <Button href={routes.login} variant="quiet">
            {t('guest.backToLogin')}
          </Button>
        </main>
      </Page>
    );

  return (
    <Page
      padded={false}
      secondaryToolbarClassName="trip-detail-nav-toolbar"
      headerContent={
        <div className="guest-header">
          <span className="guest-wordmark">NxTrip</span>
          <Button size="small" variant="quiet" onClick={exitGuestView}>
            {t('guest.exit')}
          </Button>
        </div>
      }
      secondaryHeaderContent={
        <nav className="guest-tabs" aria-label={t('guest.navigation')}>
          {(['info', 'itinerary', 'ledger', 'bookmarks'] as const).map(
            (item) => (
              <button
                key={item}
                aria-label={
                  item === 'bookmarks'
                    ? t('tripDetail.sections.bookmarks')
                    : undefined
                }
                aria-current={section === item ? 'page' : undefined}
                className={section === item ? 'is-selected' : undefined}
                title={
                  item === 'bookmarks'
                    ? t('tripDetail.sections.bookmarks')
                    : undefined
                }
                type="button"
                onClick={() => setSection(item)}
              >
                {item === 'bookmarks' ? (
                  <Icon name="bookmark" />
                ) : (
                  t(`tripDetail.sections.${item}`)
                )}
              </button>
            ),
          )}
        </nav>
      }
    >
      <div className="trip-detail-page">
        <div className="trip-detail-layout">
          <main className="trip-detail-content">
            {section === 'info' && !user && (
              <section className="guest-member-access">
                <div>
                  <strong>{t('guest.memberAccessTitle')}</strong>
                  <p>{t('guest.memberAccessDescription')}</p>
                </div>
                <Button onClick={() => void signInWithGoogle(routes.guest)}>
                  {t('guest.signInToJoin')}
                </Button>
              </section>
            )}

            {joinTrip.isError && (
              <p className="guest-join-error" role="alert">
                {t('guest.memberMatchError')}
              </p>
            )}
            {section === 'info' ? (
              <TripInfoPanel detail={detail} locale={locale} />
            ) : section === 'itinerary' ? (
              <ItineraryPanel
                canEdit={false}
                repository={itineraryRepository}
                trip={trip}
              />
            ) : section === 'ledger' ? (
              <LedgerPanel
                canEdit={false}
                repository={ledgerRepository}
                trip={trip}
                locale={locale}
                viewerRole="viewer"
              />
            ) : (
              <BookmarksPanel
                canAdd={false}
                repository={bookmarkRepository}
                trip={trip}
              />
            )}
          </main>
        </div>
      </div>
    </Page>
  );
}
