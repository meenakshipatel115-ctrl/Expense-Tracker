# Expense Tracker

A complete, self-contained Expense Tracker web app.

- **Backend:** Python (Flask) + SQLite
- **Frontend:** Plain HTML / CSS / JavaScript (Chart.js for the pie chart)
- **Currency:** Indian Rupees (₹)

## Folder Structure

```
expense_tracker/
├── app.py                  # Flask backend (routes + SQLite logic)
├── requirements.txt        # Python dependencies
├── expenses.db              # Created automatically on first run
├── templates/
│   └── index.html          # Single-page frontend
└── static/
    ├── css/
    │   └── style.css       # All styling
    └── js/
        └── script.js       # All frontend logic (fetch calls, chart, table)
```

## Setup on 64-bit Windows

1. **Install Python** (3.10+ recommended) from [python.org](https://www.python.org/downloads/windows/)
   during install, check **"Add Python to PATH"**.

2. **Open a terminal** (PowerShell or Command Prompt) in the `expense_tracker` folder.

3. **Create a virtual environment** (recommended):
   ```powershell
   python -m venv venv
   venv\Scripts\activate
   ```

4. **Install dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

5. **Run the app:**
   ```powershell
   python app.py
   ```

6. **Open your browser** and go to:
   ```
   http://127.0.0.1:5000
   ```

The SQLite database file (`expenses.db`) is created automatically the first
time you run the app — no manual database setup needed.

## Features

- **Add Expense** — form with Amount, Category, Date, and Description.
- **Dashboard** — total spent, this month's spend, transaction count, top
  category, a pie chart of spending by category, and a recent-expenses list.
- **History** — full sortable table of every expense with filtering by
  category and date range, plus inline Edit and Delete actions.
- **Data persistence** — everything is stored in a local SQLite file
  (`expenses.db`), so your data survives restarts.

## API Reference (for extending in VS Code / Cursor / Trae)

| Method | Endpoint                  | Description                          |
|--------|----------------------------|---------------------------------------|
| GET    | `/api/categories`          | List available categories             |
| GET    | `/api/expenses`             | List expenses (supports `category`, `start_date`, `end_date` query params) |
| GET    | `/api/expenses/<id>`        | Get a single expense                  |
| POST   | `/api/expenses`             | Create a new expense                  |
| PUT    | `/api/expenses/<id>`        | Update an existing expense            |
| DELETE | `/api/expenses/<id>`        | Delete an expense                     |
| GET    | `/api/summary`              | Totals grouped by category + overall stats |

All expense payloads use this JSON shape:

```json
{
  "amount": 499.00,
  "category": "Food",
  "date": "2026-07-18",
  "description": "Lunch with team"
}
```

## Notes for AI coding assistants

- The codebase is intentionally split into clear, single-responsibility files
  (`app.py` for backend logic, `script.js` for frontend logic, `style.css`
  for all styling) so an AI assistant can target one file at a time.
- No build step, no bundler, no frontend framework — just static files
  served by Flask, so edits are visible immediately after a page refresh
  (backend changes need a restart of `python app.py`, or use
  `debug=True`, which is already set, for auto-reload).
- To switch from SQLite to a JSON file instead, only `app.py` needs to
  change — the frontend talks to the same `/api/...` endpoints regardless
  of storage backend.
