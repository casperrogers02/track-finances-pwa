// Import required modules
import {
    authAPI,
    expensesAPI,
    incomeAPI,
    goalsAPI,
    goalAllocationsAPI,
    categoriesAPI,
    aiAPI,
    getUser,
    setUser
} from './api.js';
import { getIcon } from './icons.js';

import { convert, formatCurrency } from './currency.js';

// Dashboard functionality
// Dashboard functionality
let currentCurrency = 'UGX';
let expensesData = [];
let incomeData = [];
let goalsData = [];
let aiMessages = [];
let currentPeriod = 'months'; // 'days', 'weeks', 'months', 'yearly'
let currentDate = new Date(); // Represents the currently selected date/period


// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for API module to be ready
    if (!window.apiModuleReady) {
        await new Promise((resolve) => {
            if (window.apiModuleReady) {
                resolve();
            } else {
                window.addEventListener('apiModuleReady', resolve, { once: true });
                // Timeout after 3 seconds
                setTimeout(resolve, 3000);
            }
        });
    }

    // Check authentication
    const tokenFn = window.getToken || getToken;
    if (!tokenFn || !tokenFn()) {
        window.location.href = 'login.html';
        return;
    }

    // Set today's date as default
    const expenseDateInput = document.querySelector('#expenseForm input[name="date"]');
    const incomeDateInput = document.querySelector('#incomeForm input[name="date"]');
    if (expenseDateInput) expenseDateInput.valueAsDate = new Date();
    if (incomeDateInput) incomeDateInput.valueAsDate = new Date();

    // Load user info and update welcome message
    // Always get fresh user data from localStorage/sessionStorage
    let user = getUser();
    if (!user) {
        // Try sessionStorage as fallback
        const sessionUser = sessionStorage.getItem('user');
        if (sessionUser) {
            try {
                user = JSON.parse(sessionUser);
                setUser(user); // Sync to localStorage
            } catch (e) {
                console.error('Error parsing session user:', e);
            }
        }
    }

    if (user) {
        currentCurrency = user.preferred_currency || 'UGX';
        updateWelcomeMessage(user);
    } else {
        // Try to fetch user from API if not in storage
        try {
            const userData = await authAPI.me();
            if (userData && userData.user) {
                setUser(userData.user);
                sessionStorage.setItem('user', JSON.stringify(userData.user));
                currentCurrency = userData.user.preferred_currency || 'UGX';
                updateWelcomeMessage(userData.user);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            // Continue with default values
        }
    }

    // Listen for user updates from settings page
    window.addEventListener('userUpdated', (event) => {
        const getUserFn = window.getUser || getUser;
        const updatedUser = event.detail || (getUserFn ? getUserFn() : null);
        if (updatedUser) {
            currentCurrency = updatedUser.preferred_currency || 'UGX';
            updateWelcomeMessage(updatedUser);
            // Refresh dashboard data
            loadDashboardData();
        }
    });

    // Load categories
    await loadCategories();



    // Setup event listeners
    const expenseForm = document.getElementById('expenseForm');
    const incomeForm = document.getElementById('incomeForm');
    if (expenseForm) expenseForm.addEventListener('submit', handleAddExpense);
    if (incomeForm) incomeForm.addEventListener('submit', handleAddIncome);

    // Setup AI chat Enter key support
    const aiUserInput = document.getElementById('aiUserInput');
    if (aiUserInput) {
        aiUserInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAiMessage();
            }
        });
    }

    // Load dashboard data AFTER charts are initialized
    await loadDashboardData();

    // Initialize period selector buttons
    const savedPeriod = localStorage.getItem('dashboardPeriod') || 'months';
    try {
        setDashboardPeriod(savedPeriod);
    } catch (error) {
        console.error('Error setting dashboard period:', error);
    }

    // Load goals for allocation dropdown
    try {
        loadDashboardGoalsForAllocation();
    } catch (error) {
        console.error('Error loading goals for allocation:', error);
    }

    // Initialize AI assistant with initial advice once data is loaded
    try {
        updateAiAssistantSummary();
    } catch (error) {
        console.error('Error initializing AI assistant:', error);
    }

    // Load AI chat history
    try {
        loadAiMessages();
    } catch (error) {
        console.error('Error loading AI messages:', error);
    }

    // Load and display notifications
    try {
        loadNotifications();
    } catch (error) {
        console.error('Error loading notifications:', error);
    }

    // Setup goal allocation listeners
    try {
        setupDashboardGoalAllocation();
    } catch (error) {
        console.error('Error setting up goal allocation:', error);
    }
});

// Update welcome message with user's name
function updateWelcomeMessage(user) {
    const welcomeEl = document.getElementById('welcomeMessage');
    if (!welcomeEl) return;

    // Get latest user data
    const currentUser = getUser() || user;
    const userName = currentUser.full_name || currentUser.email?.split('@')[0] || 'there';
    welcomeEl.innerHTML = `Welcome back, <strong>${userName}</strong>!`;
}

// Make function globally available
window.updateWelcomeMessage = updateWelcomeMessage;

