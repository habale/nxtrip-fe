import { createRequestId } from './request-id';

describe('createRequestId', () => {
  it('creates unique RFC 4122 UUIDs', () => {
    const first = createRequestId();
    const second = createRequestId();

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second).not.toBe(first);
  });
});
