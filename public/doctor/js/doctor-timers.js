import { getBedsState, sendControlCommand } from './doctor-websocket.js';
import { getProcedureById } from './doctor-procedures.js';
import { formatTime, getStatusText, getStatusClass, getProgress } from './doctor-utils.js';

let selectedBedId = null;
let selectedProcedureId = null; // ✅ НОВОЕ: ID выбранной процедуры
let localTimerInterval = null;

// Максимальное количество записей в логе
const MAX_LOG_ENTRIES = 50;

// Запуск локального таймера
export function startLocalTimer() {
    if (localTimerInterval) {
        clearInterval(localTimerInterval);
    }
    
    localTimerInterval = setInterval(() => {
        updateTimersUI();
    }, 100);
}

export function stopLocalTimer() {
    if (localTimerInterval) {
        clearInterval(localTimerInterval);
        localTimerInterval = null;
    }
}

// Функция добавления события в лог
export function addEventLog(type, text) {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // ✅ ИСПРАВЛЕНИЕ: используем firstElementChild вместо firstChild
    const lastEvent = eventsList.firstElementChild;
    if (lastEvent) {
        const lastTextElement = lastEvent.querySelector('.event-text');
        const lastText = lastTextElement ? lastTextElement.textContent : '';
        if (lastText === text) {
            return; // Не добавляем дубликат
        }
    }
    
    const eventItem = document.createElement('div');
    eventItem.className = `event-item event-${type}`;
    eventItem.innerHTML = `
        <span class="event-time">${timeString}</span>
        <span class="event-text">${text}</span>
    `;
    
    // Добавляем в начало списка
    eventsList.insertBefore(eventItem, eventsList.firstChild);
    
    // Удаляем старые записи если больше MAX_LOG_ENTRIES
    while (eventsList.children.length > MAX_LOG_ENTRIES) {
        eventsList.removeChild(eventsList.lastChild);
    }
    
    // Сохраняем в localStorage для сохранения после перезагрузки
    saveEventsToStorage();
}

// Очистка лога
export function clearEventsLog() {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) return;
    
    eventsList.innerHTML = `
        <div class="event-item event-info">
            <span class="event-time">${new Date().toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })}</span>
            <span class="event-text">Журнал очищен</span>
        </div>
    `;
    
    localStorage.removeItem('doctorEventsLog');
}

// Сохранение в localStorage
function saveEventsToStorage() {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) return;
    
    const events = [];
    for (let item of eventsList.children) {
        events.push({
            type: item.className.includes('event-info') ? 'info' :
                  item.className.includes('event-start') ? 'start' :
                  item.className.includes('event-pause') ? 'pause' :
                  item.className.includes('event-resume') ? 'resume' :
                  item.className.includes('event-completed') ? 'completed' :
                  item.className.includes('event-reset') ? 'reset' : 'info',
            time: item.querySelector('.event-time').textContent,
            text: item.querySelector('.event-text').textContent
        });
    }
    
    localStorage.setItem('doctorEventsLog', JSON.stringify(events.slice(0, MAX_LOG_ENTRIES)));
}

// Загрузка из localStorage
function loadEventsFromStorage() {
    const eventsList = document.getElementById('events-list');
    if (!eventsList) return;
    
    const stored = localStorage.getItem('doctorEventsLog');
    if (!stored) return;
    
    try {
        const events = JSON.parse(stored);
        eventsList.innerHTML = '';
        
        events.forEach(event => {
            const eventItem = document.createElement('div');
            eventItem.className = `event-item event-${event.type}`;
            eventItem.innerHTML = `
                <span class="event-time">${event.time}</span>
                <span class="event-text">${event.text}</span>
            `;
            eventsList.appendChild(eventItem);
        });
    } catch (e) {
        console.error('Ошибка загрузки логов:', e);
    }
}

export function renderBedsGrid() {
    const grid = document.getElementById('beds-grid');
    if (!grid) return;
    
    const beds = getBedsState();
    if (!beds || !Array.isArray(beds)) {
        return;
    }
    
    grid.innerHTML = '';
    
    beds.forEach((bed, index) => {
        const bedId = index + 1;
        const card = document.createElement('div');
        card.className = `bed-card ${bed.status} ${selectedBedId === bedId ? 'selected' : ''}`;
        card.onclick = () => selectBed(bedId);

        const statusText = getStatusText(bed);
        const timerText = formatTime(bed);
        const procedureText = getProcedureDisplay(bed); // ✅ Используем новую функцию
        const progressPercent = getProgress(bed);

        // Динамические кнопки в зависимости от статуса
        const buttonsHTML = getButtonsHTML(bed, bedId);

        card.innerHTML = `
            <div class="bed-ring" style="--p:${progressPercent};">
              <div class="bed-number">Койка ${bedId}</div>
            </div>
            <div class="bed-status"><span class="status-chip ${bed.status}">${statusText}</span></div>
            ${bed.status !== 'idle' ? `
                <div class="bed-procedure" title="${procedureText}">
                    <span class="procedure-icon">💊</span>
                    <span class="procedure-name">${procedureText}</span>
                </div>
            ` : ''}
            <div class="bed-timer" id="timer-${bedId}">${timerText}</div>
            <div class="bed-controls">
                ${buttonsHTML}
            </div>
        `;
        grid.appendChild(card);
    });
}