// Load categories
async function loadCategories() {
    try {
        const categoriesAPIFn = window.categoriesAPI || categoriesAPI;
        if (!categoriesAPIFn) {
            console.error('categoriesAPI not available');
            return;
        }

        const expenseCategories = await categoriesAPIFn.getAll('expense');
        const incomeSources = await categoriesAPIFn.getAll('income');

        const expenseSelect = document.getElementById('expenseCategory');

        // Clear existing expense category options (keep only the first placeholder option)
        while (expenseSelect.options.length > 1) {
            expenseSelect.remove(1);
        }

        expenseCategories.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            expenseSelect.appendChild(option);
        });

        const incomeSelect = document.getElementById('incomeSource');

        // Clear existing income source options (keep only the first placeholder option)
        while (incomeSelect.options.length > 1) {
            incomeSelect.remove(1);
        }

        incomeSources.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            incomeSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Calculate date range based on current period and date
        const dateRange = getPeriodDates(currentPeriod, currentDate);
        const { from, to, label } = dateRange;

        // Update UI label
        const periodLabel = document.getElementById('currentPeriodLabel');
        if (periodLabel) periodLabel.textContent = label;

        console.log(`Loading dashboard data for ${currentPeriod}: ${from} to ${to}`);

        // Load expenses, income, and goals
        let expensesRes = { expenses: [] };
        let incomeRes = { income: [] };
        let goalsRes = { goals: [] };

        // Get API functions
        const expensesAPIFn = window.expensesAPI || expensesAPI;
        const incomeAPIFn = window.incomeAPI || incomeAPI;
        const goalsAPIFn = window.goalsAPI || goalsAPI;

        if (!expensesAPIFn || !incomeAPIFn || !goalsAPIFn) {
            console.error('API functions not available.');
            return;
        }

        let useOfflineData = false;
        
        try {
            expensesRes = await expensesAPIFn.getAll({ from, to, limit: 1000 });
            // Cache the data for offline use
            if (navigator.onLine && expensesRes.expenses && expensesRes.expenses.length > 0) {
                localStorage.setItem('cachedExpenses', JSON.stringify(expensesRes.expenses));
            }
        } catch (error) {
            console.error('Error loading expenses:', error);
            useOfflineData = true;
        }

        try {
            incomeRes = await incomeAPIFn.getAll({ from, to, limit: 1000 });
            // Cache the data for offline use
            if (navigator.onLine && incomeRes.income && incomeRes.income.length > 0) {
                localStorage.setItem('cachedIncome', JSON.stringify(incomeRes.income));
            }
        } catch (error) {
            console.error('Error loading income:', error);
            useOfflineData = true;
        }

        try {
            // Goals are usually long-term, so we normally fetch all active goals.
            // If the API supports filtering by date range (e.g. created/due within period), usage would depend on requirements.
            // For now, fetch all goals to show "Active Goals" count accurately.
            goalsRes = await goalsAPIFn.getAll();
            // Cache the data for offline use
            if (navigator.onLine && goalsRes.goals && goalsRes.goals.length > 0) {
                localStorage.setItem('cachedGoals', JSON.stringify(goalsRes.goals));
            }
        } catch (error) {
            console.error('Error loading goals:', error);
            useOfflineData = true;
        }

        // If offline or API calls failed, use cached data
        if (!navigator.onLine || useOfflineData) {
            const cachedExpenses = localStorage.getItem('cachedExpenses');
            const cachedIncome = localStorage.getItem('cachedIncome');
            const cachedGoals = localStorage.getItem('cachedGoals');
            
            if (cachedExpenses) {
                expensesRes.expenses = JSON.parse(cachedExpenses);
                // Filter cached data by date range
                expensesRes.expenses = expensesRes.expenses.filter(exp => {
                    const expDate = new Date(exp.date);
                    const fromDate = new Date(from);
                    const toDate = new Date(to);
                    return expDate >= fromDate && expDate <= toDate;
                });
            }
            
            if (cachedIncome) {
                incomeRes.income = JSON.parse(cachedIncome);
                // Filter cached data by date range
                incomeRes.income = incomeRes.income.filter(inc => {
                    const incDate = new Date(inc.date);
                    const fromDate = new Date(from);
                    const toDate = new Date(to);
                    return incDate >= fromDate && incDate <= toDate;
                });
            }
            
            if (cachedGoals) {
                goalsRes.goals = JSON.parse(cachedGoals);
            }
            
            if (!navigator.onLine) {
                console.log('Using cached data for offline mode');
            }
        }

        // Parse data
        expensesData = expensesRes?.expenses || expensesRes?.data?.expenses || (Array.isArray(expensesRes) ? expensesRes : []);
        incomeData = incomeRes?.income || incomeRes?.data?.income || (Array.isArray(incomeRes) ? incomeRes : []);
        goalsData = goalsRes?.goals || goalsRes?.data?.goals || (Array.isArray(goalsRes) ? goalsRes : []);

        await updateStats();
        renderRecentTransactions();

        // Update AI context if needed
        if (typeof updateAiAssistantSummary === 'function') {
            updateAiAssistantSummary();
        }

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        if (typeof showNotification === 'function') {
            showNotification('Error loading dashboard data', 'error');
        }
    }
}

// Helper to calculate date range and label
function getPeriodDates(period, date) {
    const d = new Date(date);
    let from, to, label;

    const formatISO = (date) => date.toISOString().split('T')[0];
    const formatDisplay = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    if (period === 'days') {
        from = formatISO(d);
        to = formatISO(d);
        label = formatDisplay(d); // "01/02/2026"

        // Update picker
        const picker = document.getElementById('datePickerDays');
        if (picker && picker.value !== from) picker.value = from;

    } else if (period === 'weeks') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const monday = new Date(d);
        monday.setDate(diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        from = formatISO(monday);
        to = formatISO(sunday);
        label = `${formatDisplay(monday)}-${formatDisplay(sunday)}`; // "01/02/2026-07/02/2026"

        // Update picker
        const picker = document.getElementById('datePickerWeeks');
        if (picker) {
            const year = monday.getFullYear();
            const week = getWeekNumber(monday);
            const val = `${year}-W${String(week).padStart(2, '0')}`;
            if (picker.value !== val) picker.value = val;
        }

    } else if (period === 'months') {
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);

        from = formatISO(firstDay);
        to = formatISO(lastDay);
        label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); // "January 2026"

        // Update picker
        const picker = document.getElementById('datePickerMonths');
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (picker && picker.value !== val) picker.value = val;

    } else if (period === 'yearly') {
        const firstDay = new Date(d.getFullYear(), 0, 1);
        const lastDay = new Date(d.getFullYear(), 11, 31);

        from = formatISO(firstDay);
        to = formatISO(lastDay);
        label = d.getFullYear().toString(); // "2026"

        // Update picker
        const picker = document.getElementById('datePickerYearly');
        if (picker && picker.value != d.getFullYear()) picker.value = d.getFullYear();
    }

    if (!from || !to) {
        // Fallback to current month if period invalid
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        from = formatISO(firstDay);
        to = formatISO(lastDay);
        label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    return { from, to, label };
}

