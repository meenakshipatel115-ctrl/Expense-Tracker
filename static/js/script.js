/* ============================================================
   Expense Tracker - Frontend Logic
   Handles navigation, form submission, table rendering,
   filtering, editing/deleting, and the category pie chart.
   ============================================================ */

const API_BASE = "/api";

// Rupee currency formatter
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDateDisplay(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------

let categories = [];
let allExpenses = [];
let pieChart = null;
let editingExpenseId = null; // null = create mode, otherwise editing this id

// Distinct color palette for the pie chart slices
const CHART_COLORS = [
  "#4361ee", "#f72585", "#4cc9f0", "#f9c74f", "#43aa8b",
  "#f8961e", "#577590", "#9b5de5", "#e5484d", "#2e9e5b",
];

// ---------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------

const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".section");
const pageTitle = document.getElementById("page-title");

const expenseForm = document.getElementById("expense-form");
const amountInput = document.getElementById("amount");
const categorySelect = document.getElementById("category");
const dateInput = document.getElementById("date");
const descriptionInput = document.getElementById("description");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const formMessage = document.getElementById("form-message");

const statTotal = document.getElementById("stat-total");
const statMonth = document.getElementById("stat-month");
const statCount = document.getElementById("stat-count");
const statTopCategory = document.getElementById("stat-top-category");

const recentList = document.getElementById("recent-list");
const chartEmpty = document.getElementById("chart-empty");

const expenseTableBody = document.getElementById("expense-table-body");
const tableEmpty = document.getElementById("table-empty");

const filterCategory = document.getElementById("filter-category");
const filterStart = document.getElementById("filter-start");
const filterEnd = document.getElementById("filter-end");
const filterApplyBtn = document.getElementById("filter-apply");
const filterResetBtn = document.getElementById("filter-reset");

const toast = document.getElementById("toast");

// ---------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const target = link.dataset.target;
    navigateTo(target);
  });
});

function navigateTo(target) {
  navLinks.forEach((l) => l.classList.toggle("active", l.dataset.target === target));
  sections.forEach((s) => s.classList.toggle("active", s.id === target));
  pageTitle.textContent = {
    dashboard: "Dashboard",
    "add-expense": "Add Expense",
    history: "History",
  }[target];

  if (target === "dashboard") refreshDashboard();
  if (target === "history") refreshHistory();
}

// ---------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------

let toastTimeout = null;
function showToast(message, type = "success") {
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  setTodayDate();
  dateInput.value = new Date().toISOString().slice(0, 10);
  await loadCategories();
  await refreshDashboard();
  await refreshHistory();
});

function setTodayDate() {
  const el = document.getElementById("today-date");
  el.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    categories = await res.json();

    categorySelect.innerHTML =
      '<option value="" disabled selected>Select category</option>' +
      categories.map((c) => `<option value="${c}">${c}</option>`).join("");

    filterCategory.innerHTML =
      '<option value="All">All Categories</option>' +
      categories.map((c) => `<option value="${c}">${c}</option>`).join("");
  } catch (err) {
    console.error("Failed to load categories", err);
    showToast("Could not load categories from server.", "error");
  }
}

// ---------------------------------------------------------------
// Form: Add / Edit expense
// ---------------------------------------------------------------

expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMessage.textContent = "";
  formMessage.className = "form-message";

  const payload = {
    amount: parseFloat(amountInput.value),
    category: categorySelect.value,
    date: dateInput.value,
    description: descriptionInput.value.trim(),
  };

  if (!payload.category) {
    formMessage.textContent = "Please select a category.";
    formMessage.classList.add("error");
    return;
  }

  try {
    let res;
    if (editingExpenseId) {
      res = await fetch(`${API_BASE}/expenses/${editingExpenseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`${API_BASE}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json();

    if (!res.ok) {
      formMessage.textContent = data.error || "Something went wrong.";
      formMessage.classList.add("error");
      return;
    }

    formMessage.textContent = editingExpenseId
      ? "Expense updated successfully."
      : "Expense added successfully.";
    formMessage.classList.add("success");
    showToast(editingExpenseId ? "Expense updated." : "Expense added.", "success");

    resetForm();
    await refreshDashboard();
    await refreshHistory();
  } catch (err) {
    console.error(err);
    formMessage.textContent = "Network error. Please try again.";
    formMessage.classList.add("error");
  }
});

cancelEditBtn.addEventListener("click", () => {
  resetForm();
});

function resetForm() {
  expenseForm.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
  editingExpenseId = null;
  submitBtn.textContent = "Add Expense";
  cancelEditBtn.classList.add("hidden");
}

