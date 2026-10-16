import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpApiAdapter } from '../src/infrastructure/httpApiAdapter.js';

test('localizes known API error responses before exposing them to Vite views', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalConsoleError = console.error;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'en' },
  });
  globalThis.fetch = async () => new Response(
    JSON.stringify({ message: 'No encontramos esta mesa. Pide ayuda a un empleado.' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } },
  );
  console.error = () => {};

  try {
    await assert.rejects(
      createHttpApiAdapter().request('/api/guest/invalid', null),
      error => error.message === 'We could not find this table. Please ask a staff member for help.'
        && error.sourceMessage === 'No encontramos esta mesa. Pide ayuda a un empleado.'
        && error.status === 400,
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  }
});
