import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidRegistrationPassword } from '../src/shared/passwordPolicy.js';

test('requires 12 to 72 characters with upper, lower, number, and special character', () => {
  assert.equal(isValidRegistrationPassword('Password1!ab'), true);
  assert.equal(isValidRegistrationPassword('Password1!abc'), true);
  assert.equal(isValidRegistrationPassword(`Password1!abc${'x'.repeat(59)}`), true);
  assert.equal(isValidRegistrationPassword('Pass1!short'), false);
  assert.equal(isValidRegistrationPassword('password12345!'), false);
  assert.equal(isValidRegistrationPassword('PASSWORD12345!'), false);
  assert.equal(isValidRegistrationPassword('Password!abcde'), false);
  assert.equal(isValidRegistrationPassword(`Password1!abc${'x'.repeat(60)}`), false);
  assert.equal(isValidRegistrationPassword(null), false);
});
