import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { saveAuthReturnTo } from '../auth-return';
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
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    if (location.pathname !== routes.login) saveAuthReturnTo(returnTo);
    return <Navigate to={routes.login} replace />;
  }

  return children;
}
