// Request validation shared by the API routes. Pure functions, no database
// access, so they can be unit tested directly.

export const TYPES = ['income', 'expense'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const MAX_AMOUNT_CENTS = 100_000_000; // $1,000,000 per entry

export function isObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_RE.test(value);
}

// Money is stored as integer cents so totals never pick up floating-point drift.
export function toCents(amount) {
  const text = typeof amount === 'number' ? String(amount) : String(amount ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  if (cents <= 0 || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

export function parseDate(text) {
  if (typeof text !== 'string' || !DATE_RE.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  // Rejects dates like 2026-02-30 that Date would silently roll over.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return null;
  return date;
}

export function parseMonth(text) {
  if (typeof text !== 'string' || !MONTH_RE.test(text)) return null;
  const [year, month] = text.split('-').map(Number);
  if (month < 1 || month > 12) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { month: text, start, end, days: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}

export function currentMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

// Returns the `count` months ending with `month`, oldest first.
export function previousMonths(month, count) {
  const [year, m] = month.split('-').map(Number);
  const result = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, m - 1 - i, 1));
    result.push(d.toISOString().slice(0, 7));
  }
  return result;
}

export function validateTransaction(body) {
  if (!body || typeof body !== 'object') return { error: 'Request body must be a JSON object.' };
  const { type, amount, categoryId, date, note = '' } = body;

  if (!TYPES.includes(type)) return { error: 'type must be "income" or "expense".' };
  const amountCents = toCents(amount);
  if (amountCents === null) return { error: 'amount must be a positive number with at most 2 decimals.' };
  if (!isObjectId(categoryId)) return { error: 'categoryId is not a valid id.' };
  const parsedDate = parseDate(date);
  if (!parsedDate) return { error: 'date must be a real date in YYYY-MM-DD format.' };
  if (typeof note !== 'string' || note.trim().length > 200) return { error: 'note must be text of 200 characters or fewer.' };

  return { value: { type, amountCents, categoryId, date: parsedDate, note: note.trim() } };
}

export function validateCategory(body) {
  if (!body || typeof body !== 'object') return { error: 'Request body must be a JSON object.' };
  const { name, kind, essential = false } = body;

  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length < 1 || trimmed.length > 40) return { error: 'name must be 1 to 40 characters.' };
  if (!TYPES.includes(kind)) return { error: 'kind must be "income" or "expense".' };
  if (typeof essential !== 'boolean') return { error: 'essential must be true or false.' };

  // Only expense categories can be essential; the flag drives AI suggestions.
  return { value: { name: trimmed, kind, essential: kind === 'expense' && essential } };
}
