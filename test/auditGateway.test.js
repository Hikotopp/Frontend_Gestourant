import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpGestourantGateway } from '../src/infrastructure/httpGestourantGateway.js';

test('requests the selected administrator audit page through the shared API gateway', async () => {
  const calls = [];
  const session = { token: 'admin-token' };
  const gateway = createHttpGestourantGateway({
    request: async (...args) => {
      calls.push(args);
      return { content: [], number: 2, totalPages: 4, totalElements: 175 };
    },
  });

  const page = await gateway.audit.list(session, 2, 25);

  assert.deepEqual(calls, [['/api/audit-logs?page=2&size=25', session]]);
  assert.equal(page.number, 2);
});
