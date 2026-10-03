import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App';
import { AppProviders } from './providers/AppProviders';
import { changeLanguage, LANGUAGE_STORAGE_KEY } from '../shared/i18n';

describe('App', () => {
  beforeEach(() => {
    changeLanguage('en');
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  it('renders the localized product name inside the application providers', () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'SxTrip' }),
    ).toBeInTheDocument();
  });

  it('switches to Vietnamese and persists the preference', async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    await user.click(screen.getByText('Tiếng Việt'));

    expect(
      screen.getByRole('region', { name: 'Ngôn ngữ giao diện' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
  });
});
