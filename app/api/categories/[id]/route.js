import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { error, handle, json } from '@/lib/api';
import { isObjectId } from '@/lib/validation';

export const DELETE = handle(async (_request, { params }) => {
  const { id } = await params;
  if (!isObjectId(id)) return error('Invalid category id.');

  const db = await getDb();
  const _id = new ObjectId(id);
  // Refuse to orphan transactions; the user must move or delete them first.
  const inUse = await db.collection('transactions').countDocuments({ categoryId: _id }, { limit: 1 });
  if (inUse) return error('This category still has transactions. Delete those first.', 409);

  const { deletedCount } = await db.collection('categories').deleteOne({ _id });
  if (!deletedCount) return error('Category not found.', 404);
  return json({ ok: true });
});
