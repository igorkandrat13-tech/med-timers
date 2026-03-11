// ==================== УПРАВЛЕНИЕ ТАЙМЕРАМИ ====================
import { formatTime, getStatusText, getStatusClass, getProgress, getProgressBarHTML } from './admin-utils.js';
import { getBedsState } from './admin-websocket.js';

// Глобальные переменные
let procedures = [];
let modalTargetBedId = null;

const BED_COUNT = 14;

// Экспорт для глобального доступа
export function setGlobalProcedures(procList) {
    procedures = procList || [];
}

// ✅ Автоматически привязываем к window при загрузке модуля
if (typeof window !== 'undefined') {
    window.setGlobalProcedures = setGlobalProcedures;
}

export function initBedsDisplay() {
    const tbody = document.getElementById('beds-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    for (let i = 1; i <= BED_COUNT; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>Койка #${i}</td>
            <td id="bed-${i}-status" class="status-badge status-idle">Ожидание</td>
            <td id="bed-${i}-timer-cell">
                <span id="bed-${i}-timer">00:00</span>
                <div id="bed-${i}-progress-container" class="progress-container">
                    <div class="progress-bar idle" style="width: 0%"></div>
                </div>
            </td>
            <td id="bed-${i}-procedure">-</td>
            <td id="bed-${i}-duration">-</td>
            <td id="bed-${i}-actions">-</td>
        `;
        tbody.appendChild(row);
    }
}

export async function loadBedsState() {
    try {
        const response = await fetch('/api/state');
        const data = await response.json();
        if (data.beds) {
            window.bedsState = data.beds;
            if (typeof window.renderAdminTable === 'function') {
                window.renderAdminTable();
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки состояния:', error);
    }
}

export function updateBedsTable(beds) {
    if (!beds) return;
    beds.forEach((bed, index) => {
        updateBedRow(bed, index + 1);
    });
}

// ✅ Функция для отображения процедуры с этапами
function getProcedureCell(bed) {
    const { procedureName, currentStageIndex, stages } = bed;
    if (!procedureName) return '-';

    if (Array.isArray(stages) && stages.length > 0 && typeof currentStageIndex === 'number') {
        const totalStages = stages.length;
        const currentStageNum = currentStageIndex + 1;
        const stageName = stages[currentStageIndex]?.name || `Этап ${currentStageNum}`;

        return `<div style="font-size: 0.9rem; line-height: 1.4;">
                    <strong>${procedureName}</strong><br>
                    <span style="color:#10b981;">→ ${stageName} (${currentStageNum}/${totalStages})</span>
                </div>`;
    }

    return procedureName;
}

function updateBedRow(bed, bedId) {
    const statusEl = document.getElementById(`bed-${bedId}-status`);
    const timerEl = document.getElementById(`bed-${bedId}-timer`);
    const procEl = document.getElementById(`bed-${bedId}-procedure`);
    const durEl = document.getElementById(`bed-${bedId}-duration`);
    const actionsEl = document.getElementById(`bed-${bedId}-actions`);

    if (!statusEl || !timerEl || !procEl || !durEl || !actionsEl) return;

    // Обновляем статус
    statusEl.textContent = getStatusText(bed.status);
    statusEl.className = `status-badge ${getStatusClass(bed.status)}`;

    // Обновляем таймер
    if (bed.status === 'running' && bed.endTime) {
        const remaining = bed.endTime - Date.now();
        timerEl.textContent = formatTime(remaining);
    } else if (bed.status === 'paused' && typeof bed.remainingTime === 'number' && bed.remainingTime > 0) {
        timerEl.textContent = formatTime(bed.remainingTime);
    } else {
        timerEl.textContent = '00:00';
    }

    // Обновляем прогресс-бар
    const progressContainer = document.getElementById(`bed-${bedId}-progress-container`);
    if (progressContainer) {
        const percent = getProgress(bed);
        const progressBar = progressContainer.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.className = `progress-bar ${bed.status}`;
        }
    }

    // Обновляем процедуру
    procEl.innerHTML = getProcedureCell(bed);

    // Обновляем длительность
    durEl.textContent = bed.duration || '-';

    // Перерисовываем кнопки
    updateBedButtons(bed, bedId, actionsEl);
}

function updateBedButtons(bed, bedId, actionsEl) {
    if (!actionsEl) return;

    const { status, currentStageIndex, stages } = bed;
    const isMultiStage = Array.isArray(stages) && stages.length > 0;
    const hasNextStage = isMultiStage && (currentStageIndex !== null) && (currentStageIndex + 1) < stages.length;
    const isStageCompleted = status === 'paused' && typeof currentStageIndex === 'number' && currentStageIndex >= 0 && bed.remainingTime <= 0;

    let html = '';

    if (status === 'idle') {
        // ✅ Кнопка "Старт" — открывает модальное окно выбора процедуры
        html = `<button class="btn btn-start" onclick="event.stopPropagation(); window.openSelectProcedureModal(${bedId})">▶ Старт</button>`;
    } else if (status === 'running') {
        // ✅ Исправлено: добавлен класс btn-pause
        html = `<button class="btn btn-pause" onclick="event.stopPropagation(); window.handlePause(${bedId})">⏸ Пауза</button>
                <button class="btn btn-reset" onclick="event.stopPropagation(); window.handleReset(${bedId})">🔄 Сброс</button>`;
    } else if (status === 'paused') {
        if (isStageCompleted && hasNextStage) {
            html = `<button class="btn btn-next" onclick="event.stopPropagation(); window.handleNextStage(${bedId})">▶ Следующий этап</button>
                    <button class="btn btn-reset" onclick="event.stopPropagation(); window.handleReset(${bedId})">🔄 Сброс</button>`;
        } else {
            html = `<button class="btn btn-resume" onclick="event.stopPropagation(); window.handleResume(${bedId})">▶ Продолжить</button>
                    <button class="btn btn-reset" onclick="event.stopPropagation(); window.handleReset(${bedId})">🔄 Сброс</button>`;
        }
    } else if (status === 'completed') {
        html = `<button class="btn btn-ok" onclick="event.stopPropagation(); window.handleConfirmComplete(${bedId})" style="background:#10b981; color:white; font-weight:bold; border:2px solid #059669;">✅ ОК</button>`;
    }

    actionsEl.innerHTML = html;
}

// --- МОДАЛЬНОЕ ОКНО ВЫБОРА ПРОЦЕДУРЫ ---
export function openSelectProcedureModal(bedId) {
    modalTargetBedId = bedId;
    document.getElementById('modal-bed-id').textContent = bedId;

    const select = document.getElementById('modal-procedure-select');
    const durationInput = document.getElementById('modal-procedure-duration');

    // Если procedures пустой — загрузим их сейчас
    if (procedures.length === 0) {
        fetch('/api/procedures/active')
            .then(res => res.json())
            .then(activeProcs => {
                procedures = activeProcs;
                populateProcedureSelect(select, durationInput);
                document.getElementById('select-procedure-modal').style.display = 'flex';
            })
            .catch(e => {
                console.error('Ошибка загрузки процедур:', e);
                alert('Не удалось загрузить список процедур. Обновите страницу.');
            });
        return;
    }

     // ✅ Наполняем селект
    populateProcedureSelect(select, durationInput);
    document.getElementById('select-procedure-modal').style.display = 'flex';
}

function populateProcedureSelect(select, durationInput) {
    select.innerHTML = '<option value="">-- Выберите процедуру --</option>';
    const activeProcs = procedures.filter(p => p.active);

    activeProcs.forEach(proc => {
        const opt = document.createElement('option');
        opt.value = proc.id;
        opt.textContent = `${proc.name} (${proc.duration} мин)`;
        select.appendChild(opt);
    });

    select.onchange = () => {
        const procId = select.value;
        if (!procId) {
            durationInput.value = '';
            return;
        }
        const proc = activeProcs.find(p => p.id == procId);
        durationInput.value = proc?.duration || '';
    };
}

export function closeSelectProcedureModal() {
    document.getElementById('select-procedure-modal').style.display = 'none';
    modalTargetBedId = null;
}

// Привязка кнопок закрытия/действий в модалке выбора процедуры
document.addEventListener('DOMContentLoaded', () => {
    const closeX = document.getElementById('select-procedure-close-x');
    const cancelBtn = document.getElementById('select-procedure-cancel');
    const startBtn = document.getElementById('select-procedure-start');
    const modal = document.getElementById('select-procedure-modal');
    if (closeX && !closeX._spb) { closeX._spb = true; closeX.addEventListener('click', closeSelectProcedureModal); }
    if (cancelBtn && !cancelBtn._spb) { cancelBtn._spb = true; cancelBtn.addEventListener('click', closeSelectProcedureModal); }
    if (startBtn && !startBtn._spb) { startBtn._spb = true; startBtn.addEventListener('click', launchProcedureOnBed); }
    if (modal && !modal._spb) {
        modal._spb = true;
        modal.addEventListener('click', (e) => { if (e.target === modal) closeSelectProcedureModal(); });
    }
});
export async function launchProcedureOnBed() {
    const select = document.getElementById('modal-procedure-select');
    const procId = select.value;
    if (!procId) {
        alert('⚠️ Выберите процедуру');
        return;
    }

    const proc = procedures.find(p => p.id == procId);
    if (!proc) {
        alert('⚠️ Процедура не найдена');
        return;
    }

    try {
        await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bed: modalTargetBedId,
                action: 'start',
                minutes: proc.duration,
                procedureName: proc.name,
                operator: 'admin'
            })
        });
        closeSelectProcedureModal();
        if (typeof window.addEventLog === 'function') {
            window.addEventLog('start', `Запущена "${proc.name}" на койке ${modalTargetBedId}`);
        }
    } catch (e) {
        alert('Ошибка запуска процедуры');
        console.error(e);
    }
}

// --- ГЛОБАЛЬНЫЕ ФУНКЦИИ УПРАВЛЕНИЯ ---
window.openSelectProcedureModal = openSelectProcedureModal;
window.closeSelectProcedureModal = closeSelectProcedureModal;
window.launchProcedureOnBed = launchProcedureOnBed;

window.handlePause = async (bedId) => {
    try {
        await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bed: bedId,
                action: 'pause',
                operator: 'admin'
            })
        });
    } catch (e) {
        alert('Ошибка паузы');
    }
};

window.handleResume = async (bedId) => {
    try {
        await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bed: bedId,
                action: 'resume',
                operator: 'admin'
            })
        });
    } catch (e) {
        alert('Ошибка возобновления');
    }
};

window.handleNextStage = async (bedId) => {
    try {
        await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bed: bedId,
                action: 'next_stage',
                operator: 'admin'
            })
        });
    } catch (e) {
        alert('Ошибка перехода к следующему этапу');
    }
};

window.handleConfirmComplete = async (bedId) => {
    try {
        await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bed: bedId,
                action: 'reset',
                operator: 'admin'
            })
        });
    } catch (e) {
        alert('Ошибка подтверждения завершения');
    }
};

window.handleReset = async (bedId) => {
    if (!confirm(`Сбросить койку ${bedId}?`)) return;
    try {
        await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bed: bedId,
                action: 'reset',
                operator: 'admin'
            })
        });
    } catch (e) {
        alert('Ошибка сброса');
    }
};

// --- Экспорт ---
window.renderAdminTable = () => {
    const beds = getBedsState();
    updateBedsTable(beds);
};

window.updateAdminTimers = () => {
    const beds = getBedsState();
    beds.forEach((bed, index) => {
        const bedId = index + 1;
        const timerEl = document.getElementById(`bed-${bedId}-timer`);
        const progressContainer = document.getElementById(`bed-${bedId}-progress-container`);
        
        if (timerEl) {
            if (bed.status === 'running' && bed.endTime) {
                const remaining = bed.endTime - Date.now();
                timerEl.textContent = formatTime(remaining);
            } else if (bed.status === 'paused' && typeof bed.remainingTime === 'number' && bed.remainingTime > 0) {
                timerEl.textContent = formatTime(bed.remainingTime);
            } else {
                timerEl.textContent = '00:00';
            }
        }
        
        if (progressContainer) {
            const percent = getProgress(bed);
            const progressBar = progressContainer.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = `${percent}%`;
                progressBar.className = `progress-bar ${bed.status}`;
            }
        }
    });
};

// 🔥 ФИНАЛЬНАЯ ГАРАНТИЯ: привязка к window при завершении модуля
if (typeof window !== 'undefined') {
    window.openSelectProcedureModal = openSelectProcedureModal;
    window.closeSelectProcedureModal = closeSelectProcedureModal;
    window.launchProcedureOnBed = launchProcedureOnBed;
    window.handlePause = handlePause;
    window.handleResume = handleResume;
    window.handleNextStage = handleNextStage;
    window.handleConfirmComplete = handleConfirmComplete;
    window.handleReset = handleReset;
    window.renderAdminTable = renderAdminTable;
    window.updateAdminTimers = updateAdminTimers;
}
