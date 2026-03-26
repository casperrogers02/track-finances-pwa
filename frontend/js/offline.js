// Offline data queue management for all data types

const OFFLINE_QUEUE_KEY = 'spendwiseOfflineQueue';

/**
 * Get all pending offline actions
 */
function getOfflineQueue() {
  const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
  return queue ? JSON.parse(queue) : [];
}

/**
 * Add action to offline queue
 */
function addToOfflineQueue(action, dataType, data) {
  const queue = getOfflineQueue();
  queue.push({
    id: generateId(),
    action, // 'create', 'update', 'delete'
    dataType, // 'expense', 'income', 'goal'
    data,
    queuedAt: new Date().toISOString()
  });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  console.log(`Added ${action} ${dataType} to offline queue`);
}

/**
 * Remove action from queue
 */
function removeFromQueue(index) {
  const queue = getOfflineQueue();
  queue.splice(index, 1);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Clear all pending actions
 */
function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

/**
 * Generate unique ID for queue items
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Sync all pending actions when online
 */
async function syncOfflineQueue() {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, remaining: 0 };
  }
  
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { synced: 0, failed: 0, remaining: 0 };
  }
  
  let synced = 0;
  let failed = 0;
  const newQueue = [];
  
  console.log(`Syncing ${queue.length} offline actions...`);
  
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      await syncQueueItem(item);
      synced++;
      console.log(`Successfully synced ${item.action} ${item.dataType}`);
    } catch (error) {
      console.error(`Failed to sync ${item.action} ${item.dataType}:`, error);
      newQueue.push(item);
      failed++;
    }
  }
  
  // Update queue with remaining items
  if (newQueue.length !== queue.length) {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
  }
  
  // Show notification if sync happened
  if (synced > 0 && window.showNotification) {
    window.showNotification(`Synced ${synced} items successfully${failed > 0 ? ` (${failed} failed)` : ''}`, 'success');
  }
  
  return { synced, failed, remaining: newQueue.length };
}

/**
 * Sync individual queue item
 */
async function syncQueueItem(item) {
  const { action, dataType, data } = item;
  
  // Import the appropriate API functions
  const { expensesAPI, incomeAPI, goalsAPI } = await import('./api.js');
  
  switch (dataType) {
    case 'expense':
      if (action === 'create') {
        await expensesAPI.create(data);
      } else if (action === 'update') {
        await expensesAPI.update(data.id, data);
      } else if (action === 'delete') {
        await expensesAPI.delete(data.id);
      }
      break;
      
    case 'income':
      if (action === 'create') {
        await incomeAPI.create(data);
      } else if (action === 'update') {
        await incomeAPI.update(data.id, data);
      } else if (action === 'delete') {
        await incomeAPI.delete(data.id);
      }
      break;
      
    case 'goal':
      if (action === 'create') {
        await goalsAPI.create(data);
      } else if (action === 'update') {
        await goalsAPI.update(data.id, data);
      } else if (action === 'delete') {
        await goalsAPI.delete(data.id);
      }
      break;
      
    default:
      throw new Error(`Unknown data type: ${dataType}`);
  }
}

/**
 * Enhanced API wrapper that handles offline queuing
 */
async function offlineApiCall(apiFunction, action, dataType, data) {
  if (navigator.onLine) {
    try {
      // Try online first
      const result = await apiFunction(data);
      return result;
    } catch (error) {
      console.log(`Online request failed, queuing for later:`, error);
      // Queue for later
      addToOfflineQueue(action, dataType, data);
      return { offline: true, message: 'Data saved locally, will sync when online' };
    }
  } else {
    // Offline, queue immediately
    addToOfflineQueue(action, dataType, data);
    return { offline: true, message: 'Data saved locally, will sync when online' };
  }
}

/**
 * Get offline statistics
 */
function getOfflineStats() {
  const queue = getOfflineQueue();
  const stats = {
    total: queue.length,
    expenses: 0,
    income: 0,
    goals: 0
  };
  
  queue.forEach(item => {
    stats[item.dataType + 's']++;
  });
  
  return stats;
}

// Listen for online event
window.addEventListener('online', () => {
  console.log('Back online, syncing pending data...');
  syncOfflineQueue().then(result => {
    console.log('Sync result:', result);
    
    // Trigger page refreshes for pages that might need updated data
    if (result.synced > 0) {
      window.dispatchEvent(new CustomEvent('offline-sync-complete', { detail: result }));
    }
  });
});

// Listen for service worker messages
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'ONLINE') {
      console.log('Service worker detected online status');
      syncOfflineQueue();
    }
  });
}

// Auto-sync on page load if online
if (navigator.onLine) {
  syncOfflineQueue();
}

// Export functions for use in other modules
window.offlineQueue = {
  getOfflineQueue,
  addToOfflineQueue,
  removeFromQueue,
  clearOfflineQueue,
  syncOfflineQueue,
  offlineApiCall,
  getOfflineStats
};

