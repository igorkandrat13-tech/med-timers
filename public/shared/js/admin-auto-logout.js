import { showNotification } from './utils.js';

const INACTIVITY_MS = 30 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const STORAGE_KEY = 'mt_admin_last_activity';

function initAdminAutoLogout() {
  let timerId = null;
  let warnTimerId = null;
  let lastActivity = Date.now();
  let isLoggingOut = false;
  let warningShown = false;

  function readLastActivity() {
    try {
      const v = parseInt(String(localStorage.getItem(STORAGE_KEY) || ''), 10);
      if (Number.isFinite(v) && v > 0) return v;
    } catch (_) {
    }
    return Date.now();
  }

  function writeLastActivity(ts) {
    try {
      localStorage.setItem(STORAGE_KEY, String(ts));
    } catch (_) {
    }
  }

  function showLogoutModal() {
    const existing = document.getElementById('mt-admin-logout-modal');
    if (existing) return existing;

    const overlay = document.createElement('div');
    overlay.id = 'mt-admin-logout-modal';
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(0,0,0,0.55)',
      'z-index:99999',
      'padding:16px'
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'width:min(520px, 100%)',
      'background:var(--bg-panel, #111827)',
      'border:1px solid var(--border-color, rgba(255,255,255,0.12))',
      'border-radius:12px',
      'box-shadow:0 18px 60px rgba(0,0,0,0.35)',
      'color:var(--text-main, #f3f4f6)',
      'padding:18px'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Сессия завершена';
    title.style.cssText = 'font-size:18px;font-weight:800;margin-bottom:8px;';

    const text = document.createElement('div');
    text.textContent = 'Выход из кабинета из-за неактивности (30 минут). Сейчас откроется страница авторизации.';
    text.style.cssText = 'color:var(--text-muted, #9ca3af);line-height:1.35;margin-bottom:14px;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';

    const btn = document.createElement('button');
    btn.textContent = 'Перейти к входу';
    btn.type = 'button';
    btn.className = 'btn btn-save';
    btn.addEventListener('click', () => {
      window.location.href = '/auth/login.html?role=admin';
    });

    actions.appendChild(btn);
    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    return overlay;
  }

  function showWarningModal() {
    const existing = document.getElementById('mt-admin-warning-modal');
    if (existing) return existing;

    const overlay = document.createElement('div');
    overlay.id = 'mt-admin-warning-modal';
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(0,0,0,0.55)',
      'z-index:99998',
      'padding:16px'
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'width:min(560px, 100%)',
      'background:var(--bg-panel, #111827)',
      'border:1px solid var(--border-color, rgba(255,255,255,0.12))',
      'border-radius:12px',
      'box-shadow:0 18px 60px rgba(0,0,0,0.35)',
      'color:var(--text-main, #f3f4f6)',
      'padding:18px'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Осталась 1 минута';
    title.style.cssText = 'font-size:18px;font-weight:800;margin-bottom:8px;';

    const text = document.createElement('div');
    text.textContent = 'Нажмите «Продлить», чтобы не выйти из кабинета из-за неактивности.';
    text.style.cssText = 'color:var(--text-muted, #9ca3af);line-height:1.35;margin-bottom:14px;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;';

    const extendBtn = document.createElement('button');
    extendBtn.textContent = 'Продлить';
    extendBtn.type = 'button';
    extendBtn.className = 'btn btn-save';
    extendBtn.addEventListener('click', () => {
      hideWarningModal();
      warningShown = false;
      const now = Date.now();
      lastActivity = now;
      writeLastActivity(now);
      schedule();
    });

    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Выйти';
    logoutBtn.type = 'button';
    logoutBtn.className = 'btn btn-cancel';
    logoutBtn.addEventListener('click', () => {
      doLogout();
    });

    actions.appendChild(extendBtn);
    actions.appendChild(logoutBtn);
    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    return overlay;
  }

  function hideWarningModal() {
    const el = document.getElementById('mt-admin-warning-modal');
    if (el) el.remove();
  }

  async function doLogout() {
    if (isLoggingOut) return;
    isLoggingOut = true;
    try {
      hideWarningModal();
      showLogoutModal();
      showNotification('Сессия завершена из-за бездействия', 'warning');
    } catch (_) {
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {
    } finally {
      setTimeout(() => {
        window.location.href = '/auth/login.html?role=admin';
      }, 800);
    }
  }

  function schedule() {
    if (timerId) clearTimeout(timerId);
    if (warnTimerId) clearTimeout(warnTimerId);
    const now = Date.now();
    lastActivity = readLastActivity();
    const elapsed = now - lastActivity;
    const remaining = Math.max(0, INACTIVITY_MS - elapsed);
    timerId = setTimeout(doLogout, remaining);

    const warnRemaining = remaining - WARNING_MS;
    if (warnRemaining > 0) {
      warnTimerId = setTimeout(() => {
        if (isLoggingOut) return;
        if (warningShown) return;
        warningShown = true;
        try {
          showWarningModal();
        } catch (_) {
        }
      }, warnRemaining);
    } else if (remaining > 0 && remaining <= WARNING_MS) {
      if (!warningShown) {
        warningShown = true;
        try { showWarningModal(); } catch (_) {}
      }
    } else {
      warningShown = false;
      hideWarningModal();
    }
  }

  let lastMarkAt = 0;
  function markActivity() {
    const now = Date.now();
    if (now - lastMarkAt < 1200) return;
    lastMarkAt = now;
    lastActivity = now;
    writeLastActivity(now);
    warningShown = false;
    hideWarningModal();
    schedule();
  }

  writeLastActivity(lastActivity);

  const events = ['mousemove', 'mousedown', 'keydown', 'keyup', 'touchstart', 'scroll', 'click', 'input', 'change', 'paste', 'pointerdown'];
  events.forEach((evt) => {
    window.addEventListener(evt, markActivity, { passive: true, capture: true });
    document.addEventListener(evt, markActivity, { passive: true, capture: true });
  });
  window.addEventListener('focus', markActivity, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) markActivity();
  });

  schedule();

  setInterval(() => {
    if (isLoggingOut) return;
    const now = Date.now();
    const last = readLastActivity();
    if (now - last >= INACTIVITY_MS) doLogout();
  }, 15000);
}

document.addEventListener('DOMContentLoaded', initAdminAutoLogout);
