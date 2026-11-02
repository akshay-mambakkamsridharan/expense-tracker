import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { error, handle, json } from '@/lib/api';
import { isObjectId } from '@/lib/validation';

export const DELETE = handle(async (_request, { params }) => {
  const { id } = await params;
  if (!isObjectId(id)) return error('Invalid transaction id.');

  const db = await getDb();
  const { deletedCount } = await db.collection('transactions').deleteOne({ _id: new ObjectId(id) });
  if (!deletedCount) return error('Transaction not found.', 404);
  return json({ ok: true });
});
