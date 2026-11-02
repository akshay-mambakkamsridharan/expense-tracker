import { getDb } from '@/lib/mongodb';
import { error, handle, json, readJson } from '@/lib/api';
import { LLMSetupError, MissingApiKeyError, fetchSuggestions } from '@/lib/llm';
import { buildSpendingProfile } from '@/lib/suggestions';
import { currentMonth, parseMonth, previousMonths } from '@/lib/validation';

const HISTORY_MONTHS = 3;

export const POST = handle(async (request) => {
  const body = (await readJson(request)) ?? {};
  const month = body.month ?? currentMonth();
  if (!parseMonth(month)) return error('month must be in YYYY-MM format.');

  const months = previousMonths(month, HISTORY_MONTHS);
  const start = parseMonth(months[0]).start;
  const end = parseMonth(month).end;

  const db = await getDb();
  const [transactions, categories] = await Promise.all([
    db.collection('transactions').find({ date: { $gte: start, $lt: end } }).toArray(),
    db.collection('categories').find().toArray(),
  ]);

  const profile = buildSpendingProfile(transactions, categories, months);
  if (!profile.categories.length) return error('Log some expenses first so there is history to analyze.');
  if (profile.categories.every((c) => c.essential)) {
    return json({ months, suggestions: [], note: 'All of your spending is in essential categories.' });
  }

  try {
    const suggestions = await fetchSuggestions(profile);
    return json({ months, suggestions });
  } catch (err) {
    if (err instanceof MissingApiKeyError) return error(err.message, 503, { code: 'NO_API_KEY' });
    if (err instanceof LLMSetupError) return error(err.message, 503, { code: 'AI_SETUP' });
    console.error(err);
    return error('The AI service did not return usable suggestions. Try again.', 502);
  }
});
