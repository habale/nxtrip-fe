import type { PropsWithChildren } from 'react';

import { AuthProvider } from '../../features/auth/AuthProvider';
import type { AuthClient } from '../../features/auth/auth-client';
import { I18nProvider } from './I18nProvider';
import { QueryProvider } from './QueryProvider';

type AppProvidersProps = PropsWithChildren<{
  authClient?: AuthClient;
}>;

export function AppProviders({ authClient, children }: AppProvidersProps) {
  return (
    <I18nProvider>
      <AuthProvider client={authClient}>
        <QueryProvider>{children}</QueryProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
