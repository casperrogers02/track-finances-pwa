// Expenses page functionality
import { expensesAPI, categoriesAPI, getToken, getUser } from './api.js';
import { getIcon } from './icons.js';
import { convert, formatCurrency } from './currency.js';
let currentPage = 1;
const pageSize = 20;
let allExpenses = [];
let filteredExpenses = [];
let currentCurrency = 'UGX';
let categories = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!getToken()) {
        window.location.href = 'login.html';
        return;
    }

    // Load user info
    const user = getUser();
    if (user) {
        currentCurrency = user.preferred_currency || 'UGX';
    }

    // Set default dates BEFORE first load so filters include all recent data
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    document.getElementById('toDate').value = today.toISOString().split('T')[0];
    document.getElementById('fromDate').value = lastMonth.toISOString().split('T')[0];

    // Load categories
    await loadCategories();

    // Load expenses (uses current filters)
    await loadExpenses();

    // Setup event listeners
    document.getElementById('expenseForm').addEventListener('submit', handleSaveExpense);

    // Currency conversion display and auto-convert
    const currencySelect = document.getElementById('expenseCurrency');
    const amountInput = document.getElementById('expenseAmount');

    // Track previous currency to enable conversion
    let previousCurrency = currencySelect ? currencySelect.value : 'UGX';

    if (currencySelect && amountInput) {
        // Store initial value on focus
        currencySelect.addEventListener('focus', () => {
            previousCurrency = currencySelect.value;
        });

        // Convert amount when currency changes
        currencySelect.addEventListener('change', () => {
            const newCurrency = currencySelect.value;
            const currentAmount = parseFloat(amountInput.value);

            if (!isNaN(currentAmount) && previousCurrency !== newCurrency) {
                // Convert based on rates
                const converted = convert(currentAmount, previousCurrency, newCurrency);
                // Update input (2 decimal places for non-UGX, 0 for UGX approx)
                amountInput.value = newCurrency === 'UGX' ? Math.round(converted) : converted.toFixed(2);
            }

            // Update previous currency for next change
            previousCurrency = newCurrency;
            updateCurrencyConversion();
        });

        amountInput.addEventListener('input', updateCurrencyConversion);
    }

    // Set default date
    const dateInput = document.querySelector('#expenseForm input[name="date"]');
    if (dateInput) dateInput.valueAsDate = new Date();
});

// Update currency conversion display
function updateCurrencyConversion() {
    const amountInput = document.getElementById('expenseAmount');
    const currencySelect = document.getElementById('expenseCurrency');
    const conversionDiv = document.getElementById('currencyConversion');

    if (!amountInput || !currencySelect || !conversionDiv) return;

    const amount = parseFloat(amountInput.value);
    const selectedCurrency = currencySelect.value;

    if (!amount || isNaN(amount) || selectedCurrency === 'UGX') {
        conversionDiv.textContent = '';
        return;
    }

    // Convert to UGX (example: 1 USD = 3600 UGX)
    const conversionRates = {
        'USD': 3600,
        'EUR': 3900,
        'GBP': 4500,
        'KES': 25,
        'TZS': 1.5
    };

    const rate = conversionRates[selectedCurrency] || 1;
    const ugxAmount = amount * rate;

    conversionDiv.textContent = `≈ ${formatCurrency(ugxAmount, 'UGX')}`;
}

