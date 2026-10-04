import { IonApp } from '@ionic/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  });

  it.each([
    ['/home', 'Trips'],
    ['/bookmarks', 'Bookmarks'],
    ['/trips/trip-123', 'Trip'],
    ['/trips/trip-123/info', 'Trip info'],
    ['/trips/trip-123/itinerary', 'Itinerary'],
    ['/trips/trip-123/ledger', 'Ledger'],
    ['/trips/trip-123/attachments', 'Attachments'],
    ['/settings', 'Settings'],
  ])('renders protected route %s', async (path, title) => {
    renderRoute(path, true);

    expect(
      await screen.findByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', async () => {
    renderRoute('/settings', false);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sign in' }),
    ).toBeInTheDocument();
  });

  it('redirects authenticated users away from login', async () => {
    renderRoute('/login', true);

    await waitFor(() => expect(window.location.pathname).toBe('/home'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Trips' }),
    ).toBeInTheDocument();
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

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
  });

  it('builds encoded trip URLs', () => {
    expect(routes.tripInfo('trip with spaces')).toBe(
      '/trips/trip%20with%20spaces/info',
    );
  });
});
