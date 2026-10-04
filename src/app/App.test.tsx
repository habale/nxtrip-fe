import { render, screen } from '@testing-library/react';

import { App } from './App';
import { AppProviders } from './providers/AppProviders';
import { changeLanguage } from '../shared/i18n';

describe('App', () => {
  beforeEach(() => {
    changeLanguage('en');
    window.history.replaceState({}, '', '/');
  });

  it('renders the authenticated root route inside application providers', async () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Trips' }),
    ).toBeInTheDocument();
  });
});
