import {
  clearAuthReturnTo,
  getAuthReturnTo,
  saveAuthReturnTo,
} from './auth-return';

describe('authentication return destination', () => {
  beforeEach(() => sessionStorage.clear());

  it('keeps protected destinations', () => {
    saveAuthReturnTo('/trips/trip-1/itinerary?day=2');
    expect(getAuthReturnTo()).toBe('/trips/trip-1/itinerary?day=2');
  });

  it('never uses public guest or login routes as a normal login return', () => {
    sessionStorage.setItem('nxtrip.auth.returnTo', '/guest');
    expect(getAuthReturnTo()).toBeNull();
    expect(sessionStorage.getItem('nxtrip.auth.returnTo')).toBeNull();

    saveAuthReturnTo('/login');
    expect(getAuthReturnTo()).toBeNull();
  });

  it('clears an existing destination when guest access is chosen', () => {
    saveAuthReturnTo('/settings');
    clearAuthReturnTo();
    expect(getAuthReturnTo()).toBeNull();
  });
});
