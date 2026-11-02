# Expense Tracker

A full-stack personal finance app for logging income and expenses by category, with a live analytics dashboard and an AI suggestion engine that recommends where to cut non-essential spending.

**Stack:** Next.js 15 (App Router) · React 19 · Node.js · MongoDB · REST APIs · Recharts · OpenAI API · JavaScript

## Features

- **Income and expense logging** with dates, notes and user-defined categories
- **Essential vs. non-essential categories.** Essential spending, like rent, is never targeted by AI suggestions
- **Live dashboard:** monthly income, expenses and net; spending-by-category donut chart; daily cash-flow chart. It refreshes after every change, every 15 seconds, and when the tab regains focus
- **AI savings suggestions:** analyzes the last 3 months of spending and returns up to 3 concrete, category-level recommendations with estimated monthly savings

## Architecture

```
app/
  page.js                    Dashboard (client component)
  api/
    categories/              GET, POST       /api/categories
    categories/[id]/         DELETE          /api/categories/:id
    transactions/            GET, POST       /api/transactions?month=YYYY-MM
    transactions/[id]/       DELETE          /api/transactions/:id
    analytics/               GET             /api/analytics?month=YYYY-MM
    suggestions/             POST            /api/suggestions   { month }
components/                  Dashboard panels (form, list, charts, categories, suggestions)
lib/
  validation.js              Request validation (pure, unit tested)
  analytics.js               Monthly summary builder (pure, unit tested)
  suggestions.js             Spending profile, LLM prompt, output validation (pure, unit tested)
  openai.js                  OpenAI Chat Completions call
  mongodb.js                 Cached MongoDB connection + indexes
scripts/seed.js              Demo data: 10 categories, 3 months of transactions
tests/                       node:test unit tests
```

## Design decisions

- **Money is stored as integer cents**, so totals never pick up floating-point errors like `0.1 + 0.2`.
- **LLM output is validated, not trusted.** `parseSuggestions` drops suggestions for categories that don't exist (hallucinations) or are marked essential, removes duplicates, and clamps each savings estimate to between $0 and what the user actually spends in that category.
- **Business logic is kept out of route handlers.** Validation, analytics and prompt building are pure functions, so they're tested without a database or network.
- **Data integrity is enforced in the API.** A transaction's type must match its category's kind; category names are unique per kind (case-insensitive index); a category that still has transactions can't be deleted.
- **It degrades gracefully.** The app runs fully without an OpenAI key. The suggestions panel explains how to enable it, and a MongoDB outage returns a clear 503.

## Getting started

Requirements: Node.js 20+ and MongoDB (local or Atlas).

```bash
npm install
cp .env.example .env.local     # then edit .env.local
npm run seed                   # optional demo data (npm run seed -- --reset to wipe and reseed)
npm run dev                    # http://localhost:3000
```

On macOS, you can install and start MongoDB locally with:

```bash
brew tap mongodb/brew && brew install mongodb-community
brew services start mongodb-community
```

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | MongoDB connection string |
| `MONGODB_DB` | `expense_tracker` | Database name |
| `OPENAI_API_KEY` | none | Enables AI suggestions |
| `OPENAI_MODEL` | `gpt-5-mini` | Model used for suggestions |

## Tests

```bash
npm test
```

18 unit tests cover input validation (amounts, impossible dates, month ranges), the analytics summary, and the AI-output guards (hallucinated categories, essential categories, out-of-range savings, malformed JSON).

## Built with Claude Code

This project was built by directing Claude Code as the coding agent: I wrote the requirements, reviewed the generated code, and tested the result.

<!-- TODO(Akshay): replace with your own notes — 2-3 concrete moments, e.g.
- What I asked the agent for and what it produced
- Something I caught in review and changed (and why)
- A test I defined to check the agent's work
-->