// ✅ НОВАЯ: Функция для отображения процедуры с этапами
function getProcedureDisplay(bed) {
    const { procedureName, currentStageIndex, stages } = bed;
    if (!procedureName) return '—';

    if (Array.isArray(stages) && stages.length > 0 && typeof currentStageIndex === 'number') {
        const total = stages.length;
        const current = currentStageIndex + 1;
        const stageName = stages[currentStageIndex]?.name || `Этап ${current}`;
        return `${stageName} (${current}/${total})`;
    }

    return procedureName;
}

function getButtonsHTML(bed, bedId) {
    // ✅ Добавим отладку
    //console.log(`DEBUG getButtonsHTML: bedId=${bedId}, status=${bed.status}, procName="${bed.procedureName}", currentStageIndex=${bed.currentStageIndex}, stages=`, bed.stages);

    const { status, procedureName, currentStageIndex, stages } = bed;
    const isMultiStage = Array.isArray(stages) && stages.length > 0;
    const hasNextStage = isMultiStage && (currentStageIndex !== null) && (currentStageIndex + 1) < stages.length;

    // Определяем: этап завершён автоматически?
    const isStageCompleted = 
        status === 'paused' && 
        isMultiStage && 
        typeof currentStageIndex === 'number' &&
        currentStageIndex >= 0 &&
        bed.remainingTime <= 0;

    //console.log(`DEBUG: isMultiStage=${isMultiStage}, hasNextStage=${hasNextStage}, isStageCompleted=${isStageCompleted}`);

    if (status === 'idle') {
        return `<button class="btn-start" onclick="event.stopPropagation(); window.handleStart(${bedId})">▶ Старт</button>`;
    } else if (status === 'running') {
        return `<button class="btn-pause" onclick="event.stopPropagation(); window.handlePause(${bedId})">⏸ Пауза</button>
                <button class="btn-reset" onclick="event.stopPropagation(); window.handleReset(${bedId})">🔄 Сброс</button>`;
    } else if (status === 'paused') {
        if (isStageCompleted && hasNextStage) {
            // ✅ Показываем "Следующий этап"
            console.log(`DEBUG: Отображаем кнопку 'Следующий этап' для койки ${bedId}`);
            return `<button class="btn-next" onclick="event.stopPropagation(); window.handleNextStage(${bedId})">▶ Следующий этап</button>
                    <button class="btn-reset" onclick="event.stopPropagation(); window.handleReset(${bedId})">🔄 Сброс</button>`;
        } else {
            // Обычная пауза (без этапов или последний этап)
            console.log(`DEBUG: Отображаем кнопку 'Продолжить' для койки ${bedId}`);
            return `<button class="btn-start" onclick="event.stopPropagation(); window.handleResume(${bedId})">▶ Продолжить</button>
                    <button class="btn-reset" onclick="event.stopPropagation(); window.handleReset(${bedId})">🔄 Сброс</button>`;
        }
    } else if (status === 'completed') {
        return `<button class="btn-ok" onclick="event.stopPropagation(); window.handleConfirmComplete(${bedId})" style="background:#10b981; color:white; font-weight:bold; border:2px solid #059669;">✅ ОК</button>`;
    }
    return '';
}

export function selectBed(bedId) {
    selectedBedId = bedId;
    renderBedsGrid();
    updateSidebar();
}

