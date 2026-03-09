import { WebSocketManager } from '../../shared/js/websocket-manager.js';

let wsManager = new WebSocketManager('doctor');
let previousBedsState = null;

export function connectWebSocket() {
    wsManager.addConnectHandler(() => {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = '✅ Подключено';
            statusEl.style.backgroundColor = '#28a745';
        }
        
        if (typeof window.loadProcedures === 'function') {
            window.loadProcedures();
        }
        
        if (typeof window.startLocalTimer === 'function') {
            window.startLocalTimer();
        }
        
        if (typeof window.addEventLog === 'function') {
            window.addEventLog('info', 'Подключение к серверу установлено');
        }
    });

    wsManager.addDisconnectHandler(() => {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = '❌ Отключено';
            statusEl.style.backgroundColor = '#dc3545';
        }
        
        if (typeof window.addEventLog === 'function') {
            window.addEventLog('info', 'Потеряно соединение. Переподключение...');
        }
    });

    wsManager.addMessageHandler((data) => {
        const bedsState = wsManager.getBedsState();

        if (data.type === 'state' || data.type === 'update_all') {
            detectStatusChanges(bedsState);
            
            if (typeof window.renderBedsGrid === 'function') {
                window.renderBedsGrid();
            }
            if (typeof window.updateSidebar === 'function') {
                window.updateSidebar();
            }
        } 
        else if (data.type === 'time_update') {
            if (typeof window.updateTimersUI === 'function') {
                window.updateTimersUI();
            }
        }
        else if (data.type === 'stage_completed') {
            handleStageCompleted(data, bedsState);
        }
        else if (data.type === 'completed') {
            handleProcedureCompleted(data, bedsState);
        }
        else if (data.type === 'procedures_updated') {
            if (typeof window.setGlobalProcedures === 'function') {
                window.setGlobalProcedures(data.procedures);
            }
        }
    });

    wsManager.connect();
}

function handleStageCompleted(data, bedsState) {
    if (typeof window.playAlarm === 'function') {
        window.playAlarm();
    }

    const bedId = data.bedId;
    const currentStage = data.currentStageIndex + 1;
    const totalStages = data.totalStages;

    const notification = document.getElementById('completion-notification');
    const text = document.getElementById('completion-text');
    if (notification && text) {
        text.textContent = `Этап ${currentStage} из ${totalStages} завершён! Нажмите «Следующий этап»`;
        notification.style.display = 'flex';
        setTimeout(() => {
            if (notification.style.display === 'flex') {
                window.closeCompletionNotification();
            }
        }, 10000);
    }

    if (typeof window.addEventLog === 'function') {
        const bed = bedsState[bedId - 1];
        const procName = bed?.procedureName || 'процедура';
        window.addEventLog('stage_completed', `Этап ${currentStage} из ${totalStages} завершён (${procName}) на койке ${bedId}`);
    }
}

function handleProcedureCompleted(data, bedsState) {
    if (typeof window.playAlarm === 'function') {
        window.playAlarm();
    }
    
    if (data.bedId) {
        const bed = bedsState[data.bedId - 1];
        if (bed && bed.procedureName) {
            showCompletionNotification(bed.procedureName, data.bedId);
        }
    }
    
    setTimeout(() => {
        if (typeof window.renderBedsGrid === 'function') {
            window.renderBedsGrid();
        }
        if (typeof window.updateSidebar === 'function') {
            window.updateSidebar();
        }
    }, 50);
}

function detectStatusChanges(newBeds) {
    if (!previousBedsState) {
        previousBedsState = JSON.parse(JSON.stringify(newBeds));
        return;
    }
    
    newBeds.forEach((bed, index) => {
        const bedId = index + 1;
        const prevBed = previousBedsState[index];
        if (!prevBed) return;
        
        if (bed.status !== prevBed.status) {
            handleStatusChange(bed, bedId, prevBed);
        }
    });
    
    previousBedsState = JSON.parse(JSON.stringify(newBeds));
}

function handleStatusChange(bed, bedId, prevBed) {
    const procName = bed.procedureName || prevBed.procedureName || 'процедуры';
    if (typeof window.addEventLog !== 'function') return;

    switch(bed.status) {
        case 'running':
            if (prevBed.status === 'idle') {
                window.addEventLog('start', `Запущена "${procName}" на койке ${bedId}`);
            } else if (prevBed.status === 'paused') {
                window.addEventLog('resume', `Возобновлена "${procName}" на койке ${bedId}`);
            }
            break;
        case 'paused':
            window.addEventLog('pause', `Пауза "${procName}" на койке ${bedId}`);
            break;
        case 'idle':
            if (prevBed.status === 'completed' || prevBed.status === 'running') {
                window.addEventLog('reset', `Сброшена койка ${bedId}`);
            }
            break;
        case 'completed':
            window.addEventLog('completed', `Завершена "${procName}" на койке ${bedId}`);
            break;
    }
}

function showCompletionNotification(procedureName, bedId) {
    const notification = document.getElementById('completion-notification');
    const text = document.getElementById('completion-text');
    
    if (notification && text) {
        text.textContent = `Процедура "${procedureName}" на койке ${bedId} завершена!`;
        notification.style.display = 'flex';
        setTimeout(() => window.closeCompletionNotification(), 10000);
    }
}

window.closeCompletionNotification = () => {
    const notification = document.getElementById('completion-notification');
    if (notification) notification.style.display = 'none';
};

export function getBedsState() {
    return wsManager.getBedsState();
}

export async function sendControlCommand(bedId, action, minutes = 0, procedureName = '') {
    try {
        const result = await wsManager.sendControl(bedId, action, {
            minutes,
            procedureName,
            operator: 'doctor'
        });
        console.log('✅ Команда отправлена:', result);
    } catch (err) {
        console.error('❌ API Error:', err);
    }
}

window.sendControlCommand = sendControlCommand;
window.getBedsState = getBedsState;

// ✅ Подключаемся только после полной загрузки всех модулей и DOM
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
});
