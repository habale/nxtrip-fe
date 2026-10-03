import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';

import { AppProviders } from './AppProviders';
import { queryClient } from './queryClient';

function QueryClientProbe() {
  const activeQueryClient = useQueryClient();

  return (
    <span>
      {activeQueryClient === queryClient ? 'provider-ready' : 'wrong-client'}
    </span>
  );
}

describe('AppProviders', () => {
  it('provides the centralized query client', () => {
    render(
      <AppProviders>
        <QueryClientProbe />
      </AppProviders>,
    );

    expect(screen.getByText('provider-ready')).toBeInTheDocument();
  });
});
