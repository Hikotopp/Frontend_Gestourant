import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpGestourantGateway } from '../src/infrastructure/httpGestourantGateway.js';

test('submits floor orders, delivers ready batches, and advances kitchen tickets', async () => {
  const calls = [];
  const session = { token: 'employee-token' };
  const gateway = createHttpGestourantGateway({
    request: async (...args) => {
      calls.push(args);
      return [];
    },
  });

  await gateway.orders.submitToKitchen(session, 12);
  await gateway.kitchen.listOrderTickets(session);
  await gateway.kitchen.advanceOrderTicket(session, 'batch/one');
  await gateway.orders.deliverBatch(session, 12, 'batch/one');

  assert.deepEqual(calls, [
    ['/api/orders/12/kitchen-batches', session, { method: 'POST' }],
    ['/api/kitchen/order-batches', session],
    ['/api/kitchen/order-batches/batch%2Fone/advance', session, { method: 'PATCH' }],
    ['/api/orders/12/kitchen-batches/batch%2Fone/deliver', session, { method: 'PATCH' }],
  ]);
});