// Function to set dashboard period
// Function to set dashboard period
window.setDashboardPeriod = function (period) {
    currentPeriod = period;
    localStorage.setItem('dashboardPeriod', period);

    // Update active button state
    document.querySelectorAll('.period-selector .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline'); // Reset to outline
        // ID matching: periodDaily, periodWeekly, periodMonthly, periodYearly
        // Note: Dashboard HTML IDs might be periodDays vs periodDaily. Let's check HTML.
        // Dashboard HTML IDs: periodDays, periodWeeks, periodMonths, periodYearly
        // Reports HTML IDs: periodDays, periodWeeks, periodMonths, periodYearly
        // So the ID construction should be: period + Capitalized(period) -> periodDays, periodWeeks...
        const expectedId = `period${period.charAt(0).toUpperCase() + period.slice(1)}`;
        if (btn.id === expectedId) {
            btn.classList.remove('btn-outline');
            btn.classList.add('btn-primary');
        }
    });

    // Show appropriate date picker and trigger popup logic
    ['Days', 'Weeks', 'Months', 'Yearly'].forEach(p => {
        const picker = document.getElementById(`datePicker${p}`);
        if (picker) {
            const isCurrent = (p.toLowerCase() === period);
            picker.style.display = isCurrent ? 'block' : 'none';

            // Initial trigger if needed, or just let user click label/picker
            if (isCurrent && !picker.hasAttribute('data-listening')) {
                picker.setAttribute('data-listening', 'true');
                picker.addEventListener('change', (e) => {
                    if (e.target.value) {
                        if (period === 'weeks') {
                            const [y, w] = e.target.value.split('-W');
                            currentDate = getDateFromWeek(parseInt(y), parseInt(w));
                        } else if (period === 'months') {
                            const [y, m] = e.target.value.split('-');
                            currentDate = new Date(parseInt(y), parseInt(m) - 1, 1);
                        } else if (period === 'yearly') {
                            currentDate = new Date(parseInt(e.target.value), 0, 1);
                        } else {
                            currentDate = new Date(e.target.value);
                        }
                        loadDashboardData();
                    }
                });
            }

            if (isCurrent) {
                // Try to show picker
                try {
                    if (typeof picker.showPicker === 'function') {
                        picker.showPicker();
                    } else {
                        picker.focus();
                        picker.click();
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
    });

    loadDashboardData();
};

// Function to navigate period
window.navigatePeriod = function (direction) {
    if (currentPeriod === 'days') {
        currentDate.setDate(currentDate.getDate() + direction);
    } else if (currentPeriod === 'weeks') {
        currentDate.setDate(currentDate.getDate() + (direction * 7));
    } else if (currentPeriod === 'months') {
        currentDate.setMonth(currentDate.getMonth() + direction);
    } else if (currentPeriod === 'yearly') {
        currentDate.setFullYear(currentDate.getFullYear() + direction);
    }
    loadDashboardData();
};

// Calculate goal progress from allocations (for dashboard)
async function calculateGoalProgressFromAllocations(goalId) {
    try {
        // Try API first, but don't fail if it doesn't exist
        try {
            const allocations = await goalAllocationsAPI.getAll(goalId);
            const allocationList = allocations.allocations || allocations || [];

            let totalProgress = 0;
            allocationList.forEach(allocation => {
                totalProgress += parseFloat(allocation.allocated_amount) || 0;
            });

            return totalProgress;
        } catch (apiError) {
            // API might not be available, fall through to localStorage
            console.log('Goal allocations API not available, using localStorage:', apiError.message);
        }

        // Fallback to localStorage
        const allocations = JSON.parse(localStorage.getItem('goalAllocations') || '{}');
        let totalProgress = 0;
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
        console.error('Error calculating goal progress:', error);
        return 0;
    }
}

// Update stats
async function updateStats() {
    const preferredCurrency = currentCurrency;

    // Calculate totals from filtered data
    let totalIncome = 0;
    let totalExpenses = 0;

    if (Array.isArray(incomeData) && incomeData.length > 0) {
        incomeData.forEach(inc => {
            if (inc && inc.amount) {
                totalIncome += convert(parseFloat(inc.amount), inc.currency || 'UGX', preferredCurrency);
            }
        });
    }

    if (Array.isArray(expensesData) && expensesData.length > 0) {
        expensesData.forEach(exp => {
            if (exp && exp.amount) {
                totalExpenses += convert(parseFloat(exp.amount), exp.currency || 'UGX', preferredCurrency);
            }
        });
    }

    const balance = totalIncome - totalExpenses;

    // Calculate active goals based on calculated progress from allocations
    let activeGoals = 0;
    if (Array.isArray(goalsData) && goalsData.length > 0) {
        const goalProgressPromises = goalsData.map(async (goal) => {
            if (!goal || !goal.id) return false;
            const target = parseFloat(goal.target_amount);
            if (target > 0) {
                // Calculate progress from allocations
                const calculatedProgress = await calculateGoalProgressFromAllocations(goal.id);
                return calculatedProgress < target;
            }
            return false;
        });

        const goalStatuses = await Promise.all(goalProgressPromises);
        activeGoals = goalStatuses.filter(status => status).length;
    }

    // Update Labels based on current period date range
    const dateRange = getPeriodDates(currentPeriod, currentDate);
    const labelDateText = dateRange.label;

    const expensesLabel = document.getElementById('expensesLabel');
    if (expensesLabel) expensesLabel.textContent = `${labelDateText} Expenses`;

    const incomeLabel = document.getElementById('incomeLabel');
    if (incomeLabel) incomeLabel.textContent = `${labelDateText} Income`;

    const balanceLabel = document.getElementById('balanceLabel');
    if (balanceLabel) balanceLabel.textContent = `${labelDateText} Balance`;

    // Update UI Values
    const totalBalanceEl = document.getElementById('totalBalance');
    if (totalBalanceEl) {
        totalBalanceEl.textContent = formatCurrency(balance, preferredCurrency);
        totalBalanceEl.className = 'stat-value ' + (balance >= 0 ? 'positive' : 'negative');
    }

    const monthlyExpensesEl = document.getElementById('monthlyExpenses');
    if (monthlyExpensesEl) {
        monthlyExpensesEl.textContent = formatCurrency(totalExpenses, preferredCurrency);
    }

    const monthlyIncomeEl = document.getElementById('monthlyIncome');
    if (monthlyIncomeEl) {
        monthlyIncomeEl.textContent = formatCurrency(totalIncome, preferredCurrency);
    }

    const activeGoalsEl = document.getElementById('activeGoals');
    if (activeGoalsEl) {
        activeGoalsEl.textContent = activeGoals;
    }
}












// Helper functions for date calculations
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getDateFromWeek(year, week) {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
}

// Make helper functions available globally
window.getWeekNumber = getWeekNumber;
window.getDateFromWeek = getDateFromWeek;

// Update chart with selected date


// ------- AI Assistant (uses backend AI with financial context) -------

async function buildFinancialContext() {
    const preferredCurrency = currentCurrency;
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals = {};
    const incomeSources = {};

    // Process income data
    incomeData.forEach(inc => {
        const amount = convert(parseFloat(inc.amount), inc.currency, preferredCurrency);
        totalIncome += amount;
        const source = inc.category || 'Other Income';
        incomeSources[source] = (incomeSources[source] || 0) + amount;
    });

    // Process expenses data
    expensesData.forEach(exp => {
        const amount = convert(parseFloat(exp.amount), exp.currency, preferredCurrency);
        totalExpenses += amount;
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amount;
    });

    const balance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0;

    // Include goals data with more detail
    const goalsInfoPromises = goalsData.map(async (goal) => {
        const target = parseFloat(goal.target_amount);
        const calculatedProgress = await calculateGoalProgressFromAllocations(goal.id);
        const remaining = Math.max(target - calculatedProgress, 0);
        const deadline = goal.deadline ? new Date(goal.deadline) : null;
        const daysLeft = deadline ? Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)) : null;
        const percentage = target > 0 ? ((calculatedProgress / target) * 100).toFixed(1) : 0;

        return {
            title: goal.title,
            target: convert(target, goal.currency || preferredCurrency, preferredCurrency),
            progress: convert(calculatedProgress, goal.currency || preferredCurrency, preferredCurrency),
            remaining: convert(remaining, goal.currency || preferredCurrency, preferredCurrency),
            percentage: parseFloat(percentage),
            deadline: goal.deadline,
            daysLeft: daysLeft,
            currency: goal.currency || preferredCurrency
        };
    });

    const goalsInfo = await Promise.all(goalsInfoPromises);

    // Build a comprehensive context with system instructions
    const contextData = {
        system_instructions: `You are an intelligent, open-minded financial advisor AI assistant for SpendWise, a personal finance app for users in Uganda. Your role is to:

1. **Be Conversational & Engaging**: Respond like a knowledgeable friend who genuinely cares about the user's financial success. Use natural, friendly language.

2. **Provide Comprehensive, Thoughtful Answers**: Don't just give basic tips. Think deeply about the user's situation, consider multiple angles, and provide detailed, actionable advice.

3. **Be Open-Minded & Creative**: Suggest innovative ideas, explore various options, and help users think outside the box. Consider different strategies for income generation, savings, investments, and expense optimization.

4. **Context-Aware**: Use the provided financial data (income, expenses, goals) to give personalized, relevant advice. Reference specific amounts, goals, and patterns when helpful.

5. **Uganda-Specific**: Provide advice tailored to the Ugandan context - local markets, SACCOs, mobile money, business opportunities, investment options, etc.

6. **Goal-Oriented**: Always connect advice back to the user's financial goals when relevant. Help them understand how specific actions will help achieve their targets.

7. **Encouraging & Supportive**: Be positive and motivating while being realistic. Celebrate progress and provide constructive guidance.`,

        user_financial_data: {
            currency: preferredCurrency,
            totalIncome: parseFloat(totalIncome.toFixed(2)),
            totalExpenses: parseFloat(totalExpenses.toFixed(2)),
            balance: parseFloat(balance.toFixed(2)),
            savingsRate: parseFloat(savingsRate),
            topExpenseCategories: Object.entries(categoryTotals)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([category, amount]) => ({
                    category,
                    amount: parseFloat(amount.toFixed(2)),
                    percentage: totalExpenses > 0 ? parseFloat(((amount / totalExpenses) * 100).toFixed(1)) : 0
                })),
            topIncomeSources: Object.entries(incomeSources)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([source, amount]) => ({
                    source,
                    amount: parseFloat(amount.toFixed(2)),
                    percentage: totalIncome > 0 ? parseFloat(((amount / totalIncome) * 100).toFixed(1)) : 0
                })),
            goals: goalsInfo
        }
    };

    return JSON.stringify(contextData);
}

