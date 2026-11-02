import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, buildSpendingProfile, parseSuggestions } from '../lib/suggestions.js';

const categories = [
  { _id: 'rent', name: 'Rent', essential: true },
  { _id: 'food', name: 'Dining Out', essential: false },
  { _id: 'subs', name: 'Subscriptions', essential: false },
  { _id: 'pay', name: 'Salary', essential: false },
];
const months = ['2026-08', '2026-09', '2026-10'];
const tx = (type, amountCents, categoryId, month) => ({ type, amountCents, categoryId, date: new Date(`${month}-10T00:00:00Z`) });

const transactions = [
  tx('expense', 140000, 'rent', '2026-08'),
  tx('expense', 140000, 'rent', '2026-09'),
  tx('expense', 140000, 'rent', '2026-10'),
  tx('expense', 30000, 'food', '2026-09'),
  tx('expense', 60000, 'food', '2026-10'),
  tx('expense', 4500, 'subs', '2026-10'),
  tx('income', 600000, 'pay', '2026-10'),
  tx('expense', 99999, 'food', '2026-05'), // outside the window, must be ignored
];

const profile = buildSpendingProfile(transactions, categories, months);

test('buildSpendingProfile averages over every month in the window, including zero months', () => {
  const food = profile.categories.find((c) => c.name === 'Dining Out');
  assert.deepEqual(food.monthlyTotalsCents, { '2026-08': 0, '2026-09': 30000, '2026-10': 60000 });
  assert.equal(food.averageCents, 30000);
  assert.equal(profile.averageMonthlyIncomeCents, 200000);
  assert.equal(profile.categories[0].name, 'Rent');
});

test('buildMessages sends dollars, not cents, and marks essential categories', () => {
  const [system, user] = buildMessages(profile);
  assert.match(system.content, /Never suggest cutting categories marked essential/);
  const data = JSON.parse(user.content);
  assert.equal(data.categories.find((c) => c.name === 'Rent').averageMonthlySpend, 1400);
  assert.equal(data.categories.find((c) => c.name === 'Rent').essential, true);
});

test('parseSuggestions keeps valid suggestions and normalizes category names', () => {
  const raw = JSON.stringify({
    suggestions: [{ category: 'dining out', observation: 'Doubled in October.', recommendation: 'Cook twice more a week.', estimatedMonthlySavings: 120 }],
  });
  assert.deepEqual(parseSuggestions(raw, profile), [
    { category: 'Dining Out', observation: 'Doubled in October.', recommendation: 'Cook twice more a week.', estimatedMonthlySavingsCents: 12000 },
  ]);
});

test('parseSuggestions drops hallucinated, essential and duplicate categories', () => {
  const raw = JSON.stringify({
    suggestions: [
      { category: 'Rent', recommendation: 'Move out.', estimatedMonthlySavings: 500 },
      { category: 'Gym', recommendation: 'Cancel gym.', estimatedMonthlySavings: 40 },
      { category: 'Subscriptions', recommendation: 'Cancel one service.', estimatedMonthlySavings: 10 },
      { category: 'Subscriptions', recommendation: 'Duplicate.', estimatedMonthlySavings: 10 },
    ],
  });
  assert.deepEqual(
    parseSuggestions(raw, profile).map((s) => s.category),
    ['Subscriptions'],
  );
});

test('parseSuggestions clamps savings to what the user actually spends', () => {
  const raw = JSON.stringify({
    suggestions: [
      { category: 'Subscriptions', recommendation: 'Cancel all.', estimatedMonthlySavings: 9999 },
      { category: 'Dining Out', recommendation: 'Eat in.', estimatedMonthlySavings: -50 },
    ],
  });
  const [subs, food] = parseSuggestions(raw, profile);
  assert.equal(subs.estimatedMonthlySavingsCents, 1500); // 3-month average of $45 in one month
  assert.equal(food.estimatedMonthlySavingsCents, 0);
});

test('parseSuggestions rejects malformed model output', () => {
  assert.throws(() => parseSuggestions('not json', profile), /invalid JSON/);
  assert.throws(() => parseSuggestions('{"ideas": []}', profile), /missing a suggestions list/);
});
