import { getDb } from '@/lib/mongodb';
import { error, handle, json, readJson, serializeTransaction } from '@/lib/api';
import { TransactionError, createTransaction } from '@/lib/transactions';
import { currentMonth, parseMonth } from '@/lib/validation';

export const GET = handle(async (request) => {
  const monthInfo = parseMonth(request.nextUrl.searchParams.get('month') ?? currentMonth());
  if (!monthInfo) return error('month must be in YYYY-MM format.');

  const db = await getDb();
  const transactions = await db
    .collection('transactions')
    .find({ date: { $gte: monthInfo.start, $lt: monthInfo.end } })
    .sort({ date: -1, _id: -1 })
    .toArray();
  return json(transactions.map(serializeTransaction));
});

export const POST = handle(async (request) => {
  const db = await getDb();
  try {
    const created = await createTransaction(db, await readJson(request));
    return json(serializeTransaction(created), 201);
  } catch (err) {
    if (err instanceof TransactionError) return error(err.message, err.status);
    throw err;
  }
});
