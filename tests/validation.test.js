import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, parseMonth, previousMonths, toCents, validateCategory, validateTransaction } from '../lib/validation.js';

const CATEGORY_ID = '65f0c0ffee0000000000abcd';

test('toCents converts dollars to integer cents', () => {
  assert.equal(toCents('12.34'), 1234);
  assert.equal(toCents(0.1), 10);
  assert.equal(toCents('5'), 500);
});

test('toCents rejects invalid amounts', () => {
  for (const bad of ['0', '-5', '1.234', 'abc', '', null, undefined, '1e3', '2000000']) {
    assert.equal(toCents(bad), null, `expected ${bad} to be rejected`);
  }
});

test('parseDate rejects impossible calendar dates', () => {
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('2026-13-01'), null);
  assert.equal(parseDate('03/04/2026'), null);
  assert.equal(parseDate('2028-02-29').toISOString(), '2028-02-29T00:00:00.000Z');
});

test('parseMonth returns a half-open UTC range and day count', () => {
  const feb = parseMonth('2026-02');
  assert.equal(feb.start.toISOString(), '2026-02-01T00:00:00.000Z');
  assert.equal(feb.end.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(feb.days, 28);
  assert.equal(parseMonth('2026-00'), null);
});

test('previousMonths crosses year boundaries', () => {
  assert.deepEqual(previousMonths('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
});

test('validateTransaction accepts a well-formed expense', () => {
  const { value, error } = validateTransaction({ type: 'expense', amount: '19.99', categoryId: CATEGORY_ID, date: '2026-10-05', note: '  lunch ' });
  assert.equal(error, undefined);
  assert.equal(value.amountCents, 1999);
  assert.equal(value.note, 'lunch');
});

test('validateTransaction reports the first problem', () => {
  assert.match(validateTransaction({ type: 'gift' }).error, /type/);
  assert.match(validateTransaction({ type: 'income', amount: 10, categoryId: 'nope', date: '2026-10-05' }).error, /categoryId/);
  assert.match(validateTransaction(null).error, /JSON object/);
});

test('validateCategory only lets expense categories be essential', () => {
  assert.equal(validateCategory({ name: 'Salary', kind: 'income', essential: true }).value.essential, false);
  assert.equal(validateCategory({ name: ' Rent ', kind: 'expense', essential: true }).value.name, 'Rent');
  assert.match(validateCategory({ name: '', kind: 'expense' }).error, /name/);
});
