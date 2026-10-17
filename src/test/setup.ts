import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  // A test that imports a share link must not leave it in the URL for the next one.
  window.history.replaceState(null, '', '/');
});
