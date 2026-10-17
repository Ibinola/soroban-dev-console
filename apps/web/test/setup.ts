import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import * as React from 'react';

// Make React globally available for UI components that rely on the
// classic JSX runtime (no explicit `import React from 'react'`).
(globalThis as unknown as { React: typeof React }).React = React;

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// Guarded so individual tests can opt into the node environment
// (`// @vitest-environment node`), e.g. for stellar-sdk code that needs
// same-realm Buffers.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });
}

// Mock crypto.randomUUID
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(7),
    },
    writable: true,
  });
}