// Load categories
async function loadCategories() {
    try {
        const response = await categoriesAPI.getAll('expense');
        categories = response.categories || [];
        
        // Cache categories for offline use
        if (navigator.onLine && categories.length > 0) {
            localStorage.setItem('cachedCategories', JSON.stringify(categories));
        }

        const select = document.getElementById('expenseCategory');
        const filterSelect = document.getElementById('categoryFilter');

        // Clear existing options (keep only the first placeholder option)
        while (select.options.length > 1) {
            select.remove(1);
        }
        while (filterSelect.options.length > 1) {
            filterSelect.remove(1);
        }

        categories.forEach(cat => {
            // Create option for expense form dropdown
            const formOption = document.createElement('option');
            formOption.value = cat.name;
            formOption.textContent = cat.name;
            select.appendChild(formOption);

            // Create separate option for filter dropdown
            const filterOption = document.createElement('option');
            filterOption.value = cat.name;
            filterOption.textContent = cat.name;
            filterSelect.appendChild(filterOption);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
        
        // If offline, try to load cached categories
        if (!navigator.onLine || error.message.includes('offline')) {
            const cachedData = localStorage.getItem('cachedCategories');
            if (cachedData) {
                categories = JSON.parse(cachedData);
                
                const select = document.getElementById('expenseCategory');
                const filterSelect = document.getElementById('categoryFilter');

                // Clear existing options (keep only the first placeholder option)
                while (select.options.length > 1) {
                    select.remove(1);
                }
                while (filterSelect.options.length > 1) {
                    filterSelect.remove(1);
                }

                categories.forEach(cat => {
                    // Create option for expense form dropdown
                    const formOption = document.createElement('option');
                    formOption.value = cat.name;
                    formOption.textContent = cat.name;
                    select.appendChild(formOption);

                    // Create separate option for filter dropdown
                    const filterOption = document.createElement('option');
                    filterOption.value = cat.name;
                    filterOption.textContent = cat.name;
                    filterSelect.appendChild(filterOption);
                });
                
                showNotification('Using cached categories - will sync when online', 'info');
                return;
            }
        }
        
        showNotification('Error loading categories', 'error');
    }
}

// Load expenses
async function loadExpenses() {
    try {
        const from = document.getElementById('fromDate').value;
        const to = document.getElementById('toDate').value;

        const response = await expensesAPI.getAll({
            from: from || undefined,
            to: to || undefined,
            limit: 10000
        });

        allExpenses = response.expenses || [];
        
        // Cache the data for offline use
        if (navigator.onLine && allExpenses.length > 0) {
            localStorage.setItem('cachedExpenses', JSON.stringify(allExpenses));
        }
        
        applyFilters();
    } catch (error) {
        console.error('Error loading expenses:', error);
        
        // If offline, try to load cached data
        if (!navigator.onLine || error.message.includes('offline')) {
            const cachedData = localStorage.getItem('cachedExpenses');
            if (cachedData) {
                allExpenses = JSON.parse(cachedData);
                applyFilters();
                showNotification('Using cached data - will sync when online', 'info');
                return;
            }
        }
        
        showNotification('Error loading expenses', 'error');
    }
}

// Apply filters
function applyFilters() {
    const category = document.getElementById('categoryFilter').value;
    const search = document.getElementById('searchInput').value.toLowerCase();

    filteredExpenses = allExpenses.filter(exp => {
        const matchCategory = !category || exp.category === category;
        const matchSearch = !search ||
            exp.category.toLowerCase().includes(search) ||
            (exp.description && exp.description.toLowerCase().includes(search));

        return matchCategory && matchSearch;
    });

    currentPage = 1;
    renderExpenses();
    renderPagination();
}

// Render expenses with auto-detected indicator
function renderExpenses() {
    const tbody = document.getElementById('expensesTable');
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageExpenses = filteredExpenses.slice(start, end);

    if (pageExpenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No expenses found</td></tr>';
        return;
    }

    tbody.innerHTML = pageExpenses.map(exp => {
        const convertedAmount = convert(parseFloat(exp.amount), exp.currency, currentCurrency);
        const isAutoDetected = exp.source_type === 'sms_sync' || exp.source_type === 'statement_upload';
        return `
            <tr>
                <td>${new Date(exp.date).toLocaleDateString()}</td>
                <td>
                    ${exp.category}
                    ${isAutoDetected ? `<span style="display: inline-flex; align-items: center; justify-content: center; color: var(--accent-teal); margin-left: 4px;" title="Auto-detected">${getIcon('ai')}</span>` : ''}
                </td>
                <td>${exp.description || '-'}</td>
                <td>${formatCurrency(convertedAmount, currentCurrency)}</td>
                <td>${exp.currency}</td>
                <td>
                    <div class="table-actions">
                        <button onclick="editExpense(${exp.id})" title="Edit" style="background: none; border: none; color: var(--accent-blue); cursor: pointer; padding: 6px;">${getIcon('edit')}</button>
                        <button onclick="deleteExpense(${exp.id})" title="Delete" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 6px;">${getIcon('trash')}</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Render pagination
function renderPagination() {
    const container = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredExpenses.length / pageSize);

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    // Previous button
    html += `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>`;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button onclick="goToPage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span>...</span>`;
        }
    }

    // Next button
    html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;

    container.innerHTML = html;
}

// Go to page
function goToPage(page) {
    const totalPages = Math.ceil(filteredExpenses.length / pageSize);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderExpenses();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Handle save expense
async function handleSaveExpense(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const expenseId = formData.get('id');
    const data = {
        amount: parseFloat(formData.get('amount')),
        currency: formData.get('currency'),
        category: formData.get('category'),
        description: formData.get('description') || null,
        date: formData.get('date')
    };

    try {
        if (expenseId) {
            // For updates, use offline API wrapper
            const result = await window.offlineQueue.offlineApiCall(
                (data) => expensesAPI.update(expenseId, data),
                'update',
                'expense',
                { ...data, id: expenseId }
            );
            
            if (result.offline) {
                showNotification(result.message, 'info');
            } else {
                showNotification('Expense updated successfully', 'success');
            }
        } else {
            // For new expenses, use offline API wrapper
            const result = await window.offlineQueue.offlineApiCall(
                expensesAPI.create,
                'create',
                'expense',
                data
            );
            
            if (result.offline) {
                showNotification(result.message, 'info');
            } else {
                showNotification('Expense added successfully', 'success');
            }
        }
        
        if (typeof window.updateNotificationBadge === 'function') window.updateNotificationBadge();
        closeModal();
        await loadExpenses();
    } catch (error) {
        showNotification(error.message || 'Error saving expense', 'error');
    }
}

// Edit expense
function editExpense(id) {
    const expense = allExpenses.find(e => e.id === id);
    if (!expense) return;

    // Do NOT reset the form here, just populate fields
    document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
    document.getElementById('expenseId').value = expense.id;
    document.querySelector('#expenseForm input[name="amount"]').value = expense.amount;
    document.querySelector('#expenseForm select[name="currency"]').value = expense.currency;
    document.querySelector('#expenseForm select[name="category"]').value = expense.category;
    document.querySelector('#expenseForm textarea[name="description"]').value = expense.description || '';
    document.querySelector('#expenseForm input[name="date"]').value = expense.date;

    // Open modal without clearing hidden id
    document.getElementById('expenseModal').classList.add('active');
}

// Delete expense
async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
        await expensesAPI.delete(id);
        showNotification('Expense deleted successfully', 'success');
        await loadExpenses();
    } catch (error) {
        showNotification(error.message || 'Error deleting expense', 'error');
    }
}

// Export CSV
async function exportCSV() {
    try {
        const from = document.getElementById('fromDate').value;
        const to = document.getElementById('toDate').value;

        const response = await reportsAPI.export('month', 'csv');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses-${from}-to-${to}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        showNotification('Error exporting CSV', 'error');
    }
}

// Modal functions
function openAddModal() {
    const modal = document.getElementById('expenseModal');
    if (!modal) return;

    modal.classList.add('active');
    const title = document.getElementById('expenseModalTitle');
    if (title) title.textContent = 'Add Expense';
    const form = document.getElementById('expenseForm');
    if (form) {
        form.reset();
        const dateInput = form.querySelector('input[name="date"]');
        if (dateInput) dateInput.valueAsDate = new Date();
    }
    const idInput = document.getElementById('expenseId');
    if (idInput) idInput.value = '';

    // Clear currency conversion
    const conversionDiv = document.getElementById('currencyConversion');
    if (conversionDiv) conversionDiv.textContent = '';
}

function closeExpenseModal() {
    const modal = document.getElementById('expenseModal');
    if (!modal) return;

    modal.classList.remove('active');
    const form = document.getElementById('expenseForm');
    if (form) form.reset();
    const idInput = document.getElementById('expenseId');
    if (idInput) idInput.value = '';

    // Clear currency conversion
    const conversionDiv = document.getElementById('currencyConversion');
    if (conversionDiv) conversionDiv.textContent = '';
}

// Alias for backward compatibility
function closeModal() {
    closeExpenseModal();
}

// Close modal on outside click
const expenseModalEl = document.getElementById('expenseModal');
if (expenseModalEl) {
    expenseModalEl.addEventListener('click', (e) => {
        if (e.target.id === 'expenseModal') closeModal();
    });
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        authAPI.logout().catch(() => { });
        removeToken();
        window.location.href = 'login.html';
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Make functions available globally
window.editExpense = editExpense;
window.deleteExpense = deleteExpense;
window.openAddModal = openAddModal;
window.closeExpenseModal = closeExpenseModal;
window.closeModal = closeModal;
window.goToPage = goToPage;
window.applyFilters = applyFilters;
window.exportCSV = exportCSV;



