import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Tear down DOM between tests so jsdom doesn't leak nodes.
afterEach(() => {
  cleanup();
});

// Default localStorage to a clean state per test.
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
});
