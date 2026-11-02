// Turns spending history into an LLM prompt, and checks the model's answer
// before anything reaches the UI. The model is never trusted blindly: unknown
// categories are dropped and savings estimates are clamped to real spending.

export function buildSpendingProfile(transactions, categories, months) {
  const byId = new Map(categories.map((c) => [String(c._id ?? c.id), c]));
  const totals = new Map(); // categoryId -> { month -> cents }
  let incomeCents = 0;

  for (const t of transactions) {
    const month = new Date(t.date).toISOString().slice(0, 7);
    if (!months.includes(month)) continue;
    if (t.type === 'income') {
      incomeCents += t.amountCents;
      continue;
    }
    const key = String(t.categoryId);
    const perMonth = totals.get(key) ?? {};
    perMonth[month] = (perMonth[month] ?? 0) + t.amountCents;
    totals.set(key, perMonth);
  }

  const profileCategories = [...totals.entries()]
    .map(([id, perMonth]) => {
      const category = byId.get(id);
      const monthlyTotalsCents = Object.fromEntries(months.map((m) => [m, perMonth[m] ?? 0]));
      const sum = Object.values(monthlyTotalsCents).reduce((a, b) => a + b, 0);
      return {
        name: category?.name ?? 'Uncategorized',
        essential: category?.essential ?? false,
        monthlyTotalsCents,
        averageCents: Math.round(sum / months.length),
      };
    })
    .sort((a, b) => b.averageCents - a.averageCents);

  return {
    months,
    averageMonthlyIncomeCents: Math.round(incomeCents / months.length),
    categories: profileCategories,
  };
}

const dollars = (cents) => Math.round(cents) / 100;

export function buildMessages(profile) {
  const data = {
    months: profile.months,
    averageMonthlyIncome: dollars(profile.averageMonthlyIncomeCents),
    categories: profile.categories.map((c) => ({
      name: c.name,
      essential: c.essential,
      averageMonthlySpend: dollars(c.averageCents),
      monthlyTotals: Object.fromEntries(Object.entries(c.monthlyTotalsCents).map(([m, v]) => [m, dollars(v)])),
    })),
  };

  return [
    {
      role: 'system',
      content:
        'You are a personal finance assistant. Using only the spending data provided, identify up to 3 ' +
        'non-essential spending categories where the user could realistically cut back. Never suggest cutting ' +
        'categories marked essential. Base every claim on the numbers given. Respond with JSON only, in the form ' +
        '{"suggestions":[{"category":string,"observation":string,"recommendation":string,"estimatedMonthlySavings":number}]}. ' +
        '"category" must exactly match a category name from the data. estimatedMonthlySavings is in dollars.',
    },
    { role: 'user', content: JSON.stringify(data) },
  ];
}

export function parseSuggestions(raw, profile) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Model returned invalid JSON.');
  }
  if (!parsed || !Array.isArray(parsed.suggestions)) throw new Error('Model response is missing a suggestions list.');

  const byName = new Map(profile.categories.map((c) => [c.name.toLowerCase(), c]));
  const seen = new Set();

  return parsed.suggestions
    .filter((s) => s && typeof s.category === 'string' && typeof s.recommendation === 'string')
    .map((s) => ({ ...s, match: byName.get(s.category.trim().toLowerCase()) }))
    // Drop hallucinated categories, essential ones, and duplicates.
    .filter((s) => s.match && !s.match.essential && !seen.has(s.match.name) && seen.add(s.match.name))
    .slice(0, 3)
    .map((s) => {
      const requested = Math.round(Number(s.estimatedMonthlySavings) * 100);
      const savingsCents = Number.isFinite(requested) ? Math.min(Math.max(requested, 0), s.match.averageCents) : 0;
      return {
        category: s.match.name,
        observation: typeof s.observation === 'string' ? s.observation : '',
        recommendation: s.recommendation,
        estimatedMonthlySavingsCents: savingsCents,
      };
    });
}
