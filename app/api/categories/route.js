import { getDb } from '@/lib/mongodb';
import { error, handle, json, readJson, serializeCategory } from '@/lib/api';
import { validateCategory } from '@/lib/validation';

export const GET = handle(async () => {
  const db = await getDb();
  const categories = await db.collection('categories').find().sort({ kind: 1, name: 1 }).toArray();
  return json(categories.map(serializeCategory));
});

export const POST = handle(async (request) => {
  const { value, error: message } = validateCategory(await readJson(request));
  if (message) return error(message);

  const db = await getDb();
  try {
    const { insertedId } = await db.collection('categories').insertOne(value);
    return json(serializeCategory({ _id: insertedId, ...value }), 201);
  } catch (err) {
    if (err?.code === 11000) return error(`An ${value.kind} category named "${value.name}" already exists.`, 409);
    throw err;
  }
});
