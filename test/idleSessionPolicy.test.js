import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatIdleCountdown,
  IDLE_LOCK_AFTER_MS,
  IDLE_LOCKED_COUNTDOWN_MS,
  IDLE_LOGOUT_AFTER_MS
} from '../src/application/idleSessionPolicy.js';

test('locks after two inactive minutes and ends the session after three more', () => {
  assert.equal(IDLE_LOCK_AFTER_MS, 120_000);
  assert.equal(IDLE_LOCKED_COUNTDOWN_MS, 180_000);
  assert.equal(IDLE_LOGOUT_AFTER_MS, 300_000);
  assert.equal(IDLE_LOGOUT_AFTER_MS - IDLE_LOCK_AFTER_MS, 180_000);
});

test('formats the locked-session countdown as minutes and seconds', () => {
  const deadline = 300_000;
  assert.equal(formatIdleCountdown(deadline, 120_000), '03:00');
  assert.equal(formatIdleCountdown(deadline, 239_000), '01:01');
  assert.equal(formatIdleCountdown(deadline, 300_000), '00:00');
  assert.equal(formatIdleCountdown(deadline, 301_000), '00:00');
});