function updateAiAssistantSummary() {
    const summaryEl = document.getElementById('aiSummary');
    if (!summaryEl) return;

    const preferredCurrency = currentCurrency;
    let totalIncome = 0;
    let totalExpenses = 0;

    incomeData.forEach(inc => {
        totalIncome += convert(parseFloat(inc.amount), inc.currency, preferredCurrency);
    });

    expensesData.forEach(exp => {
        totalExpenses += convert(parseFloat(exp.amount), exp.currency, preferredCurrency);
    });

    const balance = totalIncome - totalExpenses;

    let summary = `In the last 30 days, your total income is ${formatCurrency(totalIncome, preferredCurrency)} and your expenses are ${formatCurrency(totalExpenses, preferredCurrency)}, leaving a balance of ${formatCurrency(balance, preferredCurrency)}.`;
    summaryEl.textContent = summary;

    // Seed AI chat with a more engaging welcome message once
    // Check if welcome message already added to prevent duplicates
    const hasWelcomeMessage = aiMessages.some(msg => msg.role === 'assistant');
    if (aiMessages.length === 0 || !hasWelcomeMessage) {
        addAiMessage('assistant', 'Hello! 👋 I\'m your SpendWise AI assistant, and I\'m here to help you achieve your financial goals. I can provide personalized, thoughtful advice about budgeting, saving, investing, income generation, and reaching your financial targets - all tailored to your situation in Uganda.\n\nFeel free to ask me anything! Whether you want to know how to accomplish your goals, increase your income, optimize your spending, or explore investment opportunities, I\'m here to have an open conversation and help you think through your options.');
        renderAiMessages();
    }
}

function addAiMessage(role, text) {
    const message = { role, text, time: new Date() };
    aiMessages.push(message);
    return message; // Return for potential use
}

