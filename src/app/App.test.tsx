import { render, screen } from '@testing-library/react';

import { App } from './App';
import { AppProviders } from './providers/AppProviders';

describe('App', () => {
  it('renders the product name inside the application providers', () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'SxTrip' }),
    ).toBeInTheDocument();
  });
});
