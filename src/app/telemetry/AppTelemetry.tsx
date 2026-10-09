import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../../features/auth/auth-context';
import {
  identifyTelemetryUser,
  resetTelemetryUser,
  setTelemetryView,
} from '../../shared/telemetry/faro';

export function AppTelemetry() {
  const { pathname } = useLocation();
  const { status, user } = useAuth();
  const identifiedUser = useRef<string | null>(null);

  useEffect(() => {
    setTelemetryView(pathname);
  }, [pathname]);

  useEffect(() => {
    if (status !== 'ready') return;

    if (user && !user.is_anonymous) {
      if (identifiedUser.current && identifiedUser.current !== user.id) {
        resetTelemetryUser();
      }
      identifyTelemetryUser(user.id);
      identifiedUser.current = user.id;
    } else if (identifiedUser.current) {
      resetTelemetryUser();
      identifiedUser.current = null;
    }
  }, [status, user]);

  return null;
}
