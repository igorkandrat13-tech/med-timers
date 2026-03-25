import { showNotification } from './utils.js';

const INACTIVITY_MS = 30 * 60 * 1000;

function initAdminAutoLogout() {
  let timerId = null;
  let lastActivity = Date.now();
  let isLoggingOut = false;

  async function doLogout() {
    if (isLoggingOut) return;
    isLoggingOut = true;
    try {
      showNotification('Сессия завершена из-за бездействия. Выполняем выход…', 'warning');
    } catch (_) {
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {
    } finally {
      window.location.href = '/auth/login.html?role=admin';
    }
  }

  function schedule() {
    if (timerId) clearTimeout(timerId);
    const now = Date.now();
    const elapsed = now - lastActivity;
    const remaining = Math.max(0, INACTIVITY_MS - elapsed);
    timerId = setTimeout(doLogout, remaining);
  }

  function markActivity() {
    lastActivity = Date.now();
    schedule();
  }

  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  events.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));
  window.addEventListener('focus', markActivity, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) markActivity();
  });

  schedule();
}

document.addEventListener('DOMContentLoaded', initAdminAutoLogout);
