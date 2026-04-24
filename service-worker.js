/* ═══════════════════════════════════════════════
   Smart Pharmacy Pro — Service Worker
   Version: 1.0.0
═══════════════════════════════════════════════ */

const CACHE_NAME = 'pharmacy-pro-v1';
const STATIC_CACHE = 'pharmacy-static-v1';

// الملفات اللي نحفظها للعمل بدون انترنت
const ASSETS_TO_CACHE = [
  './smart_pharmacy_pro_v3.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=Cairo:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
];

/* ── INSTALL ── */
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Caching static assets');
      // نحفظ الملفات الرئيسية فقط — Firebase بيشتغل دايماً أونلاين
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ── */
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== STATIC_CACHE)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
      );
    }).then(() => self.clients.claim())
  );
});

/* ── FETCH ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase requests — دايماً من الشبكة
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('openrouter.ai') ||
    url.hostname.includes('gstatic.com')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // لو Firebase ما اشتغل، رجّع رسالة خطأ
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // استراتيجية: شبكة أولاً، كاش كـ fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // احفظ نسخة في الكاش
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // لو ما في انترنت، جيب من الكاش
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // لو ما في كاش، رجّع الصفحة الرئيسية (SPA fallback)
          return caches.match('./smart_pharmacy_pro_v3.html');
        });
      })
  );
});

/* ── PUSH NOTIFICATIONS ── */
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'Smart Pharmacy Pro';
  const options = {
    body: data.body || 'حان موعد دوائك',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' },
    actions: [
      { action: 'open',    title: 'فتح التطبيق' },
      { action: 'dismiss', title: 'تجاهل' }
    ],
    dir: 'rtl',
    lang: 'ar'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* ── NOTIFICATION CLICK ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('smart_pharmacy') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('./smart_pharmacy_pro_v3.html');
    })
  );
});

/* ── SYNC (background sync) ── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-alarms') {
    console.log('[SW] Background sync: alarms');
  }
});
