import { getDb } from '@/lib/mongodb';
import { error, handle, json } from '@/lib/api';
import { summarizeMonth } from '@/lib/analytics';
import { currentMonth, parseMonth } from '@/lib/validation';

export const GET = handle(async (request) => {
  const monthInfo = parseMonth(request.nextUrl.searchParams.get('month') ?? currentMonth());
  if (!monthInfo) return error('month must be in YYYY-MM format.');

  const db = await getDb();
  const [transactions, categories] = await Promise.all([
    db.collection('transactions').find({ date: { $gte: monthInfo.start, $lt: monthInfo.end } }).toArray(),
    db.collection('categories').find().toArray(),
  ]);
  return json(summarizeMonth(transactions, categories, monthInfo));
});
