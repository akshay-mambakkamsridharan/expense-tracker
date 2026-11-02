import { formatCents } from '@/lib/format';

function Headline({ incomeCents, expenseCents, netCents }) {
  if (!incomeCents && !expenseCents) return <>Nothing logged yet this month. Add your first transaction to see where your money goes.</>;
  return (
    <>
      You earned <strong className="income">{formatCents(incomeCents)}</strong> and spent{' '}
      <strong className="spend">{formatCents(expenseCents)}</strong>.{' '}
      {netCents >= 0 ? (
        <>
          <strong>{formatCents(netCents)}</strong> left over.
        </>
      ) : (
        <>
          That&rsquo;s <strong className="spend">{formatCents(-netCents)}</strong> more than you earned.
        </>
      )}
    </>
  );
}

// The month at a glance: one bar of spending split by category, measured
// against income. Striped segments are flexible (non-essential) spending.
export default function MonthOverview({ analytics, colors, monthLabel }) {
  if (!analytics) {
    return (
      <section className="overview" aria-busy="true">
        <p className="headline muted">Loading {monthLabel}…</p>
      </section>
    );
  }

  const { incomeCents, expenseCents, byCategory } = analytics;
  const scale = Math.max(incomeCents, expenseCents) || 1;
  const pct = (cents) => `${(cents / scale) * 100}%`;
  const incomeAtEnd = incomeCents / scale > 0.85;
  const description = byCategory.map((c) => `${c.name} ${formatCents(c.totalCents)}`).join(', ');

  return (
    <section className="overview" aria-label={`${monthLabel} overview`}>
      <p className="headline">
        <Headline {...analytics} />
      </p>

      {expenseCents > 0 && (
        <>
          <div className="strip-wrap">
            <div className="strip" role="img" aria-label={`Spending by category: ${description}`}>
              {byCategory.map((c) => (
                <span
                  key={c.categoryId}
                  className={`seg ${c.essential ? '' : 'flexible'}`}
                  style={{ width: pct(c.totalCents), backgroundColor: colors.get(c.categoryId) ?? '#8a948f' }}
                  title={`${c.name}: ${formatCents(c.totalCents)}`}
                />
              ))}
            </div>
            {incomeCents > 0 && (
              <span className={`income-mark ${incomeAtEnd ? 'at-end' : ''}`} style={{ left: pct(incomeCents) }}>
                <span>Income {formatCents(incomeCents)}</span>
              </span>
            )}
          </div>

          <ul className="legend">
            {byCategory.map((c) => (
              <li key={c.categoryId}>
                <span className={`swatch ${c.essential ? '' : 'flexible'}`} style={{ backgroundColor: colors.get(c.categoryId) ?? '#8a948f' }} />
                <span>{c.name}</span>
                <span className="amount num">
                  {formatCents(c.totalCents)} <span className="muted">({Math.round(c.share * 100)}%)</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="strip-key">Solid bars are essential spending. Striped bars are flexible spending you could cut back on.</p>
        </>
      )}
    </section>
  );
}
