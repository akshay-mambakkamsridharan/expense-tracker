// Builds the dashboard summary for one month from raw transactions.

export function summarizeMonth(transactions, categories, monthInfo) {
  const categoryById = new Map(categories.map((c) => [String(c._id ?? c.id), c]));
  const daily = Array.from({ length: monthInfo.days }, (_, i) => ({ day: i + 1, incomeCents: 0, expenseCents: 0 }));
  const spendByCategory = new Map();
  let incomeCents = 0;
  let expenseCents = 0;

  for (const t of transactions) {
    const dayIndex = new Date(t.date).getUTCDate() - 1;
    if (t.type === 'income') {
      incomeCents += t.amountCents;
      if (daily[dayIndex]) daily[dayIndex].incomeCents += t.amountCents;
      continue;
    }
    expenseCents += t.amountCents;
    if (daily[dayIndex]) daily[dayIndex].expenseCents += t.amountCents;
    const key = String(t.categoryId);
    spendByCategory.set(key, (spendByCategory.get(key) ?? 0) + t.amountCents);
  }

  const byCategory = [...spendByCategory.entries()]
    .map(([id, totalCents]) => {
      const category = categoryById.get(id);
      return {
        categoryId: id,
        name: category?.name ?? 'Uncategorized',
        essential: category?.essential ?? false,
        totalCents,
        share: expenseCents ? totalCents / expenseCents : 0,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents);

  return {
    month: monthInfo.month,
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    byCategory,
    daily,
  };
}