function renderAiMessages() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    if (aiMessages.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 14px; text-align: center; padding: 20px;">Start a conversation to get personalized advice.</div>';
        return;
    }

    container.innerHTML = aiMessages.map(msg => {
        const isUser = msg.role === 'user';
        const avatar = isUser ? '👤' : '🤖';
        
        return `
            <div class="ai-bubble ai-bubble--${isUser ? 'user' : 'bot'}">
                <div class="ai-bubble__avatar">${avatar}</div>
                <div class="ai-bubble__text">${msg.text.replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

function generateAdviceFromData(userQuestion = '') {
    // This is a fallback function - try to provide more conversational advice
    const preferredCurrency = currentCurrency;

    // Recalculate some quick stats
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals = {};

    incomeData.forEach(inc => {
        totalIncome += convert(parseFloat(inc.amount), inc.currency, preferredCurrency);
    });
    expensesData.forEach(exp => {
        const amount = convert(parseFloat(exp.amount), exp.currency, preferredCurrency);
        totalExpenses += amount;
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amount;
    });

    const balance = totalIncome - totalExpenses;
    const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat.toLowerCase());

    let tips = [];

    // Interpret some common Ugandan scenarios
    if (topCategories.includes('transport')) {
        tips.push('Your transport costs are high. In Uganda, you can save by planning routes to combine errands, using taxis instead of boda-bodas for longer distances, or carpooling with colleagues where possible.');
    }
    if (topCategories.includes('airtime') || topCategories.includes('mobile money') || topCategories.includes('data')) {
        tips.push('You spend a lot on airtime/data/Mobile Money charges. Consider buying weekly/monthly data bundles instead of daily, and reduce frequent small Mobile Money withdrawals to cut transaction fees.');
    }
    if (topCategories.includes('entertainment')) {
        tips.push('Entertainment is taking a big share of your budget. Try setting a fixed weekly cash amount for outings and stick to it, and look for low-cost activities like community events or church groups.');
    }
    if (topCategories.includes('food & groceries') || topCategories.includes('food')) {
        tips.push('Food & groceries are significant. Buying in bulk from markets in places like Owino, Kalerwe, or local village markets and cooking at home can drastically cut costs compared to daily small purchases.');
    }

    if (balance < 0) {
        tips.push('You are spending more than you earn. Start by cutting 10–20% from non-essential categories and direct that money into paying off any debts, then building a 3–6 month emergency fund.');
    } else if (balance > 0) {
        tips.push('You have some surplus each month. Consider joining a trusted SACCO, investing in treasury bills, or starting a small side hustle (e.g. eggs, charcoal, snacks, or mobile money agency) to grow your income.');
    }

    // Simple handling of specific user questions
    const q = userQuestion.toLowerCase();
    if (q.includes('school') || q.includes('fees')) {
        tips.push('For school fees, create a termly goal and divide it by the months before term starts. Automate saving that amount each month and avoid touching it; you can use a locked savings product from a local bank or mobile money (e.g. MTN MoMo Goals).');
    }
    if (q.includes('side hustle') || q.includes('business') || q.includes('extra income')) {
        tips.push('Popular practical side hustles in Uganda include: selling snacks/chapati in the evening, running a small mobile money or airtime kiosk, poultry (layers/broilers), and online gigs like graphic design or tutoring. Start with something that fits your skills and doesn’t require heavy capital.');
    }
    if (q.includes('debt') || q.includes('loan')) {
        tips.push('If you have loans, list them and prioritise those with the highest interest (often mobile loans). Cut non-essential spending and direct extra cash to clear these quickly, and avoid taking new loans for consumption items.');
    }

    if (tips.length === 0) {
        tips.push('Focus on tracking every expense for at least one month, then aim to keep essential costs (rent, food, transport, utilities) below 60% of your income. Use the remaining 40% for savings, investment, and moderate leisure.');
    }

    return tips.join(' ');
}

async function sendAiMessage() {
    const inputEl = document.getElementById('aiUserInput');
    const sendButton = document.getElementById('aiSendButton');
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;

    // Show user message immediately
    addAiMessage('user', text);
    renderAiMessages();

    // Disable input and show loading state
    inputEl.disabled = true;
    if (sendButton) {
        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';
    }

    // Show loading indicator in chat
    const container = document.getElementById('aiChatMessages');
    if (container) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'aiThinkingIndicator';
        loadingIndicator.className = 'ai-bubble ai-bubble--bot';
        loadingIndicator.innerHTML = `
            <div class="ai-bubble__avatar">🤖</div>
            <div class="ai-bubble__text ai-typing"><span></span><span></span><span></span></div>
        `;
        container.appendChild(loadingIndicator);
        container.scrollTop = container.scrollHeight;
    }

    try {
        const context = await buildFinancialContext();

        // Call AI API (backend handles history based on user ID)
        // We pass empty array for history as it's ignored by backend now
        const response = await aiAPI.chat(text, [], context);

        // Remove thinking indicator
        const thinkingIndicator = document.getElementById('aiThinkingIndicator');
        if (thinkingIndicator) {
            thinkingIndicator.remove();
        }

        // Handle different response formats
        let reply = '';
        if (typeof response === 'string') {
            reply = response;
        } else if (response.reply) {
            reply = response.reply;
        } else if (response.message) {
            reply = response.message;
        } else if (response.text) {
            reply = response.text;
        } else if (response.content) {
            reply = response.content;
        } else {
            reply = 'I apologize, but I\'m having trouble processing that. Could you rephrase your question?';
        }

        addAiMessage('assistant', reply);
        saveAiMessages(); // Save after response
    } catch (error) {
        console.error('AI chat error:', error);

        // Remove thinking indicator
        const thinkingIndicator = document.getElementById('aiThinkingIndicator');
        if (thinkingIndicator) {
            thinkingIndicator.remove();
        }

        // Use improved fallback that's more conversational
        const fallback = generateAdviceFromData(text);
        addAiMessage('assistant', `I apologize, but I'm having trouble connecting to the AI service right now. However, based on your financial data:\n\n${fallback}\n\nPlease try asking again in a moment, and I'll provide a more detailed response.`);
        saveAiMessages(); // Save fallback response
    } finally {
        // Re-enable input
        inputEl.disabled = false;
        if (sendButton) {
            sendButton.disabled = false;
            sendButton.textContent = 'Send';
        }
        inputEl.focus();
    }

    renderAiMessages();
    inputEl.value = '';
}

// Load AI messages from backend
async function loadAiMessages() {
    try {
        // Try to load from backend first
        const response = await aiAPI.getHistory();
        if (response && response.history && Array.isArray(response.history)) {
            // Check if we have history
            if (response.history.length > 0) {
                aiMessages = response.history.map(msg => ({
                    role: msg.role,
                    text: msg.text,
                    time: msg.timestamp || new Date()
                }));
            }
        }

        // If empty (new user or cleared), show welcome message
        if (aiMessages.length === 0) {
            addAiMessage('assistant', 'Hello! 👋 I\'m your SpendWise AI assistant, and I\'m here to help you achieve your financial goals. I can provide personalized, thoughtful advice about budgeting, saving, investing, income generation, and reaching your financial targets - all tailored to your situation in Uganda.\n\nFeel free to ask me anything! Whether you want to know how to accomplish your goals, increase your income, optimize your spending, or explore investment opportunities, I\'m here to have an open conversation and help you think through your options.');
        }

        // Cache to localStorage for offline support
        saveAiMessages();
        renderAiMessages();
    } catch (error) {
        console.error('Error loading AI messages from backend:', error);

        // Fallback to localStorage
        try {
            const saved = localStorage.getItem('aiMessages');
            if (saved) {
                const parsed = JSON.parse(saved);
                aiMessages = parsed;
            }
        } catch (e) {
            console.error('Error parsing local messages:', e);
        }

        if (aiMessages.length === 0) {
            addAiMessage('assistant', 'Hello! 👋 I\'m your SpendWise AI assistant, and I\'m here to help you achieve your financial goals. I can provide personalized, thoughtful advice about budgeting, saving, investing, income generation, and reaching your financial targets - all tailored to your situation in Uganda.\n\nFeel free to ask me anything! Whether you want to know how to accomplish your goals, increase your income, optimize your spending, or explore investment opportunities, I\'m here to have an open conversation and help you think through your options.');
        }
        renderAiMessages();
    }
}

// Save AI messages to localStorage for offline access
function saveAiMessages() {
    try {
        localStorage.setItem('aiMessages', JSON.stringify(aiMessages));
    } catch (error) {
        console.error('Error saving AI messages:', error);
    }
}

// Expose AI functions globally
window.sendAiMessage = sendAiMessage;
window.clearAiChat = clearAiChat;

// Render recent transactions
function renderRecentTransactions() {
    const preferredCurrency = currentCurrency;
    const container = document.getElementById('recentTransactions');
    if (!container) return;

    // Combine and sort - ensure arrays exist and are valid
    const expenses = Array.isArray(expensesData) ? expensesData : [];
    const income = Array.isArray(incomeData) ? incomeData : [];

    const allTransactions = [
        ...expenses.filter(exp => exp && exp.amount && exp.date).map(exp => ({
            ...exp,
            type: 'expense',
            displayAmount: convert(parseFloat(exp.amount), exp.currency || 'UGX', preferredCurrency)
        })),
        ...income.filter(inc => inc && inc.amount && inc.date).map(inc => ({
            ...inc,
            type: 'income',
            displayAmount: convert(parseFloat(inc.amount), inc.currency || 'UGX', preferredCurrency),
            category: inc.source || inc.category
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    if (allTransactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No transactions yet. Add your first expense or income to get started!</p></div>';
        return;
    }

    // Create table
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style="text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${allTransactions.map(t => {
        const isAutoDetected = t.source_type === 'sms_sync' || t.source_type === 'statement_upload';
        return `
                    <tr>
                        <td data-label="Date">${new Date(t.date).toLocaleDateString()}</td>
                        <td data-label="Category">
                            ${t.category || t.source || '-'}
                            ${isAutoDetected ? `<span style="display: inline-flex; align-items: center; justify-content: center; color: var(--accent-teal); margin-left: 4px;" title="Auto-detected">${getIcon('ai')}</span>` : ''}
                        </td>
                        <td data-label="Description">${t.description || '-'}</td>
                        <td data-label="Amount" style="text-align: right; color: ${t.type === 'expense' ? 'var(--danger)' : 'var(--success)'};">
                            ${t.type === 'expense' ? '-' : '+'} ${formatCurrency(t.displayAmount, preferredCurrency)}
                        </td>
                    </tr>
                `;
    }).join('')}
            </tbody>
        </table>
    `;
}

// Remove updateGoalsPreview - goals are now shown in stats

// Currency change is now handled in settings page

// Handle add expense
async function handleAddExpense(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        amount: parseFloat(formData.get('amount')),
        currency: formData.get('currency'),
        category: formData.get('category'),
        description: formData.get('description') || null,
        date: formData.get('date')
    };

    try {
        await expensesAPI.create(data);
        closeExpenseModal();
        showNotification('Expense added successfully', 'success');
        await loadDashboardData();
        if (typeof window.updateNotificationBadge === 'function') window.updateNotificationBadge();
    } catch (error) {
        // If offline, add to queue
        if (!navigator.onLine || error.message.includes('offline')) {
            addToQueue(data);
            closeExpenseModal();
            showNotification('Expense queued for sync when online', 'info');
        } else {
            showNotification(error.message || 'Error adding expense', 'error');
        }
    }
}

