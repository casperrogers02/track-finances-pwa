// Income page functionality
import { incomeAPI, goalsAPI, categoriesAPI, goalAllocationsAPI, getToken, getUser } from './api.js';
import { getIcon } from './icons.js';
import { convert, formatCurrency } from './currency.js';

let currentPage = 1;
const pageSize = 20;
let allIncome = [];
let filteredIncome = [];
let currentCurrency = 'UGX';
let sources = [];

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

    // Load sources
    await loadSources();

    // Load income (uses current filters)
    await loadIncome();

    // Setup event listeners
    const incomeForm = document.getElementById('incomeForm');
    if (incomeForm) {
        incomeForm.addEventListener('submit', handleSaveIncome);
    }

    // Currency conversion auto-convert
    const currencySelect = document.querySelector('#incomeForm select[name="currency"]');
    const amountInput = document.querySelector('#incomeForm input[name="amount"]');

    // Track previous currency
    let previousCurrency = currencySelect ? currencySelect.value : 'UGX';

    if (currencySelect && amountInput) {
        currencySelect.addEventListener('focus', () => {
            previousCurrency = currencySelect.value;
        });

        currencySelect.addEventListener('change', () => {
            const newCurrency = currencySelect.value;
            const currentAmount = parseFloat(amountInput.value);

            if (!isNaN(currentAmount) && previousCurrency !== newCurrency) {
                const converted = convert(currentAmount, previousCurrency, newCurrency);
                amountInput.value = newCurrency === 'UGX' ? Math.round(converted) : converted.toFixed(2);
            }
            previousCurrency = newCurrency;

            // Also update goal allocation info if needed
            if (typeof updateGoalAllocationInfo === 'function') {
                updateGoalAllocationInfo();
            }
        });
    }

    // Load goals for allocation dropdown
    loadGoalsForAllocation();

    // Setup amount input listener for goal allocation
    const goalAmountInput = document.getElementById('goalAmount');
    const goalSelect = document.getElementById('goalSelect');

    if (amountInput) {
        amountInput.addEventListener('input', () => {
            updateGoalAllocationInfo();
            // Auto-fill goal amount with total if not set
            if (goalAmountInput && !goalAmountInput.value) {
                const total = parseFloat(amountInput.value) || 0;
                if (total > 0 && goalSelect && goalSelect.value) {
                    goalAmountInput.value = total;
                    updateGoalAllocationInfo();
                }
            }
        });
    }
    if (goalAmountInput) {
        goalAmountInput.addEventListener('input', updateGoalAllocationInfo);
    }
    if (goalSelect) {
        goalSelect.addEventListener('change', () => {
            updateGoalAllocationInfo();
            // Auto-fill with total amount when goal is selected
            if (amountInput && goalAmountInput) {
                const total = parseFloat(amountInput.value) || 0;
                if (total > 0 && !goalAmountInput.value) {
                    goalAmountInput.value = total;
                    updateGoalAllocationInfo();
                }
            }
        });
    }
});

// Load sources
async function loadSources() {
    try {
        const response = await categoriesAPI.getAll('income');
        sources = response.categories || [];
        
        // Cache sources for offline use
        if (navigator.onLine && sources.length > 0) {
            localStorage.setItem('cachedIncomeSources', JSON.stringify(sources));
        }

        const select = document.getElementById('incomeSource');
        const filterSelect = document.getElementById('sourceFilter');

        // Clear existing options (keep only the first placeholder option)
        while (select.options.length > 1) {
            select.remove(1);
        }
        while (filterSelect.options.length > 1) {
            filterSelect.remove(1);
        }

        sources.forEach(src => {
            // Create option for income form dropdown
            const formOption = document.createElement('option');
            formOption.value = src.name;
            formOption.textContent = src.name;
            select.appendChild(formOption);

            // Create separate option for filter dropdown
            const filterOption = document.createElement('option');
            filterOption.value = src.name;
            filterOption.textContent = src.name;
            filterSelect.appendChild(filterOption);
        });
    } catch (error) {
        console.error('Error loading sources:', error);
        
        // If offline, try to load cached sources
        if (!navigator.onLine || error.message.includes('offline')) {
            const cachedData = localStorage.getItem('cachedIncomeSources');
            if (cachedData) {
                sources = JSON.parse(cachedData);
                
                const select = document.getElementById('incomeSource');
                const filterSelect = document.getElementById('sourceFilter');

                // Clear existing options (keep only the first placeholder option)
                while (select.options.length > 1) {
                    select.remove(1);
                }
                while (filterSelect.options.length > 1) {
                    filterSelect.remove(1);
                }

                sources.forEach(src => {
                    // Create option for income form dropdown
                    const formOption = document.createElement('option');
                    formOption.value = src.name;
                    formOption.textContent = src.name;
                    select.appendChild(formOption);

                    // Create separate option for filter dropdown
                    const filterOption = document.createElement('option');
                    filterOption.value = src.name;
                    filterOption.textContent = src.name;
                    filterSelect.appendChild(filterOption);
                });
                
                showNotification('Using cached sources - will sync when online', 'info');
                return;
            }
        }
        
        showNotification('Error loading sources', 'error');
    }
}

