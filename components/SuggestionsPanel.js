'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { formatCents } from '@/lib/format';

export default function SuggestionsPanel({ month, monthLabel }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Suggestions are tied to a month's history, so clear them when it changes.
  useEffect(() => {
    setResult(null);
    setError('');
  }, [month]);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      setResult(await api('/api/suggestions', { method: 'POST', body: { month } }));
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const total = result?.suggestions.reduce((sum, s) => sum + s.estimatedMonthlySavingsCents, 0) ?? 0;

  return (
    <section className="panel" aria-busy={loading}>
      <div className="section-head">
        <h2 className="section-title">Savings ideas</h2>
        <button className="btn" onClick={generate} disabled={loading}>
          {loading ? 'Reviewing your spending…' : result ? 'Refresh ideas' : 'Find savings'}
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Reviews your flexible spending over the 3 months up to {monthLabel} and suggests where to cut back.
      </p>

      {error && <p className="notice" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      {result?.note && <p style={{ marginBottom: 0 }}>{result.note}</p>}
      {result && !result.note && result.suggestions.length === 0 && (
        <p style={{ marginBottom: 0 }}>No savings ideas came back this time. Try refreshing.</p>
      )}

      {result?.suggestions.length > 0 && (
        <div className="ideas" style={{ marginTop: 14 }}>
          {result.suggestions.map((s) => (
            <article className="idea" key={s.category}>
              <header>
                <span>{s.category}</span>
                {s.estimatedMonthlySavingsCents > 0 && <span className="income num">Save about {formatCents(s.estimatedMonthlySavingsCents)}/mo</span>}
              </header>
              {s.observation && <p className="why">{s.observation}</p>}
              <p>{s.recommendation}</p>
            </article>
          ))}
          {total > 0 && (
            <p className="ideas-total">
              Together these could save about <strong className="income num">{formatCents(total)} a month</strong>.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
