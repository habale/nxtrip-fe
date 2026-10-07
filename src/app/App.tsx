import { IonApp } from '@ionic/react';

import { useAuth } from '../features/auth/auth-context';
import { AuthLoadingPage } from '../features/auth/components/AuthLoadingPage';
import { AppRouter } from './router';

export function App() {
  const { session, status } = useAuth();

  return (
    <IonApp>
      {status === 'loading' ? (
        <AuthLoadingPage />
      ) : (
        <AppRouter
          isAuthenticated={Boolean(session)}
          isGuest={session?.user.is_anonymous ?? false}
        />
      )}
    </IonApp>
  );
}
