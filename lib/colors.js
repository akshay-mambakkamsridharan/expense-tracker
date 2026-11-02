// Stable color per expense category, assigned in the API's name order so a
// category keeps its color across the strip, legend, and transaction list.
const PALETTE = ['#2e5e8c', '#c08a2e', '#3f8f7a', '#7a5ba6', '#b0505e', '#4c7f3a', '#2f8ba8', '#8a6e58'];
const INCOME_COLOR = '#13715f';

export function categoryColors(categories) {
  const colors = new Map();
  categories
    .filter((c) => c.kind === 'expense')
    .forEach((c, i) => colors.set(c.id, PALETTE[i % PALETTE.length]));
  categories.filter((c) => c.kind === 'income').forEach((c) => colors.set(c.id, INCOME_COLOR));
  return colors;
}
