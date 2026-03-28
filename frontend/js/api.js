const API_BASE_URL = `https://track-finances-pwa-production.up.railway.app/api`;

// Get auth token from localStorage
export function getToken() {
  return localStorage.getItem('token');
}

// Set auth token
export function setToken(token) {
  localStorage.setItem('token', token);
}

// Remove auth token
export function removeToken() {
  localStorage.removeItem('token');
}

// Get user info
export function getUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

// Set user info
export function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// API request helper with proper error handling
export async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    // Check if response is actually JSON before parsing
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    // If not JSON, read as text to get error message
    if (!isJson) {
      const text = await response.text();
      console.error('Non-JSON response received:', text.substring(0, 200));

      if (!response.ok) {
        // Try to extract error from HTML if possible
        const errorMatch = text.match(/<title>(.*?)<\/title>/i) || text.match(/<h1>(.*?)<\/h1>/i);
        const errorMessage = errorMatch ? errorMatch[1] : `Server returned ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      throw new Error('Server returned non-JSON response. Please check the API endpoint.');
    }

    // Parse JSON response
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    // Check if offline and provide offline-friendly error
    if (!navigator.onLine) {
      throw new Error('offline');
    }

    // Re-throw with more context if it's a network error
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('offline');
    }

    throw error;
  }
}

// Auth API
export const authAPI = {
  signup: (data) => apiRequest('/signup', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  login: (data) => apiRequest('/login', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  me: () => apiRequest('/me'),

  logout: () => apiRequest('/logout', {
    method: 'POST'
  }),

  updateCurrency: (currency) => apiRequest('/currency', {
    method: 'PUT',
    body: JSON.stringify({ preferred_currency: currency })
  }),

  updateProfile: (data) => apiRequest('/profile', {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  changePassword: (data) => apiRequest('/password', {
    method: 'PUT',
    body: JSON.stringify(data)
  })
};

// Expenses API
export const expensesAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/expenses?${query}`);
  },

  create: (data) => apiRequest('/expenses', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id, data) => apiRequest(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  delete: (id) => apiRequest(`/expenses/${id}`, {
    method: 'DELETE'
  }),

  getSummary: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/expenses/summary?${query}`);
  }
};

// Income API
export const incomeAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/income?${query}`);
  },

  create: (data) => apiRequest('/income', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id, data) => apiRequest(`/income/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  delete: (id) => apiRequest(`/income/${id}`, {
    method: 'DELETE'
  }),

  getSummary: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/income/summary?${query}`);
  }
};

// Goals API
export const goalsAPI = {
  getAll: () => apiRequest('/goals'),

  create: (data) => apiRequest('/goals', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id, data) => apiRequest(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  delete: (id) => apiRequest(`/goals/${id}`, {
    method: 'DELETE'
  })
};

// Goal Allocations API - NEW: For tracking income-to-goal allocations
export const goalAllocationsAPI = {
  getAll: (params = {}) => {
    // Check if params is primitive value (legacy goalId support)
    if (params && typeof params !== 'object') {
      return apiRequest(`/goal-allocations?goal_id=${params}`);
    }
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/goal-allocations?${query}`);
  },

  create: (data) => apiRequest('/goal-allocations', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id, data) => apiRequest(`/goal-allocations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  delete: (id) => apiRequest(`/goal-allocations/${id}`, {
    method: 'DELETE'
  }),

  deleteByIncome: (incomeId) => apiRequest(`/goal-allocations/income/${incomeId}`, {
    method: 'DELETE'
  }),

  deleteByGoal: (goalId) => apiRequest(`/goal-allocations/goal/${goalId}`, {
    method: 'DELETE'
  })
};

// Reports API
export const reportsAPI = {
  getSummary: (period = 'month') => apiRequest(`/reports/summary?period=${period}`),

  export: (period = 'month', format = 'csv') => {
    return fetch(`${API_BASE_URL}/reports/export?period=${period}&format=${format}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
  }
};

// Categories API
export const categoriesAPI = {
  getAll: (type) => {
    const query = type ? `?type=${type}` : '';
    return apiRequest(`/categories${query}`);
  }
};

// AI Assistant API
export const aiAPI = {
  getHistory: () => apiRequest('/ai/history'),

  chat: async (message, history = [], context = '') => {
    try {
      const response = await apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, context })
      });
      return response;
    } catch (error) {
      console.error('AI API error:', error);
      throw error;
    }
  }
};

// Mobile Money Sync API
export const mobileMoneyAPI = {
  getSettings: () => apiRequest('/mobile-money/settings'),

  updateSettings: (settings) => apiRequest('/mobile-money/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  }),

  parseSMS: (smsText) => apiRequest('/mobile-money/parse-sms', {
    method: 'POST',
    body: JSON.stringify({ sms_text: smsText })
  }),

  uploadStatement: (file) => {
    const formData = new FormData();
    formData.append('statement', file);
    return fetch(`${API_BASE_URL}/mobile-money/upload-statement`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    }).then(res => res.json());
  },

  getAutoTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/mobile-money/transactions?${query}`);
  }
};

// Notifications API
export const notificationsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/notifications?${query}`);
  },

  getUnreadCount: () => apiRequest('/notifications/unread-count'),

  markAsRead: (id) => apiRequest(`/notifications/${id}/read`, {
    method: 'PUT'
  }),

  markAllAsRead: () => apiRequest('/notifications/mark-all-read', {
    method: 'PUT'
  }),

  create: (notification) => apiRequest('/notifications', {
    method: 'POST',
    body: JSON.stringify(notification)
  }),

  delete: (id) => apiRequest(`/notifications/${id}`, {
    method: 'DELETE'
  })
};
