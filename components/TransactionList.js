'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { formatCents } from '@/lib/format';

function dayLabel(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Transactions arrive newest first; group them by date, keeping that order.
function groupByDay(transactions) {
  const groups = [];
  for (const t of transactions) {
    const last = groups.at(-1);
    if (last?.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }
  return groups;
}

const PREVIEW_COUNT = 8;

export default function TransactionList({ transactions, categories, colors, monthLabel, onDeleted }) {
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? transactions : transactions.slice(0, PREVIEW_COUNT);
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  async function remove(id) {
    setError('');
    try {
      await api(`/api/transactions/${id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h2 className="section-title">Transactions</h2>
        <span className="muted num">{transactions.length} in {monthLabel}</span>
      </div>
      {error && <p className="notice" role="alert">{error}</p>}

      {transactions.length === 0 ? (
        <div className="empty">
          <strong>No transactions in {monthLabel}</strong>
          Use the form to log your first expense or income.
        </div>
      ) : (
        groupByDay(visible).map((group) => {
          const net = group.items.reduce((sum, t) => sum + (t.type === 'income' ? t.amountCents : -t.amountCents), 0);
          return (
            <div className="day-group" key={group.date}>
              <div className="day-head">
                <span>{dayLabel(group.date)}</span>
                <span className="num">{net >= 0 ? '+' : '−'}{formatCents(Math.abs(net))}</span>
              </div>
              {group.items.map((t) => {
                const name = nameById.get(t.categoryId) ?? 'Uncategorized';
                return (
                  <div className="txn" key={t.id}>
                    <span className="swatch" style={{ backgroundColor: colors.get(t.categoryId) ?? '#8a948f' }} />
                    <div className="what">
                      <div>{name}</div>
                      {t.note && <div className="note">{t.note}</div>}
                    </div>
                    <span className={`amt num ${t.type === 'income' ? 'income' : ''}`}>
                      {t.type === 'income' ? '+' : '−'}
                      {formatCents(t.amountCents)}
                    </span>
                    <button className="icon-btn" onClick={() => remove(t.id)} aria-label={`Delete ${name} ${formatCents(t.amountCents)} on ${t.date}`} title="Delete">
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
      {transactions.length > PREVIEW_COUNT && (
        <button className="btn quiet show-all" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${transactions.length} transactions`}
        </button>
      )}
    </section>
  );
}
