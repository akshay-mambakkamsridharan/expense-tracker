// End-to-end check of the MCP server: starts it over stdio like Claude Code
// would, calls every tool, and asserts on the results. Runs against a
// throwaway database so real data is never touched.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = 'expense_tracker_mcp_smoke';

const mongo = await new MongoClient(uri).connect();
const db = mongo.db(dbName);
await db.dropDatabase();
const { insertedIds } = await db.collection('categories').insertMany([
  { name: 'Rent', kind: 'expense', essential: true },
  { name: 'Dining Out', kind: 'expense', essential: false },
  { name: 'Salary', kind: 'income', essential: false },
]);
await db.collection('transactions').insertMany([
  { type: 'expense', amountCents: 140000, categoryId: insertedIds[0], date: new Date('2026-10-01T00:00:00Z'), note: 'Rent', createdAt: new Date() },
  { type: 'income', amountCents: 300000, categoryId: insertedIds[2], date: new Date('2026-10-15T00:00:00Z'), note: 'Paycheck', createdAt: new Date() },
]);

const client = new Client({ name: 'smoke-test', version: '1.0.0' });
await client.connect(
  new StdioClientTransport({ command: process.execPath, args: [path.join(here, 'server.js')], env: { ...process.env, MONGODB_URI: uri, MONGODB_DB: dbName } }),
);

const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content[0].text;
  return { isError: Boolean(result.isError), text, data: result.isError ? null : JSON.parse(text) };
};

try {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['add_transaction', 'get_month_summary', 'get_spending_trends', 'list_categories', 'list_transactions']);

  const cats = await call('list_categories');
  assert.equal(cats.data.length, 3);

  const added = await call('add_transaction', { type: 'expense', amount: 42.5, category: 'dining out', date: '2026-10-20', note: 'Team dinner' });
  assert.equal(added.isError, false, added.text);
  assert.equal(added.data.category, 'Dining Out');
  assert.equal(added.data.amount, '$42.50');

  const wrongKind = await call('add_transaction', { type: 'expense', amount: 10, category: 'Salary' });
  assert.equal(wrongKind.isError, true);
  assert.match(wrongKind.text, /No expense category named "Salary"/);

  const badDate = await call('add_transaction', { type: 'expense', amount: 10, category: 'Rent', date: '2026-02-30' });
  assert.equal(badDate.isError, true);
  assert.match(badDate.text, /real date/);

  const summary = await call('get_month_summary', { month: '2026-10' });
  assert.equal(summary.data.income, '$3,000.00');
  assert.equal(summary.data.spent, '$1,442.50');
  assert.equal(summary.data.spendingByCategory[0].category, 'Rent');

  const dining = await call('list_transactions', { month: '2026-10', category: 'Dining Out' });
  assert.equal(dining.data.length, 1);
  assert.equal(dining.data[0].note, 'Team dinner');

  const trends = await call('get_spending_trends', { months: 2, endMonth: '2026-10' });
  assert.deepEqual(trends.data.months, ['2026-09', '2026-10']);
  assert.equal(trends.data.categories.find((c) => c.category === 'Dining Out').averagePerMonth, '$21.25');

  console.log(`MCP smoke test passed: ${tools.length} tools, all checks OK.`);
} finally {
  await client.close();
  await db.dropDatabase();
  await mongo.close();
}
