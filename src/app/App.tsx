import { IonApp } from '@ionic/react';

import { AppRouter } from './router';

const mockAuthenticationState = {
  isAuthenticated: true,
} as const;

export function App() {
  return (
    <IonApp>
      <AppRouter isAuthenticated={mockAuthenticationState.isAuthenticated} />
    </IonApp>
  );
}