export function updateSidebar() {
    const panel = document.getElementById('control-panel');
    const info = document.getElementById('selection-info');
    const selectedBedEl = document.getElementById('selected-bed');
    const details = document.getElementById('selected-bed-details');
    
    if (!selectedBedId) {
        if (info) info.style.display = 'block';
        if (details) details.style.display = 'none';
        return;
    }

    if (info) info.style.display = 'none';
    if (details) details.style.display = 'block';
    
    if (selectedBedEl) selectedBedEl.textContent = `Койка ${selectedBedId}`;

    const beds = getBedsState();
    const bed = beds[selectedBedId - 1];
    
    const statusEl = document.getElementById('info-status');
    const durationEl = document.getElementById('info-duration');
    const timerEl = document.getElementById('sidebar-timer');
    const procedureNameEl = document.getElementById('sidebar-procedure-name');
    
    if (statusEl) statusEl.textContent = getStatusText(bed);
    if (durationEl) durationEl.textContent = bed.duration || '-';
    if (timerEl) timerEl.textContent = formatTime(bed);
    if (procedureNameEl) procedureNameEl.textContent = getProcedureDisplay(bed);
    
    // ✅ УБРАНО: больше не отключаем выпадающий список в боковой панели
    // const procedureSelect = document.getElementById('procedure-select');
    // if (procedureSelect) {
    //     procedureSelect.disabled = (bed.status !== 'idle');
    // }
}

export function updateTimersUI() {
    const beds = getBedsState();
    if (!beds) return;
    
    beds.forEach((bed, index) => {
        const bedId = index + 1;
        const el = document.getElementById(`timer-${bedId}`);
        if (el) {
            el.textContent = formatTime(bed);
        }
        
        const card = el?.closest('.bed-card');
        const percent = getProgress(bed);
        const ring = card?.querySelector('.bed-ring');
        if (ring) {
            ring.style.setProperty('--p', String(percent));
        }
    });
    
    if (selectedBedId) {
        const bed = beds[selectedBedId - 1];
        const timerEl = document.getElementById('sidebar-timer');
        if (timerEl) {
            timerEl.textContent = formatTime(bed);
        }
    }
}

// ✅ ИЗМЕНЕНО: handleStart теперь использует глобально выбранную процедуру
window.handleStart = (bedId) => {
    // ✅ Берём выбранную процедуру из глобального состояния
    const selectedProcId = selectedProcedureId;
    if (!selectedProcId) {
        alert('⚠️ Сначала выберите процедуру в выпадающем списке сверху!');
        return;
    }
    
    const proc = getProcedureById(selectedProcId);
    if (!proc) {
        alert('⚠️ Процедура не найдена');
        return;
    }
    
    // Отправляем команду на сервер
    sendControlCommand(bedId, 'start', proc.duration, proc.name);
};

window.handlePause = (bedId) => {
    const beds = getBedsState();
    const bed = beds[bedId - 1];
    const action = bed.status === 'running' ? 'pause' : 'resume';
    sendControlCommand(bedId, action);
};

window.handleResume = async (bedId) => {
    try {
        // Всегда отправляем action: 'resume' — сервер сам решит, что делать
        await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bed: bedId,
                action: 'resume',
                operator: 'doctor' // или 'admin'
            })
        });
    } catch (e) {
        alert('Ошибка возобновления');
    }
};

window.handleReset = (bedId) => {
    if (confirm('Сбросить таймер койки ' + bedId + '?')) {
        sendControlCommand(bedId, 'reset');
    }
};

// ✅ Новая функция подтверждения завершения (БЕЗ окна подтверждения)
window.handleConfirmComplete = (bedId) => {
    const beds = getBedsState();
    const bed = beds[bedId - 1];
    const procName = bed.procedureName || 'процедура';
    
    // ✅ УБРАНО ОКНО ПОДТВЕРЖДЕНИЯ - сразу отправляем команду сброса
    sendControlCommand(bedId, 'reset');
    addEventLog('reset', `Подтверждено завершение "${procName}" на койке ${bedId}`);
};

// ✅ НОВАЯ: функция для перехода к следующему этапу
window.handleNextStage = (bedId) => {
    sendControlCommand(bedId, 'next_stage');
};

// Экспорт функций для глобального доступа
window.renderBedsGrid = renderBedsGrid;
window.updateSidebar = updateSidebar;
window.updateTimersUI = updateTimersUI;
window.selectBed = selectBed;
window.startLocalTimer = startLocalTimer;
window.stopLocalTimer = stopLocalTimer;
window.addEventLog = addEventLog;
window.clearEventsLog = clearEventsLog;

// Загружаем логи при старте
document.addEventListener('DOMContentLoaded', () => {
    loadEventsFromStorage();

    // ✅ Добавляем обработчик выбора процедуры
    const procSelect = document.getElementById('global-procedure-select');
    if (procSelect) {
        procSelect.onchange = (e) => {
            selectedProcedureId = e.target.value; // ✅ Сохраняем выбранную процедуру
            console.log('Выбрана процедура ID:', selectedProcedureId);
        };
    }
});
