import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { clearAuthReturnTo, getAuthReturnTo } from '../auth-return';
import { routes } from '../routes';

type PublicRouteShellProps = PropsWithChildren<{
  isAuthenticated: boolean;
}>;

export function PublicRouteShell({
  isAuthenticated,
  children,
}: PublicRouteShellProps) {
  const [returnTo] = useState(() => getAuthReturnTo() ?? routes.home);

  useEffect(() => {
    if (isAuthenticated) clearAuthReturnTo();
  }, [isAuthenticated]);

  return isAuthenticated ? <Navigate to={returnTo} replace /> : children;
}
