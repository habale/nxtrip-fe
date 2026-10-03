import type { PropsWithChildren } from 'react';

import { I18nProvider } from './I18nProvider';
import { QueryProvider } from './QueryProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <I18nProvider>
      <QueryProvider>{children}</QueryProvider>
    </I18nProvider>
  );
}
