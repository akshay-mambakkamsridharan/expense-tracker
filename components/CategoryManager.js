'use client';

import { useState } from 'react';
import { api } from '@/lib/client';

export default function CategoryManager({ categories, colors, onChanged }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('expense');
  const [essential, setEssential] = useState(false);
  const [error, setError] = useState('');

  async function add(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/categories', { method: 'POST', body: { name, kind, essential } });
      setName('');
      setEssential(false);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    setError('');
    try {
      await api(`/api/categories/${id}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  const groups = [
    ['expense', 'Expenses'],
    ['income', 'Income'],
  ];

  return (
    <details className="panel categories" open={categories.length === 0}>
      <summary>Manage categories</summary>

      {groups.map(([groupKind, title]) => {
        const items = categories.filter((c) => c.kind === groupKind);
        return (
          <div className="cat-group" key={groupKind}>
            <h3>{title}</h3>
            {items.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>None yet.</p>
            ) : (
              <div className="chips">
                {items.map((c) => (
                  <span className="chip" key={c.id}>
                    <span className={`swatch ${c.essential || c.kind === 'income' ? '' : 'flexible'}`} style={{ backgroundColor: colors.get(c.id) }} />
                    {c.name}
                    <button onClick={() => remove(c.id)} aria-label={`Delete ${c.name} category`} title="Delete">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <form className="cat-form" onSubmit={add}>
        <div className="pair">
          <label className="field">
            New category
            <input value={name} maxLength={40} placeholder="e.g. Gym" onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
        </div>
        {kind === 'expense' && (
          <label className="check">
            <input type="checkbox" checked={essential} onChange={(e) => setEssential(e.target.checked)} />
            Essential. Savings ideas will never suggest cutting it.
          </label>
        )}
        {error && <p className="notice" role="alert">{error}</p>}
        <button className="btn quiet">Add category</button>
      </form>
    </details>
  );
}
