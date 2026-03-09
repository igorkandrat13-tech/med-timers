// ==================== ГЛАВНЫЙ МОДУЛЬ ====================

import { connectWebSocket } from './admin-websocket.js';
import { initBedsDisplay } from './admin-timers.js';
import { initModalHandlers } from './admin-modal.js';
import { initAlarms } from './admin-alarms.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Инициализация админки...');
  
  connectWebSocket();
  initBedsDisplay();
  initModalHandlers();
  initAlarms();
  
  console.log('✅ Админка готова к работе');
});