function startEdit(expense) {
  editingExpenseId = expense.id;
  amountInput.value = expense.amount;
  categorySelect.value = expense.category;
  dateInput.value = expense.date;
  descriptionInput.value = expense.description || "";
  submitBtn.textContent = "Save Changes";
  cancelEditBtn.classList.remove("hidden");
  navigateTo("add-expense");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------------------------------------------------------
// Delete expense
// ---------------------------------------------------------------

async function deleteExpense(id) {
  if (!confirm("Delete this expense? This cannot be undone.")) return;

  try {
    const res = await fetch(`${API_BASE}/expenses/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Could not delete expense.", "error");
      return;
    }

    showToast("Expense deleted.", "success");
    await refreshDashboard();
    await refreshHistory();
  } catch (err) {
    console.error(err);
    showToast("Network error while deleting.", "error");
  }
}

// ---------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------

async function refreshDashboard() {
  try {
    const [summaryRes, expensesRes] = await Promise.all([
      fetch(`${API_BASE}/summary`),
      fetch(`${API_BASE}/expenses`),
    ]);
    const summary = await summaryRes.json();
    const expenses = await expensesRes.json();
    allExpenses = expenses;

    statTotal.textContent = formatCurrency(summary.grand_total);
    statMonth.textContent = formatCurrency(summary.month_total);
    statCount.textContent = summary.total_count;
    statTopCategory.textContent =
      summary.by_category.length > 0 ? summary.by_category[0].category : "—";

    renderPieChart(summary.by_category);
    renderRecentList(expenses.slice(0, 6));
  } catch (err) {
    console.error("Failed to refresh dashboard", err);
    showToast("Could not load dashboard data.", "error");
  }
}

function renderPieChart(byCategory) {
  const ctx = document.getElementById("categoryPieChart").getContext("2d");

  if (byCategory.length === 0) {
    chartEmpty.classList.remove("hidden");
    if (pieChart) {
      pieChart.destroy();
      pieChart = null;
    }
    return;
  }

  chartEmpty.classList.add("hidden");

  const labels = byCategory.map((c) => c.category);
  const values = byCategory.map((c) => c.total);
  const colors = byCategory.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (pieChart) {
    pieChart.data.labels = labels;
    pieChart.data.datasets[0].data = values;
    pieChart.data.datasets[0].backgroundColor = colors;
    pieChart.update();
    return;
  }

  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 1,
          borderColor: "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, font: { size: 12 } },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed;
              return ` ${context.label}: ${formatCurrency(value)}`;
            },
          },
        },
      },
    },
  });
}

function renderRecentList(expenses) {
  if (expenses.length === 0) {
    recentList.innerHTML = `<div class="empty-state">No expenses yet.</div>`;
    return;
  }

  recentList.innerHTML = expenses
    .map(
      (exp) => `
      <div class="recent-item">
        <div class="ri-left">
          <span class="ri-desc">${escapeHtml(exp.description) || exp.category}</span>
          <span class="ri-meta">${exp.category} · ${formatDateDisplay(exp.date)}</span>
        </div>
        <div class="ri-amount">${formatCurrency(exp.amount)}</div>
      </div>
    `
    )
    .join("");
}

// ---------------------------------------------------------------
// History table + filters
// ---------------------------------------------------------------

async function refreshHistory() {
  await loadExpensesIntoTable();
}

async function loadExpensesIntoTable(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.category && params.category !== "All") query.set("category", params.category);
    if (params.start_date) query.set("start_date", params.start_date);
    if (params.end_date) query.set("end_date", params.end_date);

    const res = await fetch(`${API_BASE}/expenses?${query.toString()}`);
    const expenses = await res.json();

    renderTable(expenses);
  } catch (err) {
    console.error("Failed to load expenses", err);
    showToast("Could not load expense history.", "error");
  }
}

function renderTable(expenses) {
  if (expenses.length === 0) {
    expenseTableBody.innerHTML = "";
    tableEmpty.classList.remove("hidden");
    return;
  }

  tableEmpty.classList.add("hidden");

  expenseTableBody.innerHTML = expenses
    .map(
      (exp) => `
      <tr data-id="${exp.id}">
        <td>${formatDateDisplay(exp.date)}</td>
        <td><span class="category-badge">${escapeHtml(exp.category)}</span></td>
        <td>${escapeHtml(exp.description) || "-"}</td>
        <td class="align-right">${formatCurrency(exp.amount)}</td>
        <td class="align-center">
          <div class="row-actions">
            <button class="icon-btn edit" data-action="edit" data-id="${exp.id}">Edit</button>
            <button class="icon-btn delete" data-action="delete" data-id="${exp.id}">Delete</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  // Attach action handlers
  expenseTableBody.querySelectorAll("[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.id, 10);
      const expense = allExpenses.find((e) => e.id === id) || findInTable(id);
      if (expense) startEdit(expense);
    });
  });

  expenseTableBody.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.id, 10);
      deleteExpense(id);
    });
  });
}

function findInTable(id) {
  // Fallback lookup in case allExpenses (dashboard cache) doesn't have it
  return allExpenses.find((e) => e.id === id);
}

filterApplyBtn.addEventListener("click", () => {
  loadExpensesIntoTable({
    category: filterCategory.value,
    start_date: filterStart.value,
    end_date: filterEnd.value,
  });
});

filterResetBtn.addEventListener("click", () => {
  filterCategory.value = "All";
  filterStart.value = "";
  filterEnd.value = "";
  loadExpensesIntoTable();
});

// ---------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
