'use client';

import { formatMonthLabel } from '@/lib/format';

function shift(month, delta) {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default function MonthNav({ month, onChange, isCurrent, onToday }) {
  return (
    <nav className="month-nav" aria-label="Choose month">
      <button className="icon-btn" onClick={() => onChange(shift(month, -1))} aria-label="Previous month">
        ‹
      </button>
      <span className="label" aria-live="polite">
        {formatMonthLabel(month)}
      </span>
      <button className="icon-btn" onClick={() => onChange(shift(month, 1))} aria-label="Next month">
        ›
      </button>
      {!isCurrent && (
        <button className="btn quiet" onClick={onToday} style={{ marginLeft: 6, padding: '6px 12px' }}>
          This month
        </button>
      )}
    </nav>
  );
}
