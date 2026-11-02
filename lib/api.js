// Shared helpers for the REST route handlers.
import { NextResponse } from 'next/server';

export function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Wraps a handler so database outages return a clear 503 instead of a stack trace.
export function handle(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error(err);
      if (err?.name === 'MongoServerSelectionError') {
        return error('Cannot reach MongoDB. Is it running?', 503);
      }
      return error('Something went wrong on the server.', 500);
    }
  };
}

export function serializeCategory(c) {
  return { id: String(c._id), name: c.name, kind: c.kind, essential: c.essential };
}

export function serializeTransaction(t) {
  return {
    id: String(t._id),
    type: t.type,
    amountCents: t.amountCents,
    categoryId: String(t.categoryId),
    date: t.date.toISOString().slice(0, 10),
    note: t.note,
  };
}