// Load income
async function loadIncome() {
    try {
        const from = document.getElementById('fromDate').value;
        const to = document.getElementById('toDate').value;

        const response = await incomeAPI.getAll({
            from: from || undefined,
            to: to || undefined,
            limit: 10000
        });

        allIncome = response.income || [];
        
        // Cache the data for offline use
        if (navigator.onLine && allIncome.length > 0) {
            localStorage.setItem('cachedIncome', JSON.stringify(allIncome));
        }
        
        applyFilters();
    } catch (error) {
        console.error('Error loading income:', error);
        
        // If offline, try to load cached data
        if (!navigator.onLine || error.message.includes('offline')) {
            const cachedData = localStorage.getItem('cachedIncome');
            if (cachedData) {
                allIncome = JSON.parse(cachedData);
                applyFilters();
                showNotification('Using cached data - will sync when online', 'info');
                return;
            }
        }
        
        showNotification('Error loading income', 'error');
    }
}

// Apply filters
function applyFilters() {
    const source = document.getElementById('sourceFilter')?.value || '';
    const searchInput = document.getElementById('searchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : '';

    filteredIncome = allIncome.filter(inc => {
        const matchSource = !source || inc.source === source;
        const matchSearch = !search ||
            inc.source.toLowerCase().includes(search) ||
            (inc.date && inc.date.includes(search));

        return matchSource && matchSearch;
    });

    currentPage = 1;
    renderIncome();
    renderPagination();
}

// Render income
function renderIncome() {
    const tbody = document.getElementById('incomeTable');
    if (!tbody) return;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageIncome = filteredIncome.slice(start, end);

    if (pageIncome.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No income records found. Add your first income entry to get started!</td></tr>';
        return;
    }

    tbody.innerHTML = pageIncome.map(inc => {
        const convertedAmount = convert(parseFloat(inc.amount), inc.currency, currentCurrency);
        const isAutoDetected = inc.source_type === 'sms_sync' || inc.source_type === 'statement_upload';
        return `
            <tr>
                <td data-label="Date">${new Date(inc.date).toLocaleDateString()}</td>
                <td data-label="Source">
                    <strong>${inc.source}</strong>
                    ${isAutoDetected ? `<span style="display: inline-flex; align-items: center; justify-content: center; color: var(--accent-teal); margin-left: 4px;" title="Auto-detected">${getIcon('ai')}</span>` : ''}
                </td>
                <td data-label="Amount" style="color: var(--success); font-weight: 600; font-size: 15px;">+ ${formatCurrency(convertedAmount, currentCurrency)}</td>
                <td data-label="Currency">${inc.currency}</td>
                <td data-label="Actions">
                    <button onclick="editIncome(${inc.id})" title="Edit" style="background: none; border: none; color: var(--accent-blue); cursor: pointer; padding: 6px; font-size: 16px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">${getIcon('edit')}</button>
                    <button onclick="deleteIncome(${inc.id})" title="Delete" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 6px; font-size: 16px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">${getIcon('trash')}</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render pagination
function renderPagination() {
    const container = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredIncome.length / pageSize);

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
    const totalPages = Math.ceil(filteredIncome.length / pageSize);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderIncome();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Load goals for allocation dropdown
async function loadGoalsForAllocation() {
    try {
        const response = await goalsAPI.getAll();
        const goals = response.goals || [];
        const goalSelect = document.getElementById('goalSelect');

        if (goalSelect) {
            // Clear existing options except first
            goalSelect.innerHTML = '<option value="">Select a goal...</option>';

            goals.forEach(goal => {
                const option = document.createElement('option');
                option.value = goal.id;
                option.textContent = `${goal.title} (Target: ${formatCurrency(parseFloat(goal.target_amount), goal.currency || 'UGX')})`;
                goalSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

// Toggle goal allocation section
function toggleGoalAllocation() {
    const checkbox = document.getElementById('allocateToGoal');
    const section = document.getElementById('goalAllocationSection');
    if (checkbox && section) {
        section.style.display = checkbox.checked ? 'block' : 'none';
        if (checkbox.checked) {
            loadGoalsForAllocation();
        }
    }
}

// Update goal allocation info
function updateGoalAllocationInfo() {
    const amountInput = document.querySelector('#incomeForm input[name="amount"]');
    const goalAmountInput = document.getElementById('goalAmount');
    const goalSelect = document.getElementById('goalSelect');
    const infoDiv = document.getElementById('goalAllocationInfo');

    if (!amountInput || !goalAmountInput || !goalSelect || !infoDiv) return;

    const totalAmount = parseFloat(amountInput.value) || 0;
    let allocatedAmount = parseFloat(goalAmountInput.value) || 0;
    const selectedGoalId = goalSelect.value;

    // Set max to total amount
    if (goalAmountInput) {
        goalAmountInput.max = totalAmount;
        if (allocatedAmount > totalAmount) {
            allocatedAmount = totalAmount;
            goalAmountInput.value = totalAmount;
        }
    }

    if (selectedGoalId && totalAmount > 0) {
        const percentage = ((allocatedAmount / totalAmount) * 100).toFixed(1);
        const remaining = totalAmount - allocatedAmount;
        infoDiv.innerHTML = `
            <div style="color: var(--accent-teal); font-size: 12px;">
                Allocating ${percentage}% (${formatCurrency(allocatedAmount, currentCurrency)})<br>
                <span style="color: var(--text-secondary);">Remaining: ${formatCurrency(remaining, currentCurrency)}</span>
            </div>
        `;
    } else if (totalAmount > 0) {
        infoDiv.innerHTML = `
            <div style="color: var(--text-secondary); font-size: 12px;">
                Select a goal and enter amount to allocate
            </div>
        `;
    } else {
        infoDiv.innerHTML = '';
    }
}

// Handle save income with goal allocation
async function handleSaveIncome(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const incomeId = formData.get('id');
    const allocateToGoal = formData.get('allocateToGoal') === 'on';
    const goalId = formData.get('goalId');
    const goalAmount = parseFloat(formData.get('goalAmount')) || 0;

    const data = {
        amount: parseFloat(formData.get('amount')),
        currency: formData.get('currency'),
        source: formData.get('source'),
        date: formData.get('date')
    };

    try {
        let savedIncome;
        if (incomeId) {
            // Update the income record using offline API wrapper
            const result = await window.offlineQueue.offlineApiCall(
                (data) => incomeAPI.update(incomeId, data),
                'update',
                'income',
                { ...data, id: incomeId }
            );

            // Handle Goal Allocations for Edit (only if online)
            if (!result.offline) {
                // 1. Always remove existing allocations first (clean slate)
                try {
                    await goalAllocationsAPI.deleteByIncome(incomeId);
                    // Also clear local storage backup
                    const incomeIdStr = String(incomeId);
                    let allAllocations = JSON.parse(localStorage.getItem('goalAllocations') || '{}');
                    if (allAllocations[incomeIdStr]) {
                        delete allAllocations[incomeIdStr];
                        localStorage.setItem('goalAllocations', JSON.stringify(allAllocations));
                    }
                } catch (err) {
                    console.error('Error clearing old allocations:', err);
                }

                // 2. If allocation is selected, create new allocation
                if (allocateToGoal && goalId && goalAmount > 0) {
                    // Pass incomeId directly since we are editing
                    await allocateIncomeToGoal(goalId, goalAmount, data.currency, incomeId);
                    showNotification('Income updated and allocated to goal', 'success');
                } else {
                    showNotification('Income updated successfully', 'success');
                }
            } else {
                showNotification(result.message, 'info');
            }
        } else {
            // Create new income using offline API wrapper
            const result = await window.offlineQueue.offlineApiCall(
                incomeAPI.create,
                'create',
                'income',
                data
            );
            
            if (!result.offline) {
                savedIncome = result;
                showNotification('Income added successfully', 'success');

                // Get the actual income ID from response
                const actualIncomeId = savedIncome?.id || savedIncome?.income?.id || savedIncome?.data?.id;
                const incomeRecordForAllocation = actualIncomeId || savedIncome;

                // Handle goal allocation (manual takes priority over auto)
                if (allocateToGoal && goalId && goalAmount > 0) {
                    await allocateIncomeToGoal(goalId, goalAmount, data.currency, incomeRecordForAllocation);
                    // Process auto-allocation for other goals (excluding the manually allocated goal)
                    const remainingAmount = data.amount - goalAmount;
                    if (remainingAmount > 0) {
                        await processAutoAllocationRules(remainingAmount, data.currency, incomeRecordForAllocation, goalId);
                    }
                } else {
                    // Check for auto-allocation rules (full amount)
                    await processAutoAllocationRules(data.amount, data.currency, incomeRecordForAllocation);
                }
            } else {
                showNotification(result.message, 'info');
            }
        }

        closeModal();
        await loadIncome();

        if (typeof window.updateNotificationBadge === 'function') window.updateNotificationBadge();

        // Refresh dashboard notifications if on dashboard
        if (typeof loadNotifications === 'function') {
            setTimeout(() => loadNotifications(), 1000);
        }
    } catch (error) {
        showNotification(error.message || 'Error saving income', 'error');
    }
}

// Allocate income to goal - Creates goal_allocation record instead of updating progress
async function allocateIncomeToGoal(goalId, amount, currency, incomeRecord) {
    try {
        // Get goal details
        const goalsRes = await goalsAPI.getAll();
        const goals = goalsRes.goals || [];
        const goal = goals.find(g => g.id == goalId);

        if (!goal) {
            showNotification('Goal not found', 'error');
            return;
        }

        // Get income ID
        let incomeId = null;
        if (incomeRecord) {
            if (typeof incomeRecord === 'object') {
                incomeId = incomeRecord.id || incomeRecord.income?.id || incomeRecord.income_id;
            } else {
                incomeId = incomeRecord;
            }
        }

        if (!incomeId) {
            console.error('Could not determine income ID for allocation');
            showNotification('Error: Income ID not found', 'error');
            return;
        }

        // Convert amount to goal's currency
        const goalCurrency = goal.currency || 'UGX';
        const convertedAmount = convert(amount, currency, goalCurrency);
        const target = parseFloat(goal.target_amount);

        // Create goal_allocation record (not update goal progress)
        try {
            await goalAllocationsAPI.create({
                income_id: incomeId,
                goal_id: goalId,
                amount: convertedAmount,
                currency: goalCurrency,
            });
        } catch (apiError) {
            console.error('API error, saving locally:', apiError);
            // Fallback to localStorage
        }

        // Always save locally as backup
        saveGoalAllocationRecord(incomeId, goalId, convertedAmount, goalCurrency);

        // Calculate new progress from all allocations
        const currentProgress = await calculateGoalProgressFromLocal(goalId);
        const newProgress = currentProgress + convertedAmount;
        const percentage = target > 0 ? ((newProgress / target) * 100).toFixed(1) : '0';

        // Show notification
        showNotification(
            `✅ ${formatCurrency(convertedAmount, goalCurrency)} allocated to "${goal.title}". Progress: ${percentage}%`,
            'success'
        );

        // Save allocation in localStorage for notifications
        saveGoalAllocationNotification(goal, convertedAmount, newProgress, target);

    } catch (error) {
        console.error('Error allocating to goal:', error);
        showNotification('Error allocating to goal: ' + error.message, 'error');
    }
}

// Calculate goal progress from local storage
async function calculateGoalProgressFromLocal(goalId) {
    try {
        const allocations = JSON.parse(localStorage.getItem('goalAllocations') || '{}');
        let totalProgress = 0;

        // Sum all allocations for this goal
        Object.values(allocations).forEach(incomeAllocations => {
            if (Array.isArray(incomeAllocations)) {
                incomeAllocations.forEach(allocation => {
                    if (String(allocation.goalId) === String(goalId)) {
                        totalProgress += parseFloat(allocation.amount) || 0;
                    }
                });
            }
        });

        return totalProgress;
    } catch (error) {
        console.error('Error calculating from local:', error);
        return 0;
    }
}

// Save goal allocation record for tracking
function saveGoalAllocationRecord(incomeId, goalId, amount, currency) {
    try {
        // Convert incomeId to string for consistent key storage
        const incomeIdStr = String(incomeId);
        let allocations = JSON.parse(localStorage.getItem('goalAllocations') || '{}');
        if (!allocations[incomeIdStr]) {
            allocations[incomeIdStr] = [];
        }
        allocations[incomeIdStr].push({
            goalId: String(goalId),
            amount: parseFloat(amount),
            currency: currency,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('goalAllocations', JSON.stringify(allocations));
        console.log('Saved allocation record:', allocations[incomeIdStr]);
    } catch (error) {
        console.error('Error saving allocation record:', error);
    }
}

// Get goal allocations for an income
function getGoalAllocations(incomeId) {
    try {
        // Convert incomeId to string for consistent lookup
        const incomeIdStr = String(incomeId);
        const allocations = JSON.parse(localStorage.getItem('goalAllocations') || '{}');
        const result = allocations[incomeIdStr] || [];
        console.log('Retrieved allocations for income', incomeIdStr, ':', result);
        return result;
    } catch (error) {
        console.error('Error getting allocations:', error);
        return [];
    }
}

// Delete goal allocations when income is deleted
async function deleteGoalAllocationsForIncome(incomeId) {
    try {
        const allocations = getGoalAllocations(incomeId);
        if (allocations.length === 0) {
            console.log('No allocations found for income:', incomeId);
            return;
        }

        console.log('Deleting allocations for income:', incomeId, allocations);

        // Delete from backend
        try {
            await goalAllocationsAPI.deleteByIncome(incomeId);
        } catch (apiError) {
            console.error('API error, deleting locally:', apiError);
            // Continue with local deletion
        }

        // Get goals for notification
        const goalsRes = await goalsAPI.getAll();
        const goals = goalsRes.goals || [];

        // Show notifications
        for (const allocation of allocations) {
            const goal = goals.find(g => g.id == allocation.goalId);
            if (goal) {
                showNotification(
                    `Goal "${goal.title}" allocation removed: ${formatCurrency(allocation.amount, allocation.currency)}`,
                    'info'
                );
            }
        }

        // Remove allocation records from localStorage
        const incomeIdStr = String(incomeId);
        let allAllocations = JSON.parse(localStorage.getItem('goalAllocations') || '{}');
        delete allAllocations[incomeIdStr];
        localStorage.setItem('goalAllocations', JSON.stringify(allAllocations));
        console.log('Removed allocation records for income:', incomeIdStr);

    } catch (error) {
        console.error('Error deleting goal allocations:', error);
        showNotification('Error deleting goal allocations: ' + error.message, 'error');
    }
}

// Get auto-allocation rules
function getAutoAllocationRules() {
    try {
        return JSON.parse(localStorage.getItem('goalAutoAllocationRules') || '{}');
    } catch (error) {
        return {};
    }
}

// Process auto-allocation rules
async function processAutoAllocationRules(incomeAmount, incomeCurrency, incomeRecord, excludeGoalId = null) {
    try {
        const rules = getAutoAllocationRules();
        const goalsRes = await goalsAPI.getAll();
        const goals = goalsRes.goals || [];
        const incomeId = incomeRecord?.id || incomeRecord?.income?.id || incomeRecord;

        for (const [goalId, percentage] of Object.entries(rules)) {
            // Skip if this goal was manually allocated
            if (excludeGoalId && goalId == excludeGoalId) continue;

            const goal = goals.find(g => g.id == goalId);
            if (!goal) continue;

            // Calculate allocation amount
            const allocationAmount = (incomeAmount * percentage) / 100;
            const goalCurrency = goal.currency || 'UGX';
            const convertedAmount = convert(allocationAmount, incomeCurrency, goalCurrency);

            // Create goal_allocation record (not update goal progress)
            try {
                await goalAllocationsAPI.create({
                    income_id: incomeId,
                    goal_id: goalId,
                    amount: convertedAmount,
                    currency: goalCurrency,
                });
            } catch (apiError) {
                console.error('API error, saving locally:', apiError);
                // Fallback to localStorage
            }

            // Always save locally as backup
            saveGoalAllocationRecord(incomeId, goalId, convertedAmount, goalCurrency);

            // Calculate new progress from all allocations
            const currentProgress = await calculateGoalProgressFromLocal(goalId);
            const newProgress = currentProgress + convertedAmount;
            const target = parseFloat(goal.target_amount);

            // Save notification
            saveGoalAllocationNotification(goal, convertedAmount, newProgress, target, true);
        }
    } catch (error) {
        console.error('Error processing auto-allocation:', error);
    }
}

// Save goal allocation notification
function saveGoalAllocationNotification(goal, amount, newProgress, target, isAuto = false) {
    try {
        const notifications = JSON.parse(localStorage.getItem('goalNotifications') || '[]');
        const percentage = ((newProgress / target) * 100).toFixed(1);

        notifications.unshift({
            type: 'goal_progress',
            goalId: goal.id,
            goalTitle: goal.title,
            amount: amount,
            progress: newProgress,
            target: target,
            percentage: percentage,
            isAuto: isAuto,
            timestamp: new Date().toISOString()
        });

        // Keep only last 50 notifications
        if (notifications.length > 50) {
            notifications.splice(50);
        }

        localStorage.setItem('goalNotifications', JSON.stringify(notifications));
    } catch (error) {
        console.error('Error saving notification:', error);
    }
}

// Edit income
async function editIncome(id) {
    const income = allIncome.find(i => i.id === id);
    if (!income) {
        showNotification('Income record not found', 'error');
        return;
    }

    const modal = document.getElementById('incomeModal');
    const title = document.getElementById('incomeModalTitle');
    const idInput = document.getElementById('incomeId');
    const form = document.getElementById('incomeForm');

    if (!modal || !title || !idInput || !form) {
        showNotification('Error: Form elements not found', 'error');
        return;
    }

    // Populate fields
    title.textContent = 'Edit Income';
    idInput.value = income.id;
    const amountInput = form.querySelector('input[name="amount"]');
    const currencySelect = form.querySelector('select[name="currency"]');
    const sourceSelect = form.querySelector('select[name="source"]');
    const dateInput = form.querySelector('input[name="date"]');

    if (amountInput) amountInput.value = income.amount;
    if (currencySelect) currencySelect.value = income.currency;
    if (sourceSelect) sourceSelect.value = income.source;
    if (dateInput) dateInput.value = income.date;

    // Load Goals for Allocation (ensure dropdown is populated)
    await loadGoalsForAllocation();

    // Fetch and populate Goal Allocations
    try {
        const response = await goalAllocationsAPI.getAll({ income_id: income.id });
        const allocations = response.allocations || [];

        const allocateCheckbox = document.getElementById('allocateToGoal');
        const allocationSection = document.getElementById('goalAllocationSection');
        const goalSelect = document.getElementById('goalSelect');
        const goalAmountInput = document.getElementById('goalAmount');

        if (allocations.length > 0) {
            const alloc = allocations[0]; // Take the first allocation

            if (allocateCheckbox) allocateCheckbox.checked = true;
            if (allocationSection) allocationSection.style.display = 'block';
            if (goalSelect) goalSelect.value = alloc.goal_id;

            // Convert allocation amount back to income currency for display if needed
            let displayAmount = parseFloat(alloc.allocated_amount);
            if (alloc.currency && income.currency && alloc.currency !== income.currency) {
                displayAmount = convert(displayAmount, alloc.currency, income.currency);
            }

            if (goalAmountInput) goalAmountInput.value = displayAmount;
        } else {
            if (allocateCheckbox) allocateCheckbox.checked = false;
            if (allocationSection) allocationSection.style.display = 'none';
            if (goalSelect) goalSelect.value = '';
            if (goalAmountInput) goalAmountInput.value = '';
        }

        // Update info display
        if (typeof updateGoalAllocationInfo === 'function') {
            updateGoalAllocationInfo();
        }

    } catch (e) {
        console.error('Error fetching allocations for edit:', e);
        // Fallback or just ignore (user can re-allocate)
    }

    // Open modal
    modal.classList.add('active');
}

// Delete income
async function deleteIncome(id) {
    if (!confirm('Are you sure you want to delete this income record? This will also remove all goal allocations linked to this income.')) return;

    try {
        // Delete goal allocations before deleting income
        await deleteGoalAllocationsForIncome(id);

        await incomeAPI.delete(id);
        showNotification('Income deleted successfully', 'success');
        await loadIncome();

        // Refresh dashboard if on dashboard
        if (typeof loadDashboardData === 'function') {
            setTimeout(() => loadDashboardData(), 500);
        }

        // Refresh goals page if open
        if (window.location.pathname.includes('goals')) {
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (error) {
        showNotification(error.message || 'Error deleting income', 'error');
    }
}

// Export CSV
async function exportCSV() {
    try {
        const from = document.getElementById('fromDate').value;
        const to = document.getElementById('toDate').value;

        // Create CSV manually for income
        let csv = 'Date,Source,Amount,Currency\n';
        filteredIncome.forEach(inc => {
            const convertedAmount = convert(parseFloat(inc.amount), inc.currency, currentCurrency);
            csv += `${inc.date},${inc.source},${convertedAmount},${currentCurrency}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `income-${from}-to-${to}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        showNotification('Error exporting CSV', 'error');
    }
}

// Modal functions
function openAddModal() {
    const modal = document.getElementById('incomeModal');
    const title = document.getElementById('incomeModalTitle');
    const form = document.getElementById('incomeForm');
    const idInput = document.getElementById('incomeId');

    if (!modal || !title || !form || !idInput) return;

    modal.classList.add('active');
    title.textContent = 'Add Income';
    form.reset();
    idInput.value = '';

    // Reset goal allocation
    const allocateCheckbox = document.getElementById('allocateToGoal');
    const allocationSection = document.getElementById('goalAllocationSection');
    if (allocateCheckbox) allocateCheckbox.checked = false;
    if (allocationSection) allocationSection.style.display = 'none';

    // Load goals
    loadGoalsForAllocation();

    const dateInput = form.querySelector('input[name="date"]');
    if (dateInput) dateInput.valueAsDate = new Date();
}

function closeIncomeModal() {
    const modal = document.getElementById('incomeModal');
    const form = document.getElementById('incomeForm');
    const idInput = document.getElementById('incomeId');

    if (modal) modal.classList.remove('active');
    if (form) form.reset();
    if (idInput) idInput.value = '';
}

// Alias for backward compatibility
function closeModal() {
    closeIncomeModal();
}

// Close modal on outside click
document.getElementById('incomeModal').addEventListener('click', (e) => {
    if (e.target.id === 'incomeModal') closeModal();
});

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
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 300px;
        word-wrap: break-word;
        background: ${type === 'error' ? '#f85149' : type === 'success' ? '#3fb950' : type === 'warning' ? '#d29922' : '#58a6ff'};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        font-size: 14px;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// Make functions available globally
window.editIncome = editIncome;
window.deleteIncome = deleteIncome;
window.openAddModal = openAddModal;
window.closeIncomeModal = closeIncomeModal;
window.closeModal = closeModal;
window.goToPage = goToPage;
window.applyFilters = applyFilters;
window.exportCSV = exportCSV;
window.toggleGoalAllocation = toggleGoalAllocation;
window.updateGoalAllocationInfo = updateGoalAllocationInfo;

