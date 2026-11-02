import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMonth } from '../lib/analytics.js';
import { parseMonth } from '../lib/validation.js';

const categories = [
  { _id: 'rent', name: 'Rent', essential: true },
  { _id: 'food', name: 'Dining Out', essential: false },
  { _id: 'pay', name: 'Salary', essential: false },
];

const tx = (type, amountCents, categoryId, day) => ({ type, amountCents, categoryId, date: new Date(Date.UTC(2026, 9, day)) });

test('summarizeMonth totals income, expenses and net', () => {
  const summary = summarizeMonth(
    [tx('income', 300000, 'pay', 1), tx('expense', 140000, 'rent', 1), tx('expense', 2500, 'food', 3), tx('expense', 7500, 'food', 20)],
    categories,
    parseMonth('2026-10'),
  );
  assert.equal(summary.incomeCents, 300000);
  assert.equal(summary.expenseCents, 150000);
  assert.equal(summary.netCents, 150000);
});

test('summarizeMonth breaks expenses down by category, largest first', () => {
  const summary = summarizeMonth([tx('expense', 2500, 'food', 3), tx('expense', 7500, 'rent', 4)], categories, parseMonth('2026-10'));
  assert.deepEqual(
    summary.byCategory.map((c) => [c.name, c.totalCents, c.share]),
    [
      ['Rent', 7500, 0.75],
      ['Dining Out', 2500, 0.25],
    ],
  );
});

test('summarizeMonth fills every day of the month and labels unknown categories', () => {
  const summary = summarizeMonth([tx('expense', 1000, 'deleted-category', 31)], categories, parseMonth('2026-10'));
  assert.equal(summary.daily.length, 31);
  assert.equal(summary.daily[30].expenseCents, 1000);
  assert.equal(summary.byCategory[0].name, 'Uncategorized');
});

test('summarizeMonth handles an empty month', () => {
  const summary = summarizeMonth([], categories, parseMonth('2026-02'));
  assert.equal(summary.daily.length, 28);
  assert.deepEqual(summary.byCategory, []);
  assert.equal(summary.netCents, 0);
});
