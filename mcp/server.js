#!/usr/bin/env node
// MCP server that lets an AI assistant (Claude Code, Claude Desktop, ...) read
// and log expenses in the tracker's MongoDB database over stdio.
//
// stdout carries the MCP protocol, so this file must never console.log;
// diagnostics go to stderr.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(path.join(root, '.env.local'));
} catch {
  // No .env.local: fall back to defaults (local MongoDB).
}

// Imported after the env file is loaded so lib/mongodb.js sees MONGODB_URI.
const { closeDb, getDb } = await import('../lib/mongodb.js');
const { summarizeMonth } = await import('../lib/analytics.js');
const { buildSpendingProfile } = await import('../lib/suggestions.js');
const { TransactionError, createTransaction } = await import('../lib/transactions.js');
const { parseMonth, previousMonths } = await import('../lib/validation.js');
const { formatCents, todayIso } = await import('../lib/format.js');

const MONTH = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM')
  .describe('Month in YYYY-MM format. Defaults to the current month.');

const thisMonth = () => todayIso().slice(0, 7);
const reply = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (message) => ({ content: [{ type: 'text', text: message }], isError: true });

async function loadCategories(db) {
  return db.collection('categories').find().sort({ kind: 1, name: 1 }).toArray();
}

// Matches a category by name, case-insensitively, within one kind.
function findCategory(categories, name, kind) {
  const wanted = name.trim().toLowerCase();
  return categories.find((c) => c.kind === kind && c.name.toLowerCase() === wanted);
}

const server = new McpServer({ name: 'expense-tracker', version: '1.0.0' });

server.registerTool(
  'list_categories',
  {
    title: 'List categories',
    description: 'List all income and expense categories. Essential expense categories (like rent) should not be suggested for cuts.',
    annotations: { readOnlyHint: true },
  },
  async () => {
    const categories = await loadCategories(await getDb());
    return reply(categories.map((c) => ({ name: c.name, kind: c.kind, essential: c.essential })));
  },
);

server.registerTool(
  'get_month_summary',
  {
    title: 'Get month summary',
    description: 'Total income, total spending, net, and spending broken down by category (largest first) for one month.',
    inputSchema: { month: MONTH.optional() },
    annotations: { readOnlyHint: true },
  },
  async ({ month = thisMonth() }) => {
    const db = await getDb();
    const monthInfo = parseMonth(month);
    const [transactions, categories] = await Promise.all([
      db.collection('transactions').find({ date: { $gte: monthInfo.start, $lt: monthInfo.end } }).toArray(),
      loadCategories(db),
    ]);
    const s = summarizeMonth(transactions, categories, monthInfo);
    return reply({
      month,
      income: formatCents(s.incomeCents),
      spent: formatCents(s.expenseCents),
      net: formatCents(s.netCents),
      transactionCount: transactions.length,
      spendingByCategory: s.byCategory.map((c) => ({
        category: c.name,
        essential: c.essential,
        spent: formatCents(c.totalCents),
        shareOfSpending: `${Math.round(c.share * 100)}%`,
      })),
    });
  },
);

server.registerTool(
  'list_transactions',
  {
    title: 'List transactions',
    description: 'List transactions for a month, newest first. Optionally filter by category name or by type.',
    inputSchema: {
      month: MONTH.optional(),
      category: z.string().min(1).optional().describe('Only include this category (case-insensitive).'),
      type: z.enum(['income', 'expense']).optional().describe('Only include income or only expenses.'),
      limit: z.number().int().min(1).max(200).default(50).describe('Maximum number of transactions to return.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ month = thisMonth(), category, type, limit }) => {
    const db = await getDb();
    const monthInfo = parseMonth(month);
    const categories = await loadCategories(db);
    const nameById = new Map(categories.map((c) => [String(c._id), c.name]));

    const query = { date: { $gte: monthInfo.start, $lt: monthInfo.end } };
    if (type) query.type = type;
    if (category) {
      const matches = categories.filter((c) => c.name.toLowerCase() === category.trim().toLowerCase());
      if (!matches.length) return fail(`No category named "${category}". Available: ${categories.map((c) => c.name).join(', ')}.`);
      query.categoryId = { $in: matches.map((c) => c._id) };
    }

    const rows = await db.collection('transactions').find(query).sort({ date: -1, _id: -1 }).limit(limit).toArray();
    return reply(
      rows.map((t) => ({
        date: t.date.toISOString().slice(0, 10),
        type: t.type,
        category: nameById.get(String(t.categoryId)) ?? 'Uncategorized',
        amount: formatCents(t.amountCents),
        note: t.note || undefined,
      })),
    );
  },
);

server.registerTool(
  'get_spending_trends',
  {
    title: 'Get spending trends',
    description:
      'Per-category spending for each of the last N months (ending with endMonth), with monthly averages and the essential flag. ' +
      'Use this to spot rising or unusually high spending.',
    inputSchema: {
      months: z.number().int().min(1).max(12).default(3).describe('How many months of history to include.'),
      endMonth: MONTH.optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ months: count, endMonth = thisMonth() }) => {
    const db = await getDb();
    const months = previousMonths(endMonth, count);
    const [transactions, categories] = await Promise.all([
      db.collection('transactions').find({ date: { $gte: parseMonth(months[0]).start, $lt: parseMonth(endMonth).end } }).toArray(),
      loadCategories(db),
    ]);
    const profile = buildSpendingProfile(transactions, categories, months);
    return reply({
      months,
      averageMonthlyIncome: formatCents(profile.averageMonthlyIncomeCents),
      categories: profile.categories.map((c) => ({
        category: c.name,
        essential: c.essential,
        averagePerMonth: formatCents(c.averageCents),
        byMonth: Object.fromEntries(Object.entries(c.monthlyTotalsCents).map(([m, v]) => [m, formatCents(v)])),
      })),
    });
  },
);

server.registerTool(
  'add_transaction',
  {
    title: 'Add transaction',
    description:
      'Log a new income or expense. The category must already exist and match the type (call list_categories first if unsure). ' +
      'Confirm the amount and category with the user before logging.',
    inputSchema: {
      type: z.enum(['income', 'expense']),
      amount: z.number().positive().describe('Amount in dollars, e.g. 12.5'),
      category: z.string().min(1).describe('Existing category name, e.g. "Dining Out".'),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
        .optional()
        .describe('Date in YYYY-MM-DD. Defaults to today.'),
      note: z.string().max(200).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  async ({ type, amount, category, date = todayIso(), note = '' }) => {
    const db = await getDb();
    const categories = await loadCategories(db);
    const match = findCategory(categories, category, type);
    if (!match) {
      const options = categories.filter((c) => c.kind === type).map((c) => c.name);
      return fail(`No ${type} category named "${category}". Available ${type} categories: ${options.join(', ') || 'none'}.`);
    }

    try {
      const created = await createTransaction(db, { type, amount, categoryId: String(match._id), date, note });
      return reply({
        added: true,
        type,
        amount: formatCents(created.amountCents),
        category: match.name,
        date: created.date.toISOString().slice(0, 10),
        note: created.note || undefined,
      });
    } catch (err) {
      if (err instanceof TransactionError) return fail(err.message);
      throw err;
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('expense-tracker MCP server running on stdio');

const shutdown = async () => {
  await closeDb().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.stdin.on('close', shutdown);