// Handle add income (with goal allocation support)
async function handleAddIncome(e) {
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
            savedIncome = await incomeAPI.update(incomeId, data);
            showNotification('Income updated successfully', 'success');
        } else {
            savedIncome = await incomeAPI.create(data);
            showNotification('Income added successfully', 'success');

            // Get the actual income ID from response
            const actualIncomeId = savedIncome?.id || savedIncome?.income?.id || savedIncome?.data?.id;
            const incomeRecordForAllocation = actualIncomeId || savedIncome;

            // Handle goal allocation (same logic as income page)
            if (allocateToGoal && goalId && goalAmount > 0) {
                await allocateIncomeToGoal(goalId, goalAmount, data.currency, incomeRecordForAllocation);
                const remainingAmount = data.amount - goalAmount;
                if (remainingAmount > 0) {
                    await processAutoAllocationRules(remainingAmount, data.currency, incomeRecordForAllocation, goalId);
                }
            } else {
                await processAutoAllocationRules(data.amount, data.currency, incomeRecordForAllocation);
            }
        }

        closeIncomeModal();
        await loadDashboardData();

        if (typeof window.updateNotificationBadge === 'function') window.updateNotificationBadge();

        // Refresh notifications
        if (typeof loadNotifications === 'function') {
            setTimeout(() => loadNotifications(), 1000);
        }
    } catch (error) {
        showNotification(error.message || 'Error adding income', 'error');
    }
}

// Allocate income to goal (shared function) - Creates goal_allocation record
async function allocateIncomeToGoal(goalId, amount, currency, incomeRecord) {
    try {
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
        }

        // Always save locally as backup
        saveGoalAllocationRecord(incomeId, goalId, convertedAmount, goalCurrency);

        // Calculate new progress from all allocations
        const currentProgress = await calculateGoalProgressFromAllocations(goalId);
        const newProgress = currentProgress + convertedAmount;
        const percentage = target > 0 ? ((newProgress / target) * 100).toFixed(1) : '0';

        showNotification(
            `✅ ${formatCurrency(convertedAmount, goalCurrency)} allocated to "${goal.title}". Progress: ${percentage}%`,
            'success'
        );

        saveGoalAllocationNotification(goal, convertedAmount, newProgress, target);
    } catch (error) {
        console.error('Error allocating to goal:', error);
        showNotification('Error allocating to goal', 'error');
    }
}

// Save goal allocation record (shared function)
function saveGoalAllocationRecord(incomeId, goalId, amount, currency) {
    try {
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
    } catch (error) {
        console.error('Error saving allocation record:', error);
    }
}

// Get goal allocations (shared function)
function getGoalAllocations(incomeId) {
    try {
        const incomeIdStr = String(incomeId);
        const allocations = JSON.parse(localStorage.getItem('goalAllocations') || '{}');
        return allocations[incomeIdStr] || [];
    } catch (error) {
        return [];
    }
}

