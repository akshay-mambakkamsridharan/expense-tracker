'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { formatCents, todayIso } from '@/lib/format';

export default function TransactionForm({ categories, onCreated }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayIso);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const amountRef = useRef(null);

  const options = categories.filter((c) => c.kind === type);

  // Keep the selected category valid when the type or category list changes.
  useEffect(() => {
    if (!options.some((c) => c.id === categoryId)) setCategoryId(options[0]?.id ?? '');
  }, [options, categoryId]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setConfirmation('');
    try {
      const created = await api('/api/transactions', { method: 'POST', body: { type, amount, categoryId, date, note } });
      const name = categories.find((c) => c.id === categoryId)?.name ?? 'your list';
      setConfirmation(`Added ${formatCents(created.amountCents)} to ${name}.`);
      setAmount('');
      setNote('');
      amountRef.current?.focus();
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel quick-add">
      <h2 className="section-title">Add a transaction</h2>
      <form onSubmit={submit}>
        <div className="segmented" role="group" aria-label="Transaction type">
          <button type="button" className="is-expense" aria-pressed={type === 'expense'} onClick={() => setType('expense')}>
            Expense
          </button>
          <button type="button" className="is-income" aria-pressed={type === 'income'} onClick={() => setType('income')}>
            Income
          </button>
        </div>

        <label className="field">
          Amount
          <div className="amount-input">
            <span aria-hidden="true">$</span>
            <input
              ref={amountRef}
              className="num"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
        </label>

        <div className="pair">
          <label className="field">
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              {options.length === 0 && <option value="">No {type} categories yet</option>}
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>

        <label className="field">
          <span>
            Note <span className="muted">(optional)</span>
          </span>
          <input maxLength={200} placeholder="e.g. Lunch with team" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && <p className="notice" role="alert">{error}</p>}
        <button className="btn block" disabled={saving || !categoryId}>
          {saving ? 'Adding…' : type === 'expense' ? 'Add expense' : 'Add income'}
        </button>
        <p className="confirm" aria-live="polite">
          {confirmation}
        </p>
      </form>
    </section>
  );
}
