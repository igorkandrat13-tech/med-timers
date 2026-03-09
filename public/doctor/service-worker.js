const CACHE_NAME = 'med-timers-doctor-v1';
const ASSETS_TO_CACHE = [
  '/doctor/doctor.html',
  '/doctor/css/doctor-design.css',
  '/doctor/js/doctor-alarms.js',
  '/doctor/js/doctor-procedures.js',
  '/doctor/js/doctor-theme.js',
  '/doctor/js/doctor-timers.js',
  '/doctor/js/doctor-utils.js',
  '/doctor/js/doctor-websocket.js',
  '/shared/js/alarm-manager.js',
  '/shared/js/utils.js',
  '/shared/js/websocket-manager.js',
  '/favicon.ico.png',
  '/sounds/beep.mp3'
];

// Установка сервис-воркера и кэширование ресурсов
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Ресурсы планшета врача закэшированы');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Активация и удаление старых кэшей
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧹 Удален старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Перехват запросов (Network First, then Cache)
// Для медицинского приложения важно видеть актуальные данные, но уметь работать оффлайн (хотя бы запустить UI)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
