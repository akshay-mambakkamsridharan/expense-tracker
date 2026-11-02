// Fills the database with sample categories and three months of transactions
// for demos. Refuses to touch a database that already has data unless --reset.
import { closeDb, getDb } from '../lib/mongodb.js';
import { currentMonth, previousMonths } from '../lib/validation.js';

const CATEGORIES = [
  { name: 'Rent', kind: 'expense', essential: true },
  { name: 'Groceries', kind: 'expense', essential: true },
  { name: 'Utilities', kind: 'expense', essential: true },
  { name: 'Transport', kind: 'expense', essential: true },
  { name: 'Dining Out', kind: 'expense', essential: false },
  { name: 'Entertainment', kind: 'expense', essential: false },
  { name: 'Shopping', kind: 'expense', essential: false },
  { name: 'Subscriptions', kind: 'expense', essential: false },
  { name: 'Salary', kind: 'income', essential: false },
  { name: 'Freelance', kind: 'income', essential: false },
];

// [category, entries per month, min dollars, max dollars, note]
const PATTERNS = [
  ['Rent', 1, 1400, 1400, 'Monthly rent'],
  ['Groceries', 6, 35, 110, 'Grocery run'],
  ['Utilities', 2, 45, 90, 'Electric / internet'],
  ['Transport', 4, 20, 60, 'Transit pass / rides'],
  ['Dining Out', 9, 15, 65, 'Restaurant'],
  ['Entertainment', 3, 20, 80, 'Movies / events'],
  ['Shopping', 3, 30, 150, 'Online order'],
  ['Subscriptions', 4, 10, 18, 'Streaming / apps'],
  ['Salary', 2, 1900, 1900, 'Paycheck'],
  ['Freelance', 1, 200, 600, 'Side project'],
];

// Small seeded PRNG so every seed run produces the same demo data.
let state = 42;
const random = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const between = (min, max) => min + random() * (max - min);

async function main() {
  const reset = process.argv.includes('--reset');
  const db = await getDb();
  const categories = db.collection('categories');
  const transactions = db.collection('transactions');

  if (!reset && ((await categories.estimatedDocumentCount()) || (await transactions.estimatedDocumentCount()))) {
    console.log('Database already has data. Run `npm run seed -- --reset` to wipe it and reseed.');
    return;
  }
  await Promise.all([categories.deleteMany({}), transactions.deleteMany({})]);

  const { insertedIds } = await categories.insertMany(CATEGORIES.map((c) => ({ ...c })));
  const idByName = Object.fromEntries(CATEGORIES.map((c, i) => [c.name, insertedIds[i]]));
  const typeByName = Object.fromEntries(CATEGORIES.map((c) => [c.name, c.kind]));

  const today = new Date();
  const docs = [];
  for (const month of previousMonths(currentMonth(today), 3)) {
    const [year, m] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
    for (const [name, count, min, max, note] of PATTERNS) {
      for (let i = 0; i < count; i++) {
        const day = count === 1 ? 1 : 1 + Math.floor(random() * daysInMonth);
        const date = new Date(Date.UTC(year, m - 1, day));
        if (date > today) continue; // no future-dated entries in the current month
        docs.push({
          type: typeByName[name],
          amountCents: Math.round(between(min, max) * 100),
          categoryId: idByName[name],
          date,
          note,
          createdAt: new Date(),
        });
      }
    }
  }
  await transactions.insertMany(docs);
  console.log(`Seeded ${CATEGORIES.length} categories and ${docs.length} transactions.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(closeDb);
