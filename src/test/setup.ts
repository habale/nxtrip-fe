import '@testing-library/jest-dom/vitest';
import { setupIonicReact } from '@ionic/react';

setupIonicReact();

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class IntersectionObserverStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly scrollMargin = '0px';
    readonly thresholds = [];

    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
}
