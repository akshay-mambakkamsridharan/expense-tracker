import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'expense_tracker';

// Cache one client on globalThis so Next.js hot reloads and repeated route
// calls reuse a single connection pool instead of opening new ones.
const cache = globalThis;

async function connect() {
  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
  const db = client.db(dbName);
  await Promise.all([
    db.collection('categories').createIndex({ kind: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } }),
    db.collection('transactions').createIndex({ date: -1 }),
    db.collection('transactions').createIndex({ categoryId: 1 }),
  ]);
  return { client, db };
}

export async function getDb() {
  if (!cache._expenseTrackerMongo) {
    // Clear a failed attempt so the next request retries instead of reusing the error.
    cache._expenseTrackerMongo = connect().catch((err) => {
      cache._expenseTrackerMongo = undefined;
      throw err;
    });
  }
  return (await cache._expenseTrackerMongo).db;
}

export async function closeDb() {
  if (!cache._expenseTrackerMongo) return;
  const { client } = await cache._expenseTrackerMongo;
  cache._expenseTrackerMongo = undefined;
  await client.close();
}
