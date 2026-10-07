import { IonApp } from '@ionic/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';

import { AppProviders } from './providers/AppProviders';
import { AppRouter } from './router';
import { routes } from './routes';
import { changeLanguage, LANGUAGE_STORAGE_KEY } from '../shared/i18n';

function renderRoute(path: string, isAuthenticated: boolean) {
  window.history.replaceState({}, '', path);

  return render(
    <AppProviders>
      <IonApp>
        <AppRouter isAuthenticated={isAuthenticated} />
      </IonApp>
    </AppProviders>,
  );
}

describe('application routes', () => {
  beforeEach(() => {
    changeLanguage('en');
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    sessionStorage.clear();
  });

  it.each([
    ['/home', 'Hi, Traveler!'],
    ['/trips/add', 'Join or Add Trip'],
    ['/trips/new', 'Create a trip'],
    ['/bookmarks', 'Bookmarks'],
    ['/settings', 'Profile & Settings'],
  ])('renders protected route %s', async (path, title) => {
    renderRoute(path, true);

    expect(
      await screen.findByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', async () => {
    renderRoute('/settings', false);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(sessionStorage.getItem('nxtrip.auth.returnTo')).toBe('/settings');
    expect(await screen.findByLabelText('NxTrip')).toBeInTheDocument();
    expect(screen.getByText('Access as Guest')).toBeInTheDocument();
  });

  it('preserves a guest invitation and enables guest access', async () => {
    renderRoute('/trips/add?code=VIEW123&guest=1', false);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(sessionStorage.getItem('nxtrip.auth.returnTo')).toBe(
      '/trips/add?code=VIEW123&guest=1',
    );
    expect(
      (await screen.findByText('Access as Guest')).closest('ion-button'),
    ).not.toHaveAttribute('disabled');
  });

  it('redirects authenticated users away from login', async () => {
    renderRoute('/login', true);

    await waitFor(() => expect(window.location.pathname).toBe('/home'));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Hi, Traveler!',
      }),
    ).toBeInTheDocument();
  });

  it('returns an authenticated guest to the preserved invitation', async () => {
    sessionStorage.setItem(
      'nxtrip.auth.returnTo',
      '/trips/add?code=VIEW123&guest=1',
    );
    renderRoute('/login', true);

    await waitFor(() => expect(window.location.pathname).toBe('/trips/add'));
    expect(window.location.search).toBe('?code=VIEW123&guest=1');
  });

  it('keeps the guest invitation destination across repeated renders', async () => {
    sessionStorage.setItem(
      'nxtrip.auth.returnTo',
      '/trips/add?code=VIEW123&guest=1',
    );
    window.history.replaceState({}, '', '/login');

    render(
      <StrictMode>
        <AppProviders>
          <IonApp>
            <AppRouter isAuthenticated />
          </IonApp>
        </AppProviders>
      </StrictMode>,
    );

    await waitFor(() => expect(window.location.pathname).toBe('/trips/add'));
    expect(window.location.search).toBe('?code=VIEW123&guest=1');
  });

  it('links the home avatar to profile and settings', async () => {
    renderRoute('/home', true);

    const profileAction = await screen.findByLabelText(
      'Open profile and settings',
    );
    expect(profileAction).toHaveAttribute('router-link', '/settings');
  });

  it('renders a localized not-found page', async () => {
    renderRoute('/missing-page', false);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Page not found',
      }),
    ).toBeInTheDocument();
  });

  it('renders the shared UI showcase', async () => {
    renderRoute(routes.uiKit, false);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Shared components',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Button variants')).toBeInTheDocument();
    expect(screen.getByText('Material Symbols')).toBeInTheDocument();
  });

  it('keeps the language switcher available on the public shell', async () => {
    const user = userEvent.setup();
    renderRoute('/login', false);

    await user.click(await screen.findByText('Tiếng Việt'));

    expect(screen.getByText('Tiếp tục với Google')).toBeInTheDocument();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
  });

  it('builds encoded trip URLs', () => {
    expect(routes.tripInfo('trip with spaces')).toBe(
      '/trips/trip%20with%20spaces/info',
    );
  });
});
