function readBool(key, fallback) {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  return v === '1' || v === 'true';
}

function writeBool(key, value) {
  localStorage.setItem(key, value ? '1' : '0');
}

function updateLayoutVars() {
  const header = document.querySelector('header');
  const selector = document.querySelector('.procedure-selector');
  const headerH = header ? header.getBoundingClientRect().height : 0;
  const selectorH = selector ? selector.getBoundingClientRect().height : 0;
  const root = document.body || document.documentElement;
  root.style.setProperty('--doctor-header-height', `${Math.round(headerH)}px`);
  root.style.setProperty('--doctor-procedure-height', `${Math.round(selectorH)}px`);
  root.style.setProperty('--doctor-sticky-offset', `${Math.round(headerH + selectorH)}px`);
}

function setEventsCollapsed(collapsed) {
  document.body.classList.toggle('events-collapsed', collapsed);
  writeBool('doctor.eventsCollapsed', collapsed);
  const btn = document.getElementById('events-toggle');
  if (btn) btn.textContent = collapsed ? 'Журнал ▸' : 'Журнал ◂';
}

function initEventsToggle() {
  const btn = document.getElementById('events-toggle');
  if (!btn) return;
  setEventsCollapsed(readBool('doctor.eventsCollapsed', false));
  btn.addEventListener('click', () => {
    setEventsCollapsed(!document.body.classList.contains('events-collapsed'));
  });
}

function initScrollButtons() {
  const topBtn = document.getElementById('scroll-top');
  const bottomBtn = document.getElementById('scroll-bottom');

  topBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  bottomBtn?.addEventListener('click', () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  });
}

function updateActiveCount() {
  const el = document.getElementById('active-count');
  if (!el) return;
  const beds = typeof window.getBedsState === 'function' ? window.getBedsState() : null;
  if (!beds || !Array.isArray(beds)) {
    el.textContent = '';
    return;
  }
  const active = beds.filter(b => b && b.status && b.status !== 'idle').length;
  el.textContent = `⏱️ Активных: ${active}`;
}

window.updateActiveCount = updateActiveCount;

document.addEventListener('DOMContentLoaded', () => {
  initEventsToggle();
  initScrollButtons();
  updateLayoutVars();
  updateActiveCount();
  window.addEventListener('resize', () => updateLayoutVars(), { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(updateLayoutVars, 50), { passive: true });
  window.addEventListener('load', () => setTimeout(updateLayoutVars, 0), { passive: true });
  setTimeout(updateLayoutVars, 250);
});
