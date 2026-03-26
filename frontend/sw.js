const CACHE_NAME = 'spendwise-v1';
const STATIC_CACHE_NAME = 'spendwise-static-v1';
const DYNAMIC_CACHE_NAME = 'spendwise-dynamic-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/frontend/index.html',
  '/frontend/dashboard.html',
  '/frontend/expenses.html',
  '/frontend/income.html',
  '/frontend/goals.html',
  '/frontend/reports.html',
  '/frontend/settings.html',
  '/frontend/login.html',
  '/frontend/signup.html',
  '/frontend/notifications.html',
  '/frontend/css/style.css',
  '/frontend/manifest.json',
  '/frontend/icons/icon-192x192.svg',
  '/frontend/icons/icon-512x512.svg',
  // Core JavaScript files
  '/frontend/js/api.js',
  '/frontend/js/currency.js',
  '/frontend/js/navigation.js',
  '/frontend/js/offline.js',
  '/frontend/js/theme.js',
  '/frontend/js/icons.js',
  '/frontend/js/dashboard.js',
  '/frontend/js/expenses.js',
  '/frontend/js/income.js',
  '/frontend/js/goals.js',
  '/frontend/js/reports.js',
  '/frontend/js/settings.js',
  '/frontend/js/notifications.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
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
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement Stale-While-Revalidate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle API requests differently
  if (url.pathname.includes('/api/')) {
    // For API requests, try network first, fallback to offline queue
    if (request.method === 'GET') {
      event.respondWith(
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              // Cache successful GET requests
              return caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse.clone());
                return networkResponse;
              });
            }
            throw new Error('Network response not ok');
          })
          .catch(() => {
            // Return cached version if available
            return caches.match(request);
          })
      );
    } else {
      // For POST/PUT/DELETE, just try network (let offline.js handle queuing)
      event.respondWith(fetch(request));
    }
    return;
  }
  
  // Handle navigation requests (HTML pages)
  if (request.destination === 'document') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version and update in background
            fetch(request).then((networkResponse) => {
              if (networkResponse.ok) {
                return caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
              }
            }).catch(() => {
              // Ignore network errors
            });
            return cachedResponse;
          }
          
          // Not in cache, try network
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                const responseToCache = networkResponse.clone();
                return caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                  cache.put(request, responseToCache);
                  return networkResponse;
                });
              }
              
              // If network fails and it's a navigation request, return cached index.html
              if (request.destination === 'document') {
                return caches.match('/frontend/index.html');
              }
              
              return networkResponse;
            })
            .catch(() => {
              // Network failed, return cached index.html for navigation requests
              if (request.destination === 'document') {
                return caches.match('/frontend/index.html');
              }
              
              // For other requests, return offline page or error
              return new Response('Offline - No cached version available', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
    return;
  }
  
  // Handle static assets (CSS, JS, images, fonts)
  if (shouldCache(request)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached immediately, update in background
            fetch(request).then((networkResponse) => {
              if (networkResponse.ok) {
                const cacheName = isStaticAsset(request.url) ? STATIC_CACHE_NAME : DYNAMIC_CACHE_NAME;
                return caches.open(cacheName).then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
              }
            }).catch(() => {
              // Ignore network errors
            });
            return cachedResponse;
          }
          
          // Not cached, fetch from network
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                const cacheName = isStaticAsset(request.url) ? STATIC_CACHE_NAME : DYNAMIC_CACHE_NAME;
                const responseToCache = networkResponse.clone();
                return caches.open(cacheName).then((cache) => {
                  cache.put(request, responseToCache);
                  return networkResponse;
                });
              }
              
              return networkResponse;
            })
            .catch(() => {
              // Network failed for static asset
              return new Response('Offline - Asset not available', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
  }
  
  // For everything else, try network
  event.respondWith(fetch(request));
});

// Helper function to determine if asset is static
function isStaticAsset(url) {
  const pathname = new URL(url).pathname;
  return pathname.includes('/css/') || 
         pathname.includes('/js/') || 
         pathname.includes('/icons/') || 
         pathname.includes('/images/') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.ico');
}

// Background fetch and update for HTML files
function fetchAndUpdate(request) {
  fetch(request)
    .then((response) => {
      if (response.ok) {
        return caches.open(DYNAMIC_CACHE_NAME)
          .then((cache) => {
            cache.put(request, response.clone());
          });
      }
    })
    .catch(() => {
      // Ignore network errors for background updates
    });
}

// Determine if request should be cached
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
