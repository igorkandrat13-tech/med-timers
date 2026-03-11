// ==================== УПРАВЛЕНИЕ СПРАВОЧНИКОМ ПРОЦЕДУР ====================
import { apiRequest, showNotification } from './doctor-utils.js';

// Глобальный список процедур (для быстрого доступа)
let globalProcedures = [];
let listenersInitialized = false;

export async function loadProcedures() {
    try {
        const procedures = await apiRequest('/api/procedures/active');
        globalProcedures = procedures;
        renderProcedureSelect(procedures);
        initProcedureSearch();
        // ✅ Также обновляем глобальный список для других модулей
        window.procedures = procedures;
        console.log('✅ Справочник процедур загружен');
    } catch (error) {
        console.error('Ошибка загрузки процедур:', error);
    }
}

function renderProcedureSelect(procedures) {
    const select = document.getElementById('global-procedure-select');
    if (!select) return;

    const searchEl = document.getElementById('procedure-search');
    const q = String(searchEl?.value || '').trim().toLowerCase();
    const list = q
      ? (procedures || []).filter(p => String(p.name || '').toLowerCase().includes(q))
      : (procedures || []);
    const prev = select.value;

    // Очищаем
    select.innerHTML = '<option value="">-- Выберите процедуру --</option>';

    // Заполняем активными процедурами
    list.forEach(proc => {
        const option = document.createElement('option');
        option.value = proc.id; // ✅ Используем ID
        option.textContent = `${proc.name} (${proc.duration} мин)`;
        select.appendChild(option);
    });

    if (prev) {
      const exists = Array.from(select.options).some(o => o.value === prev);
      if (exists) select.value = prev;
    }
}

function initProcedureSearch() {
    if (listenersInitialized) return;
    listenersInitialized = true;
    const searchEl = document.getElementById('procedure-search');
    if (!searchEl) return;
    searchEl.addEventListener('input', () => {
        renderProcedureSelect(globalProcedures);
    });
}

// ✅ ИЗМЕНЕНО: теперь ищем по ID
export function getProcedureById(id) {
    if (!id) return null;
    return globalProcedures.find(p => p.id == id); // == для числового сравнения
}

export function setGlobalProcedures(procedures) {
    globalProcedures = procedures || [];
    renderProcedureSelect(globalProcedures.filter(p => p.active));
    window.procedures = globalProcedures;
}

// Глобальные функции
window.loadProcedures = loadProcedures;
window.getProcedureById = getProcedureById;
window.setGlobalProcedures = setGlobalProcedures;
