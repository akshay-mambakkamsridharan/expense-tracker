'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCents } from '@/lib/format';

const toDollars = (cents) => Math.round(cents) / 100;

export default function DailyChart({ analytics }) {
  if (!analytics || (!analytics.incomeCents && !analytics.expenseCents)) return null;

  const data = analytics.daily.map((d) => ({ day: d.day, Income: toDollars(d.incomeCents), Spent: toDollars(d.expenseCents) }));
  const money = (value) => formatCents(value * 100);

  return (
    <section className="panel">
      <div className="section-head">
        <h2 className="section-title">Day by day</h2>
        <span className="muted" style={{ fontSize: 13 }}>
          <span className="income">■</span> Income <span className="spend" style={{ marginLeft: 8 }}>■</span> Spent
        </span>
      </div>
      <div className="chart">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: -12, right: 4, top: 4 }} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--ink-2)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: 'var(--ink-2)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              formatter={(value) => money(value)}
              labelFormatter={(day) => `Day ${day}`}
              cursor={{ fill: 'var(--page)' }}
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)' }}
            />
            <Bar dataKey="Income" fill="var(--brand)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="Spent" fill="var(--spend)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
