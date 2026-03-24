// Offline expense queue management

const OFFLINE_QUEUE_KEY = 'pendingExpenses';

/**
 * Get pending expenses from localStorage
 */
function getPendingExpenses() {
  const pending = localStorage.getItem(OFFLINE_QUEUE_KEY);
  return pending ? JSON.parse(pending) : [];
}

/**
 * Add expense to offline queue
 */
function addToQueue(expenseData) {
  const queue = getPendingExpenses();
  queue.push({
    ...expenseData,
    queuedAt: new Date().toISOString()
  });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Remove expense from queue
 */
function removeFromQueue(index) {
  const queue = getPendingExpenses();
  queue.splice(index, 1);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Clear all pending expenses
 */
function clearQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

/**
 * Sync pending expenses when online
 */
async function syncPendingExpenses() {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0 };
  }
  
  const queue = getPendingExpenses();
  if (queue.length === 0) {
    return { synced: 0, failed: 0 };
  }
  
  let synced = 0;
  let failed = 0;
  const newQueue = [];
  
  for (let i = 0; i < queue.length; i++) {
    const expense = queue[i];
    try {
      // Remove queuedAt before sending
      const { queuedAt, ...expenseData } = expense;
      await expensesAPI.create(expenseData);
      synced++;
    } catch (error) {
      console.error('Failed to sync expense:', error);
      newQueue.push(expense);
      failed++;
    }
  }
  
  if (synced > 0) {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
  }
  
  return { synced, failed };
}

// Listen for online event
window.addEventListener('online', () => {
  console.log('Back online, syncing pending expenses...');
  syncPendingExpenses().then(result => {
    if (result.synced > 0) {
      console.log(`Synced ${result.synced} expenses`);
      // Show notification if on dashboard
      if (window.showNotification) {
        showNotification(`Synced ${result.synced} pending expenses`, 'success');
      }
    }
  });
});

// Auto-sync on page load if online
if (navigator.onLine) {
  syncPendingExpenses();
}