// Delete goal allocations for income (shared function)
async function deleteGoalAllocationsForIncome(incomeId) {
    try {
        const allocations = getGoalAllocations(incomeId);
        if (allocations.length === 0) return;

        // Delete from backend
        try {
            await goalAllocationsAPI.deleteByIncome(incomeId);
        } catch (apiError) {
            console.error('API error, deleting locally:', apiError);
        }

        // Remove from localStorage
        const incomeIdStr = String(incomeId);
        let allAllocations = JSON.parse(localStorage.getItem('goalAllocations') || '{}');
        delete allAllocations[incomeIdStr];
        localStorage.setItem('goalAllocations', JSON.stringify(allAllocations));
    } catch (error) {
        console.error('Error deleting goal allocations:', error);
    }
}

// Process auto-allocation rules (shared function) - Creates goal_allocation records
async function processAutoAllocationRules(incomeAmount, incomeCurrency, incomeRecord, excludeGoalId = null) {
    try {
        const rules = getAutoAllocationRules();
        const goalsRes = await goalsAPI.getAll();
        const goals = goalsRes.goals || [];

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
            console.error('Could not determine income ID for auto-allocation');
            return;
        }

        for (const [goalId, percentage] of Object.entries(rules)) {
            if (excludeGoalId && goalId == excludeGoalId) continue;

            const goal = goals.find(g => g.id == goalId);
            if (!goal) continue;

            const allocationAmount = (incomeAmount * percentage) / 100;
            const goalCurrency = goal.currency || 'UGX';
            const convertedAmount = convert(allocationAmount, incomeCurrency, goalCurrency);
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
            }

            // Always save locally as backup
            saveGoalAllocationRecord(incomeId, goalId, convertedAmount, goalCurrency);

            // Calculate new progress from all allocations
            const currentProgress = await calculateGoalProgressFromAllocations(goalId);
            const newProgress = currentProgress + convertedAmount;

            saveGoalAllocationNotification(goal, convertedAmount, newProgress, target, true);
        }
    } catch (error) {
        console.error('Error processing auto-allocation:', error);
    }
}

// Save goal allocation notification (shared function)
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

        if (notifications.length > 50) {
            notifications.splice(50);
        }

        localStorage.setItem('goalNotifications', JSON.stringify(notifications));
    } catch (error) {
        console.error('Error saving notification:', error);
    }
}

// Modal functions
function openAddExpenseModal() {
    document.getElementById('expenseModal').classList.add('active');
}

function closeExpenseModal() {
    document.getElementById('expenseModal').classList.remove('active');
    document.getElementById('expenseForm').reset();
    document.querySelector('#expenseForm input[name="date"]').valueAsDate = new Date();
}

function openAddIncomeModal() {
    const modal = document.getElementById('incomeModal');
    if (!modal) return;

    modal.classList.add('active');

    // Reset goal allocation
    const allocateCheckbox = document.getElementById('dashboardAllocateToGoal');
    const allocationSection = document.getElementById('dashboardGoalAllocationSection');
    if (allocateCheckbox) allocateCheckbox.checked = false;
    if (allocationSection) allocationSection.style.display = 'none';

    // Load goals
    loadDashboardGoalsForAllocation();
}

function closeIncomeModal() {
    const modal = document.getElementById('incomeModal');
    const form = document.getElementById('incomeForm');

    if (modal) modal.classList.remove('active');
    if (form) {
        form.reset();
        const dateInput = form.querySelector('input[name="date"]');
        if (dateInput) dateInput.valueAsDate = new Date();
    }

    // Reset goal allocation
    const allocateCheckbox = document.getElementById('dashboardAllocateToGoal');
    const allocationSection = document.getElementById('dashboardGoalAllocationSection');
    const infoDiv = document.getElementById('dashboardGoalAllocationInfo');
    if (allocateCheckbox) allocateCheckbox.checked = false;
    if (allocationSection) allocationSection.style.display = 'none';
    if (infoDiv) infoDiv.innerHTML = '';
}

// Close modals on outside click
document.getElementById('expenseModal').addEventListener('click', (e) => {
    if (e.target.id === 'expenseModal') closeExpenseModal();
});

document.getElementById('incomeModal').addEventListener('click', (e) => {
    if (e.target.id === 'incomeModal') closeIncomeModal();
});

// Logout is handled in navigation.js

// showNotification is imported from notifications.js and exposed globally by the module loader



