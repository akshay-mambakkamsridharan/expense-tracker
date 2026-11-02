import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { error, handle, json, readJson, serializeTransaction } from '@/lib/api';
import { currentMonth, parseMonth, validateTransaction } from '@/lib/validation';

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
  const { value, error: message } = validateTransaction(await readJson(request));
  if (message) return error(message);

  const db = await getDb();
  const categoryId = new ObjectId(value.categoryId);
  const category = await db.collection('categories').findOne({ _id: categoryId });
  if (!category) return error('Category not found.', 404);
  if (category.kind !== value.type) return error(`"${category.name}" is an ${category.kind} category, not ${value.type}.`);

  const doc = { ...value, categoryId, createdAt: new Date() };
  const { insertedId } = await db.collection('transactions').insertOne(doc);
  return json(serializeTransaction({ _id: insertedId, ...doc }), 201);
});
