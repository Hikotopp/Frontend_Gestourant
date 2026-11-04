import assert from 'node:assert/strict';
import test from 'node:test';
import { formatColombiaDate, todayInBogota } from '../src/shared/date-time.js';

test('formats instants in Bogota regardless of the runtime timezone', () => {
  const value = '2026-11-02T03:30:00Z';
  const actual = formatColombiaDate(value, 'en');
  const expected = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value));
  assert.equal(actual, expected);
  assert.match(actual, /Nov 1, 2026/);
});

test('interprets backend local timestamps as Bogota wall time', () => {
  assert.equal(
    formatColombiaDate('2026-11-01T22:30:00', 'en'),
    formatColombiaDate('2026-11-02T03:30:00Z', 'en'),
  );
});

test('keeps date-only values on their selected calendar day', () => {
  assert.match(formatColombiaDate('2026-11-01', 'en'), /Nov 1, 2026/);
});

test('gets today in Bogota instead of the device timezone', () => {
  assert.equal(todayInBogota(new Date('2026-11-02T03:30:00Z')), '2026-11-01');
});
