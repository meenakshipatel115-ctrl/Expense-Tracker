"""
Expense Tracker - Flask Backend
--------------------------------
A simple, self-contained Flask application that serves a single-page
Expense Tracker frontend and exposes a small JSON REST API backed by
SQLite for data persistence.

Run with:
    python app.py

Then open:
    http://127.0.0.1:5000
"""

import os
import sqlite3
from datetime import datetime

from flask import Flask, render_template, request, jsonify, g

# ---------------------------------------------------------------------------
# App & Database Configuration
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "expenses.db")

app = Flask(__name__)

# Allowed categories (used for validation on the backend as well as to
# populate the dropdown on the frontend via the /api/categories endpoint).
CATEGORIES = [
    "Food",
    "Transport",
    "Shopping",
    "Bills & Utilities",
    "Entertainment",
    "Health",
    "Education",
    "Rent",
    "Groceries",
    "Other",
]


def get_db():
    """Open a new database connection if one doesn't already exist for the
    current application context, and return it."""
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    """Close the database connection at the end of the request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Create the expenses table if it does not already exist."""
    db = sqlite3.connect(DATABASE)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def row_to_dict(row):
    return {
        "id": row["id"],
        "amount": row["amount"],
        "category": row["category"],
        "date": row["date"],
        "description": row["description"],
        "created_at": row["created_at"],
    }


def validate_expense_payload(data):
    """Validate incoming expense data. Returns (is_valid, error_message)."""
    if not data:
        return False, "No data provided."

    amount = data.get("amount")
    category = data.get("category")
    date = data.get("date")
    description = data.get("description", "")

    # Amount checks
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return False, "Amount must be a valid number."
    if amount <= 0:
        return False, "Amount must be greater than zero."

    # Category checks
    if not category or not isinstance(category, str):
        return False, "Category is required."

    # Date checks
    if not date or not isinstance(date, str):
        return False, "Date is required."
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return False, "Date must be in YYYY-MM-DD format."

    # Description is optional but must be a string if provided
    if description is not None and not isinstance(description, str):
        return False, "Description must be text."

    return True, None


# ---------------------------------------------------------------------------
# Frontend route
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.route("/api/categories", methods=["GET"])
def get_categories():
    return jsonify(CATEGORIES)


@app.route("/api/expenses", methods=["GET"])
def get_expenses():
    """Return all expenses, most recent first. Supports optional query
    params: category, start_date, end_date for filtering."""
    db = get_db()

    query = "SELECT * FROM expenses WHERE 1=1"
    params = []

    category = request.args.get("category")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if category and category != "All":
        query += " AND category = ?"
        params.append(category)

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    query += " ORDER BY date DESC, id DESC"

    rows = db.execute(query, params).fetchall()
    expenses = [row_to_dict(r) for r in rows]
    return jsonify(expenses)


@app.route("/api/expenses/<int:expense_id>", methods=["GET"])
def get_expense(expense_id):
    db = get_db()
    row = db.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Expense not found."}), 404
    return jsonify(row_to_dict(row))


@app.route("/api/expenses", methods=["POST"])
def add_expense():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "No data provided."}), 400
    is_valid, error = validate_expense_payload(data)
    if not is_valid:
        return jsonify({"error": error}), 400

    description = data.get("description", "")
    if description is None:
        description = ""

    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO expenses (amount, category, date, description, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            float(data["amount"]),
            data["category"],
            data["date"],
            description.strip(),
            datetime.utcnow().isoformat(),
        ),
    )
    db.commit()

    new_row = db.execute(
        "SELECT * FROM expenses WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    return jsonify(row_to_dict(new_row)), 201


@app.route("/api/expenses/<int:expense_id>", methods=["PUT"])
def update_expense(expense_id):
    db = get_db()
    existing = db.execute(
        "SELECT * FROM expenses WHERE id = ?", (expense_id,)
    ).fetchone()
    if existing is None:
        return jsonify({"error": "Expense not found."}), 404

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "No data provided."}), 400
    is_valid, error = validate_expense_payload(data)
    if not is_valid:
        return jsonify({"error": error}), 400

    description = data.get("description", "")
    if description is None:
        description = ""

    db.execute(
        """
        UPDATE expenses
        SET amount = ?, category = ?, date = ?, description = ?
        WHERE id = ?
        """,
        (
            float(data["amount"]),
            data["category"],
            data["date"],
            description.strip(),
            expense_id,
        ),
    )
    db.commit()

    updated_row = db.execute(
        "SELECT * FROM expenses WHERE id = ?", (expense_id,)
    ).fetchone()
    return jsonify(row_to_dict(updated_row))


@app.route("/api/expenses/<int:expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    db = get_db()
    existing = db.execute(
        "SELECT * FROM expenses WHERE id = ?", (expense_id,)
    ).fetchone()
    if existing is None:
        return jsonify({"error": "Expense not found."}), 404

    db.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    db.commit()
    return jsonify({"message": "Expense deleted successfully."})


@app.route("/api/summary", methods=["GET"])
def get_summary():
    """Return totals grouped by category, plus overall totals for the
    dashboard cards and the pie chart."""
    db = get_db()

    rows = db.execute(
        """
        SELECT category, SUM(amount) as total, COUNT(*) as count
        FROM expenses
        GROUP BY category
        ORDER BY total DESC
        """
    ).fetchall()

    by_category = [
        {"category": r["category"], "total": r["total"], "count": r["count"]}
        for r in rows
    ]

    totals = db.execute(
        "SELECT COALESCE(SUM(amount), 0) as grand_total, COUNT(*) as total_count FROM expenses"
    ).fetchone()

    # This month's total
    current_month_prefix = datetime.now().strftime("%Y-%m")
    month_row = db.execute(
        "SELECT COALESCE(SUM(amount), 0) as month_total FROM expenses WHERE date LIKE ?",
        (f"{current_month_prefix}%",),
    ).fetchone()

    return jsonify(
        {
            "by_category": by_category,
            "grand_total": totals["grand_total"],
            "total_count": totals["total_count"],
            "month_total": month_row["month_total"],
        }
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="127.0.0.1", port=5000)
