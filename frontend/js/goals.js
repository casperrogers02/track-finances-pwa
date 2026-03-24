// Goals page functionality
import { goalsAPI, goalAllocationsAPI, getToken, getUser } from './api.js';
import { getIcon } from './icons.js';
import { convert, formatCurrency } from './currency.js';

let currentCurrency = 'UGX';
let goals = [];

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

    // Load goals
    await loadGoals();

    // Setup event listeners
    document.getElementById('goalForm').addEventListener('submit', handleSaveGoal);

    // Currency conversion auto-convert
    const currencySelect = document.querySelector('#goalForm select[name="currency"]');
    const amountInput = document.querySelector('#goalForm input[name="target_amount"]');

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
        });
    }
});

// Load goals
async function loadGoals() {
    try {
        const response = await goalsAPI.getAll();
        goals = response.goals || [];
        await renderGoals(); // Now async because it calculates progress
    } catch (error) {
        console.error('Error loading goals:', error);
        showNotification('Error loading goals', 'error');
    }
}

// Calculate goal progress from allocations
async function calculateGoalProgress(goalId) {
    try {
        // Get all allocations for this goal
        const allocations = await goalAllocationsAPI.getAll(goalId);
        const allocationList = allocations.allocations || allocations || [];

        // If API returns no rows but localStorage has allocations
        // (e.g., allocations created before API payload fields were fixed),
        // fall back to local calculation so the UI still shows progress.
        if (!Array.isArray(allocationList) || allocationList.length === 0) {
            return calculateGoalProgressFromLocal(goalId);
        }

        // Sum all allocated amounts
        let totalProgress = 0;
        allocationList.forEach(allocation => {
            const amount = parseFloat(allocation.allocated_amount) || 0;
            // Convert to goal's currency if needed
            const goal = goals.find(g => g.id == goalId);
            if (goal) {
                const goalCurrency = goal.currency || 'UGX';
                const allocationCurrency = allocation.currency || 'UGX';
                if (allocationCurrency !== goalCurrency) {
                    totalProgress += convert(amount, allocationCurrency, goalCurrency);
                } else {
                    totalProgress += amount;
                }
            } else {
                totalProgress += amount;
            }
        });

        return totalProgress;
    } catch (error) {
        console.error('Error calculating goal progress:', error);
        // Fallback to localStorage
        return calculateGoalProgressFromLocal(goalId);
    }
}