// Load goals for dashboard allocation dropdown
async function loadDashboardGoalsForAllocation() {
    try {
        const response = await goalsAPI.getAll();
        const goals = response.goals || [];
        const goalSelect = document.getElementById('dashboardGoalSelect');

        if (goalSelect) {
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

// Toggle dashboard goal allocation
function toggleDashboardGoalAllocation() {
    const checkbox = document.getElementById('dashboardAllocateToGoal');
    const section = document.getElementById('dashboardGoalAllocationSection');
    if (checkbox && section) {
        section.style.display = checkbox.checked ? 'block' : 'none';
        if (checkbox.checked) {
            loadDashboardGoalsForAllocation();
        }
    }
}

// Setup dashboard goal allocation listeners
function setupDashboardGoalAllocation() {
    const amountInput = document.querySelector('#incomeForm input[name="amount"]');
    const goalAmountInput = document.getElementById('dashboardGoalAmount');
    const goalSelect = document.getElementById('dashboardGoalSelect');

    if (amountInput) {
        amountInput.addEventListener('input', () => {
            updateDashboardGoalAllocationInfo();
            if (goalAmountInput && !goalAmountInput.value && goalSelect && goalSelect.value) {
                const total = parseFloat(amountInput.value) || 0;
                goalAmountInput.value = total;
                updateDashboardGoalAllocationInfo();
            }
        });
    }
    if (goalAmountInput) {
        goalAmountInput.addEventListener('input', updateDashboardGoalAllocationInfo);
    }
    if (goalSelect) {
        goalSelect.addEventListener('change', () => {
            updateDashboardGoalAllocationInfo();
            if (amountInput && goalAmountInput) {
                const total = parseFloat(amountInput.value) || 0;
                if (total > 0 && !goalAmountInput.value) {
                    goalAmountInput.value = total;
                    updateDashboardGoalAllocationInfo();
                }
            }
        });
    }
}

// Update dashboard goal allocation info
function updateDashboardGoalAllocationInfo() {
    const amountInput = document.querySelector('#incomeForm input[name="amount"]');
    const goalAmountInput = document.getElementById('dashboardGoalAmount');
    const goalSelect = document.getElementById('dashboardGoalSelect');
    const infoDiv = document.getElementById('dashboardGoalAllocationInfo');
    const currencySelect = document.getElementById('incomeCurrency');

    if (!amountInput || !goalAmountInput || !goalSelect || !infoDiv) return;

    const totalAmount = parseFloat(amountInput.value) || 0;
    let allocatedAmount = parseFloat(goalAmountInput.value) || 0;
    const selectedGoalId = goalSelect.value;
    const selectedCurrency = currencySelect ? currencySelect.value : currentCurrency;

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
                Allocating ${percentage}% (${formatCurrency(allocatedAmount, selectedCurrency)})<br>
                <span style="color: var(--text-secondary);">Remaining: ${formatCurrency(remaining, selectedCurrency)}</span>
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

window.toggleDashboardGoalAllocation = toggleDashboardGoalAllocation;
window.openAddExpenseModal = openAddExpenseModal;
window.closeExpenseModal = closeExpenseModal;
window.openAddIncomeModal = openAddIncomeModal;
window.closeIncomeModal = closeIncomeModal;
window.updateDashboardGoalAllocationInfo = updateDashboardGoalAllocationInfo;

// ============================================
// NOTIFICATIONS SYSTEM
// ============================================

// Load and display notifications
async function loadNotifications() {
    const container = document.getElementById('notificationsContainer');
    if (!container) return;

    try {
        // Get goals, expenses, and income data
        const goalsRes = await goalsAPI.getAll();
        const goals = goalsRes.goals || [];

        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const from = thisMonth.toISOString().split('T')[0];

        const [expensesRes, incomeRes] = await Promise.all([
            expensesAPI.getAll({ from, to, limit: 100 }),
            incomeAPI.getAll({ from, to, limit: 100 })
        ]);

        const expenses = expensesRes.expenses || [];
        const income = incomeRes.income || [];

        const notifications = [];

        // Goal notifications
        goals.forEach(goal => {
            const progress = parseFloat(goal.progress) || 0;
            const target = parseFloat(goal.target_amount);
            const percentage = (progress / target) * 100;
            const deadline = goal.deadline ? new Date(goal.deadline) : null;

            if (deadline) {
                const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
                const remaining = target - progress;

                if (daysLeft > 0 && daysLeft <= 30) {
                    notifications.push({
                        type: 'goal',
                        icon: getIcon('target'),
                        title: `Goal: ${goal.title}`,
                        message: `${daysLeft} days left. You need ${formatCurrency(remaining, currentCurrency)} more to reach your target.`,
                        priority: daysLeft <= 7 ? 'high' : 'medium',
                        date: deadline
                    });
                } else if (percentage >= 100) {
                    notifications.push({
                        type: 'goal',
                        icon: `<span style="color: var(--success)">${getIcon('check')}</span>`,
                        title: `Goal Achieved: ${goal.title}`,
                        message: `Congratulations! You've reached your target of ${formatCurrency(target, currentCurrency)}.`,
                        priority: 'low',
                        date: now
                    });
                }
            }
        });

        // Recent expense notification
        if (expenses.length > 0) {
            const latestExpense = expenses.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            const expenseDate = new Date(latestExpense.date);
            const daysAgo = Math.floor((now - expenseDate) / (1000 * 60 * 60 * 24));

            if (daysAgo <= 1) {
                notifications.push({
                    type: 'expense',
                    icon: getIcon('expenses'),
                    title: 'Recent Expense Added',
                    message: `${latestExpense.category}: ${formatCurrency(convert(parseFloat(latestExpense.amount), latestExpense.currency, currentCurrency), currentCurrency)}`,
                    priority: 'low',
                    date: expenseDate
                });
            }
        }

        // Recent income notification
        if (income.length > 0) {
            const latestIncome = income.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            const incomeDate = new Date(latestIncome.date);
            const daysAgo = Math.floor((now - incomeDate) / (1000 * 60 * 60 * 24));

            if (daysAgo <= 1) {
                notifications.push({
                    type: 'income',
                    icon: getIcon('income'),
                    title: 'Recent Income Added',
                    message: `${latestIncome.source}: ${formatCurrency(convert(parseFloat(latestIncome.amount), latestIncome.currency, currentCurrency), currentCurrency)}`,
                    priority: 'low',
                    date: incomeDate
                });
            }
        }

        // Goal progress notifications from localStorage
        try {
            const goalNotifications = JSON.parse(localStorage.getItem('goalNotifications') || '[]');
            goalNotifications.slice(0, 5).forEach(notif => {
                const notifDate = new Date(notif.timestamp);
                const daysAgo = Math.floor((now - notifDate) / (1000 * 60 * 60 * 24));

                if (daysAgo <= 7) { // Show notifications from last 7 days
                    notifications.push({
                        type: 'goal_progress',
                        icon: notif.isAuto ? getIcon('ai') : getIcon('target'),
                        title: notif.isAuto ? `Auto-Allocated to ${notif.goalTitle}` : `Goal Progress: ${notif.goalTitle}`,
                        message: `${formatCurrency(notif.amount, currentCurrency)} allocated. Progress: ${notif.percentage}% (${formatCurrency(notif.progress, currentCurrency)} / ${formatCurrency(notif.target, currentCurrency)})`,
                        priority: parseFloat(notif.percentage) >= 100 ? 'high' : 'medium',
                        date: notifDate
                    });
                }
            });
        } catch (error) {
            console.error('Error loading goal notifications:', error);
        }

        // Sort by priority and date
        notifications.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return b.date - a.date;
        });

        // Render notifications
        if (notifications.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No notifications at this time.</p></div>';
        } else {
            container.innerHTML = notifications.map(notif => `
                <div style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; gap: 12px; align-items: start;">
                    <div style="font-size: 24px;">${notif.icon}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${notif.title}</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">${notif.message}</div>
                        <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">
                            ${new Date(notif.date).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading notifications.</p></div>';
    }
}
// Clear AI chat (wrapper for the HTML Clear button)
function clearAiChat() {
    aiMessages = [];
    // Also clear localStorage cache so it doesn't repopulate on page reload
    localStorage.removeItem('aiMessages');
    const container = document.getElementById('aiChatMessages');
    if (container) {
        container.innerHTML = '';
        addAiMessage('assistant', 'Chat cleared! How can I help you with your finances today? 😊');
        renderAiMessages();
    }
    saveAiMessages();
}

window.clearAiChat = clearAiChat;
