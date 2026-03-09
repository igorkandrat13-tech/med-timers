// ==================== ОБЩИЕ УТИЛИТЫ ====================

/**
 * Форматирует оставшееся время в мм:сс
 * @param {number|object} remaining - миллисекунды или объект койки
 * @returns {string}
 */
export function formatTime(remaining) {
    let diff = 0;
    if (typeof remaining === 'object' && remaining !== null) {
        if (remaining.status === 'paused' && typeof remaining.remainingTime === 'number') {
            diff = remaining.remainingTime;
        } else if (remaining.status === 'running' && remaining.endTime) {
            diff = remaining.endTime - Date.now();
        }
    } else {
        diff = remaining;
    }

    if (typeof diff !== 'number' || isNaN(diff) || diff <= 0) {
        return '00:00';
    }
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Возвращает текст статуса
 * @param {string|object} status - статус-строка или объект койки
 * @returns {string}
 */
export function getStatusText(status) {
  let statusStr = status;
  let procedureName = '';
  
  if (typeof status === 'object' && status !== null) {
    statusStr = status.status;
    procedureName = status.procedureName;
  }

  const texts = {
    idle: 'Ожидание',
    running: procedureName || 'Идет',
    paused: 'На паузе',
    completed: 'Завершено',
    waiting: 'Ожидает'
  };
  return texts[statusStr] || statusStr;
}

/**
 * Возвращает CSS-класс для статуса
 * @param {string} status 
 * @returns {string}
 */
export function getStatusClass(status) {
  return `status-${status}`;
}

/**
 * Рассчитывает процент прогресса таймера
 * @param {object} bed - объект койки
 * @returns {number} - процент от 0 до 100
 */
export function getProgress(bed) {
    if (!bed || bed.status === 'idle') return 0;
    if (bed.status === 'completed') return 100;
    
    const totalMs = (bed.duration || 0) * 60 * 1000;
    if (totalMs <= 0) return 0;
    
    let remainingMs = 0;
    if (bed.status === 'paused') {
        remainingMs = bed.remainingTime || 0;
    } else if (bed.status === 'running' && bed.endTime) {
        remainingMs = bed.endTime - Date.now();
    }
    
    if (remainingMs <= 0) return 100;
    
    const progress = ((totalMs - remainingMs) / totalMs) * 100;
    return Math.min(Math.max(progress, 0), 100);
}

/**
 * Генерирует HTML для прогресс-бара
 * @param {number} percent 
 * @param {string} status 
 * @returns {string}
 */
export function getProgressBarHTML(percent, status) {
    return `
        <div class="progress-container">
            <div class="progress-bar ${status}" style="width: ${percent}%"></div>
        </div>
    `;
}

/**
 * Выполняет API запрос
 * @param {string} url 
 * @param {object} options 
 * @returns {Promise<any>}
 */
export async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || response.statusText);
  }
  return await response.json();
}

/**
 * Показывает уведомление
 * @param {string} message 
 * @param {string} type 
 */
export function showNotification(message, type = 'info') {
  const colors = {
    info: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  };
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 2000;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
