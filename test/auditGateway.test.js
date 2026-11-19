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

test('records invoice returns and inventory losses through the authenticated API gateway', async () => {
  const calls = [];
  const session = { token: 'employee-token' };
  const gateway = createHttpGestourantGateway({
    request: async (...args) => {
      calls.push(args);
      return {};
    },
  });
  const returnRequest = {
    orderItemId: 31,
    quantity: 1,
    reason: 'CALIDAD',
    notes: 'Se encontró un objeto extraño',
    restocked: false,
    refundMethod: 'EFECTIVO',
  };
  const lossRequest = { productId: 5, quantity: 2, reason: 'CADUCIDAD', notes: 'Vencido' };

  await gateway.returns.create(session, 20, returnRequest);
  await gateway.inventory.listLosses(session, '2026-11-01', '2026-11-03');
  await gateway.inventory.recordLoss(session, lossRequest);

  assert.deepEqual(calls, [
    ['/api/invoices/20/returns', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(returnRequest),
    }],
    ['/api/inventory/losses?from=2026-11-01&to=2026-11-03', session],
    ['/api/inventory/losses', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lossRequest),
    }],
  ]);
});
