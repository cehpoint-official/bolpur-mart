const CACHE_NAME = 'bolpur-mart-v1.0.0';
const OFFLINE_URL = '/';

const STATIC_ASSETS = [
  '/',
  '/search',
  '/orders',
  '/account',
  '/checkout',
  // Add other static assets that should be cached
];

const API_CACHE_PATTERNS = [
  /^\/api\/products/,
  /^\/api\/categories/,
  /^\/api\/recommendations/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install event');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Cache install failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate event');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Claim clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    handleFetch(request)
  );
});

async function handleFetch(request) {
  const url = new URL(request.url);

  try {
    // API requests - Network First with fallback to cache
    if (url.pathname.startsWith('/api/')) {
      return await networkFirstStrategy(request);
    }

    // Static assets - Cache First
    if (STATIC_ASSETS.some(asset => url.pathname === asset)) {
      return await cacheFirstStrategy(request);
    }

    // Image requests - Cache First with expiration
    if (request.destination === 'image') {
      return await imageStrategy(request);
    }

    // All other requests - Stale While Revalidate
    return await staleWhileRevalidateStrategy(request);

  } catch (error) {
    console.error('Service Worker: Fetch failed:', error);

    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }

    // Return a basic offline response for other requests
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Network First Strategy - for API calls
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful API responses
    if (networkResponse.ok && API_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

// Cache First Strategy - for static assets
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Cache first strategy failed:', error);
    throw error;
  }
}

// Stale While Revalidate Strategy - for general requests
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok && networkResponse.status !== 206) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log('Service Worker: Stale while revalidate fetch failed:', error);
    });

  // Return cached version immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise;
}

// Image Strategy - Cache with expiration
async function imageStrategy(request) {
  const cachedResponse = await caches.match(request);

  // Check if cached image is still fresh (24 hours)
  if (cachedResponse) {
    const cachedDate = cachedResponse.headers.get('sw-cached-date');
    if (cachedDate) {
      const cacheTime = new Date(cachedDate).getTime();
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (now - cacheTime < maxAge) {
        return cachedResponse;
      }
    }
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      // Add timestamp header for cache expiration
      const responseWithTimestamp = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers: {
          ...Object.fromEntries(responseClone.headers.entries()),
          'sw-cached-date': new Date().toISOString()
        }
      });

      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, responseWithTimestamp);
    }

    return networkResponse;
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Background sync for failed API requests
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered:', event.tag);

  if (event.tag === 'cart-sync') {
    event.waitUntil(syncCartData());
  }

  if (event.tag === 'order-sync') {
    event.waitUntil(syncOrderData());
  }
});

async function syncCartData() {
  try {
    // Implementation for syncing cart data when online
    console.log('Service Worker: Syncing cart data');

    // Get pending cart updates from IndexedDB or localStorage
    // Send them to the server when connection is restored

  } catch (error) {
    console.error('Service Worker: Cart sync failed:', error);
  }
}

async function syncOrderData() {
  try {
    // Implementation for syncing order data when online
    console.log('Service Worker: Syncing order data');

    // Get pending orders from IndexedDB or localStorage
    // Send them to the server when connection is restored

  } catch (error) {
    console.error('Service Worker: Order sync failed:', error);
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event received');

  const options = {
    body: 'Your order is on the way!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'order-update',
    requireInteraction: true,
    actions: [
      {
        action: 'track',
        title: 'Track Order',
        icon: '/action-track.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/action-close.png'
      }
    ],
    data: {
      url: '/orders'
    }
  };

  if (event.data) {
    try {
      const pushData = event.data.json();
      options.body = pushData.body || options.body;
      options.data = pushData.data || options.data;
    } catch (error) {
      console.error('Service Worker: Error parsing push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification('Bolpur Mart', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        // If no existing window, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message handler for communication with the main app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('Service Worker: Registered successfully');
