import { WebSocketManager } from '../../shared/js/websocket-manager.js';

let wsManager = new WebSocketManager('admin');

export function connectWebSocket() {
    wsManager.addConnectHandler(() => {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = '✅ Подключено';
            statusEl.style.backgroundColor = '#28a745';
        }
    });

    wsManager.addDisconnectHandler(() => {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = '❌ Отключено';
            statusEl.style.backgroundColor = '#dc3545';
        }
    });

    wsManager.addMessageHandler((data) => {
        if (data.type === 'state' || data.type === 'update_all') {
            if (typeof window.renderAdminTable === 'function') {
                window.renderAdminTable();
            }
        } else if (data.type === 'time_update') {
            if (typeof window.updateAdminTimers === 'function') {
                window.updateAdminTimers();
            }
        } else if (data.type === 'procedures_updated') {
            if (typeof window.setGlobalProcedures === 'function') {
                window.setGlobalProcedures(data.procedures);
            }
            if (typeof window.renderProceduresTable === 'function') {
                window.renderProceduresTable(data.procedures);
            }
        }
    });

    wsManager.connect();
}

export function getBedsState() {
    return wsManager.getBedsState();
}

// Attach to window for legacy access if needed
if (typeof window !== 'undefined') {
    window.getBedsState = getBedsState;
}
