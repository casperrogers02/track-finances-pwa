const CACHE_VERSION = 'v1.3.2';
const STATIC_CACHE_NAME = `spendwise-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `spendwise-dynamic-${CACHE_VERSION}`;

// Assets to cache immediately on install
// Paths are relative to the frontend root (Vercel serves from /)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/expenses.html',
  '/income.html',
  '/goals.html',
  '/reports.html',
  '/settings.html',
  '/login.html',
  '/signup.html',
  '/notifications.html',
  '/css/style.css',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
  // Core JavaScript files
  '/js/api.js',
  '/js/currency.js',
  '/js/navigation.js',
  '/js/offline.js',
  '/js/theme.js',
  '/js/icons.js',
  '/js/dashboard.js',
  '/js/expenses.js',
  '/js/income.js',
  '/js/goals.js',
  '/js/reports.js',
  '/js/settings.js',
  '/js/notifications.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        // Use addAll with individual error handling so one failure doesn't break all caching
        return Promise.allSettled(
          STATIC_ASSETS.map(url => cache.add(url).catch(err => {
            console.warn(`Service Worker: Failed to cache ${url}:`, err);
          }))
        );
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE_NAME && name !== DYNAMIC_CACHE_NAME)
            .map((name) => {
              console.log('Service Worker: Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests entirely (API calls to Railway, CDN scripts, etc.)
  // Let the browser handle them normally
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle different types of requests
  if (request.destination === 'document') {
    // Handle HTML page requests
    event.respondWith(handleDocumentRequest(request));
  } else if (shouldCache(request)) {
    // Handle static assets
    event.respondWith(handleStaticAssetRequest(request));
  }
  // For anything else same-origin that shouldn't be cached, let browser handle it
});


// Handle document (HTML) requests
async function handleDocumentRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Return cached version and update in background
      updateCacheInBackground(request);
      return cachedResponse;
    }

    // Try network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }

    // Network failed, try to return cached index.html for navigation
    const indexResponse = await caches.match('/index.html');
    return indexResponse || new Response('Offline - No cached version available', { status: 503 });
  } catch (error) {
    console.error('Error handling document request:', error);
    return new Response('Offline - No cached version available', { status: 503 });
  }
}

// Handle static asset requests
async function handleStaticAssetRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Return cached version and update in background
      updateCacheInBackground(request);
      return cachedResponse;
    }

    // Try network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }

    // Network failed, return cached version if available
    return cachedResponse || new Response('Offline - Asset not available', { status: 503 });
  } catch (error) {
    console.error('Error handling static asset request:', error);
    return new Response('Offline - Asset not available', { status: 503 });
  }
}

// Update cache in background
function updateCacheInBackground(request) {
  fetch(request)
    .then((response) => {
      if (response.ok) {
        const cacheName = isStaticAsset(request.url) ? STATIC_CACHE_NAME : DYNAMIC_CACHE_NAME;
        return caches.open(cacheName).then((cache) => {
          cache.put(request, response);
        });
      }
    })
    .catch(() => {
      // Ignore network errors for background updates
    });
}

// Helper function to determine if asset should be cached
function shouldCache(request) {
  const url = new URL(request.url);
  
  // Cache static assets
  if (url.pathname.includes('/css/') || 
      url.pathname.includes('/js/') || 
      url.pathname.includes('/icons/') ||
      url.pathname.includes('/images/')) {
    return true;
  }
  
  // Cache HTML pages
  if (request.destination === 'document') {
    return true;
  }
  
  // Cache Google Fonts
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com')) {
    return true;
  }
  
  // Don't cache API calls
  if (url.pathname.includes('/api/')) {
    return false;
  }
  
  return false;
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    // Force update of specific resource
    caches.open(DYNAMIC_CACHE_NAME)
      .then((cache) => {
        cache.delete(event.data.url);
        fetch(event.data.url).then((response) => {
          if (response.ok) {
            cache.put(event.data.url, response);
          }
        });
      });
  }
});

// Periodic background sync for critical updates (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'critical-updates') {
    event.waitUntil(updateCriticalAssets());
  }
});

// Update critical assets in background
function updateCriticalAssets() {
  return Promise.all(
    STATIC_ASSETS.map((asset) => {
      return fetch(asset)
        .then((response) => {
          if (response.ok) {
            return caches.open(STATIC_CACHE_NAME)
              .then((cache) => {
                return cache.put(asset, response);
              });
          }
        })
        .catch(() => {
          // Ignore errors for background updates
        });
    })
  );
}

// Network status monitoring
self.addEventListener('online', () => {
  console.log('Service Worker: Client is online');
  // Trigger sync of any pending offline data
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'ONLINE' });
    });
  });
});

self.addEventListener('offline', () => {
  console.log('Service Worker: Client is offline');
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'OFFLINE' });
    });
  });
});
