// ==================== ГЛАВНЫЙ МОДУЛЬ ====================

import { connectWebSocket } from './admin-websocket.js';
import { initBedsDisplay } from './admin-timers.js';
import { initModalHandlers } from './admin-modal.js';
import { initAlarms } from './admin-alarms.js';
import { loadCabins } from '../../shared/js/cabins-store.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Инициализация админки...');
  
  loadCabins().catch(() => {});
  connectWebSocket();
  initBedsDisplay();
  initModalHandlers();
  initAlarms();
  
  console.log('✅ Админка готова к работе');
});
