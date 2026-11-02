// Business rules for creating a transaction, shared by the REST API and the
// MCP server so both enforce exactly the same checks.
import { ObjectId } from 'mongodb';
import { validateTransaction } from './validation.js';

export class TransactionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function createTransaction(db, input) {
  const { value, error } = validateTransaction(input);
  if (error) throw new TransactionError(error);

  const categoryId = new ObjectId(value.categoryId);
  const category = await db.collection('categories').findOne({ _id: categoryId });
  if (!category) throw new TransactionError('Category not found.', 404);
  if (category.kind !== value.type) {
    throw new TransactionError(`"${category.name}" is an ${category.kind} category, not ${value.type}.`);
  }

  const doc = { ...value, categoryId, createdAt: new Date() };
  const { insertedId } = await db.collection('transactions').insertOne(doc);
  return { _id: insertedId, ...doc };
}
