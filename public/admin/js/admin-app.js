// ==================== ГЛАВНЫЙ МОДУЛЬ ====================

import { connectWebSocket } from './admin-websocket.js';
import { initBedsDisplay } from './admin-timers.js';
import { initModalHandlers } from './admin-modal.js';
import { initAlarms } from './admin-alarms.js';
import { loadCabins, getCabins } from '../../shared/js/cabins-store.js';

export function updatePageTitle() {
  const titleEl = document.getElementById('page-title');
  if (!titleEl) return;
  const cabins = getCabins();
  const count = cabins.length || 0;
  titleEl.textContent = `🕗 Панель управления таймерами (${count} кабинок)`;
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Инициализация админки...');
  
  await loadCabins().catch(() => {});
  updatePageTitle();
  connectWebSocket();
  initBedsDisplay();
  initModalHandlers();
  initAlarms();
  
  console.log('✅ Админка готова к работе');
});

// Attach to window for global access
if (typeof window !== 'undefined') {
  window.updatePageTitle = updatePageTitle;
}
