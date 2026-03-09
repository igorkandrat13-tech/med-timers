// ==================== УПРАВЛЕНИЕ СПРАВОЧНИКОМ ПРОЦЕДУР ====================
import { apiRequest, showNotification } from './doctor-utils.js';

// Глобальный список процедур (для быстрого доступа)
let globalProcedures = [];

export async function loadProcedures() {
    try {
        const procedures = await apiRequest('/api/procedures/active');
        globalProcedures = procedures;
        renderProcedureSelect(procedures);
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

    // Очищаем
    select.innerHTML = '<option value="">-- Выберите процедуру --</option>';

    // Заполняем активными процедурами
    procedures.forEach(proc => {
        const option = document.createElement('option');
        option.value = proc.id; // ✅ Используем ID
        option.textContent = `${proc.name} (${proc.duration} мин)`;
        select.appendChild(option);
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