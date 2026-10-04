import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { routes } from '../routes';

type ProtectedRouteProps = PropsWithChildren<{
  isAuthenticated: boolean;
}>;

export function ProtectedRoute({
  isAuthenticated,
  children,
}: ProtectedRouteProps) {
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to={routes.login}
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  return children;
}
