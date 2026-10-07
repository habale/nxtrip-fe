import { IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import type { ReactNode } from 'react';
import { Navigate, Route } from 'react-router-dom';

import { LoginPage } from '../features/auth/pages/LoginPage';
import { SettingsPage } from '../features/profile/pages/SettingsPage';
import { CreateTripPage } from '../features/trips/pages/CreateTripPage';
import { AddTripPage } from '../features/trips/pages/AddTripPage';
import { HomePage } from '../features/trips/pages/HomePage';
import { TripDetailPage } from '../features/trips/pages/TripDetailPage';
import { UiShowcasePage } from '../features/ui-showcase/pages/UiShowcasePage';
import { ROUTE_PATHS } from './routes';
import { NotFoundPage, PlaceholderPage } from './shell/PlaceholderPage';
import { ProtectedRoute } from './shell/ProtectedRoute';
import { PublicRouteShell } from './shell/PublicRouteShell';

type RouterProps = {
  isAuthenticated: boolean;
};

type ProtectedPageProps = RouterProps & {
  titleKey: string;
  descriptionKey: string;
  children?: ReactNode;
};

function ProtectedPage({
  titleKey,
  descriptionKey,
  children,
  isAuthenticated,
}: ProtectedPageProps) {
  return (
    <ProtectedRoute isAuthenticated={isAuthenticated}>
      <PlaceholderPage titleKey={titleKey} descriptionKey={descriptionKey}>
        {children}
      </PlaceholderPage>
    </ProtectedRoute>
  );
}

export function AppRoutes({ isAuthenticated }: RouterProps) {
  return (
    <IonRouterOutlet>
      <Route
        path={ROUTE_PATHS.login}
        element={
          <PublicRouteShell isAuthenticated={isAuthenticated}>
            <LoginPage />
          </PublicRouteShell>
        }
      />
      <Route
        path={ROUTE_PATHS.home}
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.addTrip}
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <AddTripPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.newTrip}
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <CreateTripPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.editTrip}
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <CreateTripPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.bookmarks}
        element={
          <ProtectedPage
            isAuthenticated={isAuthenticated}
            titleKey="pages.bookmarks.title"
            descriptionKey="pages.bookmarks.description"
          />
        }
      />
      <Route
        path={ROUTE_PATHS.tripSection}
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <TripDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.settings}
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path={ROUTE_PATHS.uiKit} element={<UiShowcasePage />} />
      <Route
        path={ROUTE_PATHS.root}
        element={
          <Navigate
            to={isAuthenticated ? ROUTE_PATHS.home : ROUTE_PATHS.login}
            replace
          />
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </IonRouterOutlet>
  );
}

export function AppRouter({ isAuthenticated }: RouterProps) {
  return (
    <IonReactRouter>
      <AppRoutes isAuthenticated={isAuthenticated} />
    </IonReactRouter>
  );
}
