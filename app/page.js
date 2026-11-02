'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { categoryColors } from '@/lib/colors';
import { formatMonthLabel } from '@/lib/format';
import MonthNav from '@/components/MonthNav';
import MonthOverview from '@/components/MonthOverview';
import TransactionForm from '@/components/TransactionForm';
import TransactionList from '@/components/TransactionList';
import CategoryManager from '@/components/CategoryManager';
import DailyChart from '@/components/DailyChart';
import SuggestionsPanel from '@/components/SuggestionsPanel';

const REFRESH_MS = 15_000;

function thisMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function Home() {
  const [month, setMonth] = useState(thisMonth);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loadError, setLoadError] = useState('');
  const latestMonth = useRef(month);
  latestMonth.current = month;

  const refresh = useCallback(async () => {
    try {
      const [cats, txns, summary] = await Promise.all([
        api('/api/categories'),
        api(`/api/transactions?month=${month}`),
        api(`/api/analytics?month=${month}`),
      ]);
      // Drop responses for a month the user has already navigated away from,
      // so a slow earlier request can't overwrite the current month's data.
      if (latestMonth.current !== month) return;
      setCategories(cats);
      setTransactions(txns);
      setAnalytics(summary);
      setLoadError('');
    } catch (err) {
      if (latestMonth.current === month) setLoadError(err.message);
    }
  }, [month]);

  // Reload on month change, on a timer, and when the tab regains focus so the
  // dashboard stays current with entries made in other tabs.
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  // Keep the selected month in the URL so refreshes and shared links keep it.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('month');
    if (fromUrl && /^\d{4}-(0[1-9]|1[0-2])$/.test(fromUrl)) setMonth(fromUrl);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (month === thisMonth()) url.searchParams.delete('month');
    else url.searchParams.set('month', month);
    window.history.replaceState(null, '', url);
  }, [month]);

  const colors = useMemo(() => categoryColors(categories), [categories]);
  const monthLabel = formatMonthLabel(month);

  return (
    <main className="shell">
      <header className="topbar">
        <h1>Expense Tracker</h1>
        <MonthNav month={month} onChange={setMonth} isCurrent={month === thisMonth()} onToday={() => setMonth(thisMonth())} />
      </header>

      {loadError && <p className="notice">{loadError}</p>}

      <MonthOverview analytics={analytics} colors={colors} monthLabel={monthLabel} />

      <div className="workspace">
        <aside className="side">
          <TransactionForm categories={categories} onCreated={refresh} />
          <CategoryManager categories={categories} colors={colors} onChanged={refresh} />
        </aside>
        <div className="main">
          <TransactionList transactions={transactions} categories={categories} colors={colors} monthLabel={monthLabel} onDeleted={refresh} />
          <DailyChart analytics={analytics} />
          <SuggestionsPanel month={month} monthLabel={monthLabel} />
        </div>
      </div>
    </main>
  );
}
