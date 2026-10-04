import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';

import { routes } from '../routes';

type PublicRouteShellProps = PropsWithChildren<{
  isAuthenticated: boolean;
}>;

export function PublicRouteShell({
  isAuthenticated,
  children,
}: PublicRouteShellProps) {
  return isAuthenticated ? <Navigate to={routes.home} replace /> : children;
}
