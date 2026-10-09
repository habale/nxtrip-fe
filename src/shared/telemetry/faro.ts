import type { Faro, TransportItem } from '@grafana/faro-web-sdk';

type TelemetryAttributes = Record<string, boolean | number | string>;
type PendingAction = (client: Faro) => void;

let client: Faro | null = null;
let loading = false;
const pendingActions: PendingAction[] = [];

export function normalizeTelemetryPath(pathname: string) {
  return pathname.replace(/^\/trips\/[^/]+/, '/trips/:tripId');
}

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value, 'https://nxtrip.invalid');
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    url.pathname = normalizeTelemetryPath(url.pathname);
    return url.origin === 'https://nxtrip.invalid'
      ? url.pathname
      : `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

export function sanitizeFaroItem(item: TransportItem) {
  const pageUrl = item.meta.page?.url;
  if (!pageUrl) return item;

  const sanitizedUrl = sanitizeUrl(pageUrl);
  return {
    ...item,
    meta: {
      ...item.meta,
      page: { ...item.meta.page, url: sanitizedUrl },
    },
  };
}

export function normalizeReplaySamplingRate(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.1;
  return Math.min(1, Math.max(0, parsed));
}

export function initializeTelemetry() {
  const url = import.meta.env.VITE_FARO_URL?.trim();
  if (client || loading || import.meta.env.VITE_FARO_ENABLED !== 'true' || !url)
    return;

  loading = true;
  const replayEnabled = import.meta.env.VITE_FARO_REPLAY_ENABLED === 'true';

  void Promise.all([
    import('@grafana/faro-web-sdk'),
    replayEnabled
      ? import('@grafana/faro-instrumentation-replay')
      : Promise.resolve(null),
  ])
    .then(([faroSdk, replaySdk]) => {
      const instrumentations = [...faroSdk.getWebInstrumentations()];
      if (replaySdk) {
        instrumentations.push(
          new replaySdk.ReplayInstrumentation({
            blockSelector: '.trip-invite-panel__code, [data-replay-block]',
            maskAllInputs: true,
            maskTextSelector: '*',
            samplingRate: normalizeReplaySamplingRate(
              import.meta.env.VITE_FARO_REPLAY_SAMPLE_RATE,
            ),
            sanitizeMetaHref: true,
          }),
        );
      }

      client = faroSdk.initializeFaro({
        url,
        ...(import.meta.env.VITE_FARO_API_KEY?.trim()
          ? { apiKey: import.meta.env.VITE_FARO_API_KEY.trim() }
          : {}),
        app: {
          environment: import.meta.env.VITE_APP_ENV,
          name: import.meta.env.VITE_FARO_APP_NAME?.trim() || 'NxTrip',
          version: import.meta.env.VITE_FARO_APP_VERSION?.trim() || '0.0.0',
        },
        beforeSend: sanitizeFaroItem,
        instrumentations,
      });
      pendingActions.splice(0).forEach((action) => action(client!));
    })
    .catch(() => {
      pendingActions.length = 0;
    })
    .finally(() => {
      loading = false;
    });
}

function withClient(action: PendingAction) {
  if (client) action(client);
  else if (loading) pendingActions.push(action);
}

export function captureTelemetryEvent(
  event: string,
  attributes?: TelemetryAttributes,
) {
  withClient((faro) =>
    faro.api.pushEvent(
      event,
      attributes
        ? Object.fromEntries(
            Object.entries(attributes).map(([key, value]) => [
              key,
              String(value),
            ]),
          )
        : undefined,
    ),
  );
}

export function identifyTelemetryUser(userId: string) {
  withClient((faro) => faro.api.setUser({ id: userId }));
}

export function resetTelemetryUser() {
  withClient((faro) => faro.api.resetUser());
}

export function setTelemetryView(pathname: string) {
  withClient((faro) =>
    faro.api.setView({ name: normalizeTelemetryPath(pathname) }),
  );
}