// Calculate goal progress from local storage (fallback)
function calculateGoalProgressFromLocal(goalId) {
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

// Render goals with calculated progress
async function renderGoals() {
    const container = document.getElementById('goalsContainer');

    if (goals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>No goals yet</h2>
                <p>Create your first financial goal to get started!</p>
                <button class="btn btn-primary" onclick="openAddGoalModal()" style="margin-top: 1rem;">Add Goal</button>
            </div>
        `;
        return;
    }

    // Get auto-allocation rules to display
    const autoRules = getAutoAllocationRules();

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(goals.map(async (goal) => {
        const calculatedProgress = await calculateGoalProgress(goal.id);
        return { ...goal, calculatedProgress };
    }));

    container.innerHTML = goalsWithProgress.map(goal => {
        // Use calculated progress instead of stored progress
        const progress = goal.calculatedProgress || 0;
        const target = parseFloat(goal.target_amount);
        const percentage = target > 0 ? Math.min((progress / target) * 100, 100) : 0;
        const remaining = Math.max(target - progress, 0);
        const deadline = goal.deadline ? new Date(goal.deadline) : null;
        const daysLeft = deadline ? Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)) : null;
        const hasAutoAllocation = autoRules[goal.id] !== undefined || goal.auto_allocation_enabled;
        const autoPercentage = autoRules[goal.id] || goal.auto_allocation_percentage || 0;

        return `
            <div class="goal-card card">
                <div class="goal-hover-info">
                    <strong>Total Allocated:</strong> ${formatCurrency(progress, currentCurrency)}<br>
                    <strong>Target:</strong> ${formatCurrency(target, currentCurrency)}<br>
                    <strong>Remaining:</strong> ${formatCurrency(remaining, currentCurrency)}<br>
                    <strong>Progress:</strong> ${percentage.toFixed(1)}%<br>
                    ${daysLeft !== null ? (daysLeft >= 0 ? `<strong>Days Left:</strong> ${daysLeft}` : '<strong>Status:</strong> Deadline passed') : '<strong>Status:</strong> No deadline'}
                    ${hasAutoAllocation ? `<br><strong>Auto-Allocation:</strong> ${autoPercentage}% of income` : ''}
                </div>
                <div class="goal-header">
                    <div style="flex: 1;">
                        <div class="goal-title">
                            ${goal.title}
                            ${hasAutoAllocation ? `<span style="display: inline-flex; align-items: center; justify-content: center; color: var(--accent-teal); margin-left: 8px;" title="Auto-allocation enabled">${getIcon('ai')}</span>` : ''}
                        </div>
                        <div class="progress-info">
                            <span>${formatCurrency(progress, currentCurrency)} / ${formatCurrency(target, currentCurrency)}</span>
                            <span>${percentage.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="goal-actions">
                        <button onclick="editGoal(${goal.id})" title="Edit" style="background: none; border: none; color: var(--accent-blue); cursor: pointer; padding: 6px;">${getIcon('edit')}</button>
                        <button onclick="deleteGoal(${goal.id})" title="Delete" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 6px;">${getIcon('trash')}</button>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                ${deadline ? `
                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                        Deadline: ${deadline.toLocaleDateString()} 
                        ${daysLeft !== null ? `(${daysLeft >= 0 ? `${daysLeft} days left` : 'Deadline passed'})` : ''}
                    </div>
                ` : ''}
                ${hasAutoAllocation ? `
                    <div style="font-size: 0.75rem; color: var(--accent-teal); margin-top: 0.5rem; display: flex; align-items: center; gap: 4px;">
                        <span style="display: inline-flex; align-items: center;">${getIcon('ai')}</span> Auto-allocating ${autoPercentage}% of all income
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Handle save goal
async function handleSaveGoal(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const goalId = formData.get('id');
    const data = {
        title: formData.get('title'),
        target_amount: parseFloat(formData.get('target_amount')),
        // DO NOT include progress - it's calculated from allocations dynamically
        // Progress is NEVER stored - only calculated from goal_allocation records
        deadline: formData.get('deadline') || null,
        currency: formData.get('currency') || 'UGX',
        auto_allocation_enabled: formData.get('enableAutoAllocation') === 'on',
        auto_allocation_percentage: formData.get('enableAutoAllocation') === 'on' ? parseFloat(formData.get('allocationPercentage')) : null
    };

    try {
        let savedGoal;
        if (goalId) {
            savedGoal = await goalsAPI.update(goalId, data);
            showNotification('Goal updated successfully', 'success');

            // Save auto-allocation rule locally
            if (data.auto_allocation_enabled) {
                saveAutoAllocationRule(goalId, data.auto_allocation_percentage);
            } else {
                // Remove rule if disabled
                removeAutoAllocationRule(goalId);
            }
        } else {
            savedGoal = await goalsAPI.create(data);
            showNotification('Goal created successfully', 'success');

            // Save auto-allocation rule locally with new goal ID
            // Try different response structures
            const newGoalId = savedGoal?.goal?.id || savedGoal?.id || savedGoal?.data?.id;
            if (data.auto_allocation_enabled && newGoalId) {
                saveAutoAllocationRule(newGoalId, data.auto_allocation_percentage);
            }
        }

        closeGoalModal();
        await loadGoals();

        // Refresh dashboard notifications if on dashboard
        if (typeof loadNotifications === 'function') {
            setTimeout(() => loadNotifications(), 1000);
        }
    } catch (error) {
        showNotification(error.message || 'Error saving goal', 'error');
    }
}

// Remove auto-allocation rule
function removeAutoAllocationRule(goalId) {
    try {
        let rules = JSON.parse(localStorage.getItem('goalAutoAllocationRules') || '{}');
        delete rules[goalId];
        localStorage.setItem('goalAutoAllocationRules', JSON.stringify(rules));
    } catch (error) {
        console.error('Error removing auto-allocation rule:', error);
    }
}

// Save auto-allocation rule
function saveAutoAllocationRule(goalId, percentage) {
    try {
        let rules = JSON.parse(localStorage.getItem('goalAutoAllocationRules') || '{}');
        rules[goalId] = percentage;
        localStorage.setItem('goalAutoAllocationRules', JSON.stringify(rules));
    } catch (error) {
        console.error('Error saving auto-allocation rule:', error);
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

// Toggle auto-allocation section
function toggleAutoAllocation() {
    const checkbox = document.getElementById('enableAutoAllocation');
    const section = document.getElementById('autoAllocationSection');
    if (checkbox && section) {
        section.style.display = checkbox.checked ? 'block' : 'none';
    }
}

// Update allocation display
function updateAllocationDisplay() {
    const slider = document.getElementById('allocationPercentage');
    const display = document.getElementById('allocationDisplay');
    if (slider && display) {
        display.textContent = slider.value + '%';
    }
}

// Edit goal
async function editGoal(id) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;

    // Calculate current progress from allocations
    const calculatedProgress = await calculateGoalProgress(goal.id);

    // Populate fields
    document.getElementById('goalModalTitle').textContent = 'Edit Goal';
    document.getElementById('goalId').value = goal.id;
    document.querySelector('#goalForm input[name="title"]').value = goal.title;
    document.querySelector('#goalForm input[name="target_amount"]').value = goal.target_amount;
    // Progress field is removed - show calculated progress as read-only info
    document.querySelector('#goalForm input[name="deadline"]').value = goal.deadline || '';
    document.querySelector('#goalForm select[name="currency"]').value = goal.currency || 'UGX';

    // Show calculated progress in a read-only display
    const progressInfo = document.querySelector('#goalForm .progress-info-display');
    if (progressInfo) {
        const target = parseFloat(goal.target_amount) || 0;
        const percentage = target > 0 ? ((calculatedProgress / target) * 100).toFixed(1) : '0';
        progressInfo.innerHTML = `<strong>Current Progress:</strong> ${formatCurrency(calculatedProgress, goal.currency || 'UGX')} (${percentage}%) - <em>Calculated from income allocations</em>`;
    }

    // Load auto-allocation settings
    const rules = getAutoAllocationRules();
    const hasRule = rules[goal.id] !== undefined;
    const checkbox = document.getElementById('enableAutoAllocation');
    const section = document.getElementById('autoAllocationSection');
    const slider = document.getElementById('allocationPercentage');

    if (checkbox) {
        checkbox.checked = hasRule || goal.auto_allocation_enabled;
        if (section) {
            section.style.display = checkbox.checked ? 'block' : 'none';
        }
        if (slider && hasRule) {
            slider.value = rules[goal.id];
            updateAllocationDisplay();
        } else if (slider && goal.auto_allocation_percentage) {
            slider.value = goal.auto_allocation_percentage;
            updateAllocationDisplay();
        }
    }

    // Open modal
    document.getElementById('goalModal').classList.add('active');
}

// Delete goal
async function deleteGoal(id) {
    if (!confirm('Are you sure you want to delete this goal? This will also delete all allocations linked to this goal.')) return;

    try {
        // Delete all goal allocations first
        try {
            await goalAllocationsAPI.deleteByGoal(id);
        } catch (error) {
            console.error('Error deleting goal allocations:', error);
            // Continue with goal deletion anyway
        }

        // Delete from localStorage
        const allocations = JSON.parse(localStorage.getItem('goalAllocations') || '{}');
        Object.keys(allocations).forEach(incomeId => {
            allocations[incomeId] = allocations[incomeId].filter(a => String(a.goalId) !== String(id));
            if (allocations[incomeId].length === 0) {
                delete allocations[incomeId];
            }
        });
        localStorage.setItem('goalAllocations', JSON.stringify(allocations));

        // Delete the goal
        await goalsAPI.delete(id);
        showNotification('Goal deleted successfully', 'success');
        await loadGoals();
    } catch (error) {
        showNotification(error.message || 'Error deleting goal', 'error');
    }
}

// Modal functions
function openAddGoalModal() {
    const modal = document.getElementById('goalModal');
    const title = document.getElementById('goalModalTitle');
    const form = document.getElementById('goalForm');
    const idInput = document.getElementById('goalId');

    if (!modal || !title || !form || !idInput) return;

    modal.classList.add('active');
    title.textContent = 'Add Goal';
    form.reset();
    idInput.value = '';

    // Reset auto-allocation
    const autoCheckbox = document.getElementById('enableAutoAllocation');
    const autoSection = document.getElementById('autoAllocationSection');
    if (autoCheckbox) autoCheckbox.checked = false;
    if (autoSection) autoSection.style.display = 'none';
    const slider = document.getElementById('allocationPercentage');
    if (slider) slider.value = 10;
    updateAllocationDisplay();
}

function closeGoalModal() {
    const modal = document.getElementById('goalModal');
    const form = document.getElementById('goalForm');
    const idInput = document.getElementById('goalId');

    if (modal) modal.classList.remove('active');
    if (form) form.reset();
    if (idInput) idInput.value = '';

    // Reset auto-allocation
    const autoCheckbox = document.getElementById('enableAutoAllocation');
    const autoSection = document.getElementById('autoAllocationSection');
    if (autoCheckbox) autoCheckbox.checked = false;
    if (autoSection) autoSection.style.display = 'none';
}

// Close modal on outside click
document.getElementById('goalModal').addEventListener('click', (e) => {
    if (e.target.id === 'goalModal') closeGoalModal();
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
    const container = document.getElementById('alertContainer');
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Make functions available globally
window.editGoal = editGoal;
window.deleteGoal = deleteGoal;
window.openAddGoalModal = openAddGoalModal;
window.closeGoalModal = closeGoalModal;
window.toggleAutoAllocation = toggleAutoAllocation;
window.updateAllocationDisplay = updateAllocationDisplay;
window.getAutoAllocationRules = getAutoAllocationRules;
window.logout = logout;

