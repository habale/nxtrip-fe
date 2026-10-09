import {
  normalizeReplaySamplingRate,
  normalizeTelemetryPath,
  sanitizeFaroItem,
} from './faro';

describe('Faro privacy', () => {
  it('removes secrets from page URLs and normalizes trip identifiers', () => {
    expect(
      sanitizeFaroItem({
        type: TransportItemType.EVENT,
        payload: {
          name: 'screen_viewed',
          timestamp: '2026-10-09T00:00:00.000Z',
        },
        meta: {
          page: {
            url: 'https://nxtrip.app/trips/trip-secret/ledger?tab=all#code=invite-secret',
          },
        },
      }),
    ).toMatchObject({
      meta: { page: { url: 'https://nxtrip.app/trips/:tripId/ledger' } },
    });
  });

  it('normalizes paths and clamps replay sampling', () => {
    expect(normalizeTelemetryPath('/trips/abc-123/itinerary')).toBe(
      '/trips/:tripId/itinerary',
    );
    expect(normalizeReplaySamplingRate(undefined)).toBe(0.1);
    expect(normalizeReplaySamplingRate('2')).toBe(1);
    expect(normalizeReplaySamplingRate('-1')).toBe(0);
  });
});
import { TransportItemType } from '@grafana/faro-web-sdk';
