// ==================== УПРАВЛЕНИЕ ПРОЦЕДУРАМИ ====================
import { apiRequest, showNotification } from './admin-utils.js';

export async function loadProcedures() {
    try {
        const procedures = await apiRequest('/api/procedures');
        renderProceduresTable(procedures);
    } catch (error) {
        console.error('Ошибка загрузки процедур:', error);
    }
}

function renderProceduresTable(procedures) {
    const tbody = document.getElementById('procedures-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    procedures.forEach(proc => {
        const tr = document.createElement('tr');
        // Проверка на наличие stages для отображения иконки
        const hasStagesIcon = proc.stages && proc.stages.length > 0 ? ' 📋 ' : '';
        tr.innerHTML = `
            <td>${proc.id}</td>
            <td>${hasStagesIcon}${proc.name}</td>
            <!-- ✅ ИСПРАВЛЕНО: используем toFixed(1) для отображения дробей -->
            <td>${parseFloat(proc.duration).toFixed(1)}</td>
            <td>${proc.active ? ' ✅ Активна' : ' ❌ Неактивна'}</td>
            <td>${proc.createdAt ? new Date(proc.createdAt).toLocaleDateString('ru-RU') : '-'}</td>
            <td>
                <button class="btn btn-edit" onclick="window.editProcedure(${proc.id})"> ✏️ </button>
                <button class="btn btn-delete" onclick="window.deleteProcedure(${proc.id})"> 🗑️ </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Глобальные функции
window.loadProcedures = loadProcedures;

// --- ЛОГИКА ДОБАВЛЕНИЯ ---
window.openAddProcedureModal = () => {
    document.getElementById('add-procedure-modal').style.display = 'flex';
    // Автоматически добавляем первый этап при открытии
    const container = document.getElementById('stages-container');
    if (container.children.length === 1) { // Только кнопка
        addStage();
    }
};

window.closeAddProcedureModal = () => {
    document.getElementById('add-procedure-modal').style.display = 'none';
    // Очистка полей
    document.getElementById('add-procedure-name').value = '';
    document.getElementById('add-procedure-duration').value = '';
    document.getElementById('stages-container').innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"><strong>Этапы:</strong><button type="button" onclick="addStage()" style="background: #10b981; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">+ Добавить этап</button></div>';
};

window.saveProcedure = async () => {
    const name = document.getElementById('add-procedure-name').value.trim();
    
    if (!name) {
        alert('Введите название процедуры');
        return;
    }
    
    let duration = 0;
    let stages = [];
    
    // Собираем этапы (теперь они всегда есть)
    const stageItems = document.querySelectorAll('#stages-container .stage-item');
    if (stageItems.length === 0) {
        alert('Добавьте хотя бы один этап');
        return;
    }
    
    stageItems.forEach((item, index) => {
        const stageName = item.querySelector('.stage-name').value.trim() || `Этап ${index + 1}`;
        // ✅ ИСПРАВЛЕНО: используем parseFloat для дробных чисел
        const stageDurationVal = parseFloat(item.querySelector('.stage-duration').value);
        
        if (isNaN(stageDurationVal) || stageDurationVal <= 0) {
            throw new Error(`Некорректное время в этапе ${index + 1}. Введите число больше 0.`);
        }

        stages.push({
            name: stageName,
            duration: stageDurationVal // Сохраняем дробное число
        });
        duration += stageDurationVal;
    });
    
    try {
        await apiRequest('/api/procedures', {
            method: 'POST',
            body: JSON.stringify({
                name,
                duration: parseFloat(duration.toFixed(2)), // Отправляем дробное число
                stages: stages // Теперь отправляем всегда
            })
        });
        closeAddProcedureModal();
        loadProcedures();
        showNotification('Процедура добавлена', 'success');
    } catch (error) {
        alert('Ошибка сохранения: ' + error.message);
    }
};

// Функции для работы с этапами (Добавление)
window.addStage = () => {
    const container = document.getElementById('stages-container');
    const existingStageItems = container.querySelectorAll('.stage-item');
    const stageCount = existingStageItems.length + 1;
    const stageDiv = document.createElement('div');
    stageDiv.className = 'stage-item';
    stageDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';
    
    // ✅ ИСПРАВЛЕНО: добавлены step="0.1" и min="0.1", значение по умолчанию 0.5
    stageDiv.innerHTML = `
        <input type="text" placeholder="Название этапа" value="Этап ${stageCount}"
               class="stage-name" style="flex: 2; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <input type="number" placeholder="Время (мин)" value="0.5" min="0.1" step="0.1"
               class="stage-duration" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" onchange="recalculateTotalDuration('add')">
        <button type="button" onclick="removeStage(this)" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;"> 🗑️ </button>
    `;
    const buttonRow = container.lastElementChild;
    container.insertBefore(stageDiv, buttonRow);
    
    // Пересчитываем общую длительность
    recalculateTotalDuration('add');
};

window.removeStage = (btn) => {
    btn.parentElement.remove();
    recalculateTotalDuration('add');
};

// --- ЛОГИКА РЕДАКТИРОВАНИЯ ---
window.editProcedure = async (id) => {
    const procedures = await apiRequest('/api/procedures');
    const proc = procedures.find(p => p.id === id);
    if (!proc) return;
    
    document.getElementById('edit-procedure-id').value = proc.id;
    document.getElementById('edit-procedure-name').value = proc.name;
    // ✅ Используем значение как есть (может быть дробным)
    document.getElementById('edit-procedure-duration').value = parseFloat(proc.duration).toFixed(1); 
    
    document.getElementById('edit-procedure-active').value = proc.active ? 'true' : 'false';
    
    const stagesContainer = document.getElementById('edit-stages-container');
    // Очищаем контейнер, но оставляем кнопку
    stagesContainer.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"><strong>Этапы:</strong><button type="button" onclick="addEditStage()" style="background: #10b981; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">+ Добавить этап</button></div>';
    
    if (proc.stages && proc.stages.length > 0) {
        renderEditStages(proc.stages);
    } else {
        // Если этапов нет (старая процедура), добавляем один пустой
        addEditStage();
    }
    
    document.getElementById('edit-procedure-modal').style.display = 'flex';
};

window.closeEditProcedureModal = () => {
    document.getElementById('edit-procedure-modal').style.display = 'none';
};

window.updateProcedure = async () => {
    const id = document.getElementById('edit-procedure-id').value;
    const name = document.getElementById('edit-procedure-name').value.trim();
    const active = document.getElementById('edit-procedure-active').value === 'true';
    
    if (!name) {
        alert('Введите название процедуры');
        return;
    }
    
    let duration = 0;
    let stages = [];
    
    const stageItems = document.querySelectorAll('#edit-stages-container .stage-item');
    if (stageItems.length === 0) {
        alert('Добавьте хотя бы один этап');
        return;
    }
    
    stageItems.forEach((item, index) => {
        const stageName = item.querySelector('.stage-name').value.trim() || `Этап ${index + 1}`;
        // ✅ ИСПРАВЛЕНО: используем parseFloat и проверку
        const stageDurationVal = parseFloat(item.querySelector('.stage-duration').value);
        
        if (isNaN(stageDurationVal) || stageDurationVal <= 0) {
            throw new Error(`Некорректное время в этапе ${index + 1}. Введите число больше 0.`);
        }

        stages.push({
            name: stageName,
            duration: stageDurationVal
        });
        duration += stageDurationVal;
    });
    
    try {
        await apiRequest(`/api/procedures/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                name,
                duration: parseFloat(duration.toFixed(2)), // Отправляем дробное число
                stages: stages, // Теперь отправляем всегда
                active
            })
        });
        closeEditProcedureModal();
        loadProcedures();
        showNotification('Процедура обновлена', 'success');
    } catch (error) {
        alert('Ошибка обновления: ' + error.message);
    }
};

window.deleteProcedure = async (id) => {
    if (!confirm('Деактивировать процедуру?')) return;
    await apiRequest(`/api/procedures/${id}`, { method: 'DELETE' });
    loadProcedures();
};

// Функции для работы с этапами (Редактирование)
window.addEditStage = () => {
    const container = document.getElementById('edit-stages-container');
    const existingStageItems = container.querySelectorAll('.stage-item');
    const stageCount = existingStageItems.length + 1;
    const stageDiv = document.createElement('div');
    stageDiv.className = 'stage-item';
    stageDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';
    
    // ✅ ИСПРАВЛЕНО: добавлены step="0.1" и min="0.1"
    stageDiv.innerHTML = `
        <input type="text" placeholder="Название этапа" value="Этап ${stageCount}"
               class="stage-name" style="flex: 2; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <input type="number" placeholder="Время (мин)" value="0.5" min="0.1" step="0.1"
               class="stage-duration" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" onchange="recalculateTotalDuration('edit')">
        <button type="button" onclick="removeEditStage(this)" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;"> 🗑️ </button>
    `;
    const buttonRow = container.lastElementChild;
    container.insertBefore(stageDiv, buttonRow);
    
    recalculateTotalDuration('edit');
};

window.removeEditStage = (btn) => {
    btn.parentElement.remove();
    recalculateTotalDuration('edit');
};

// Функция отрисовки этапов при редактировании
function renderEditStages(stages) {
    const container = document.getElementById('edit-stages-container');
    const buttonRow = container.lastElementChild;
    
    stages.forEach((stage, index) => {
        const stageDiv = document.createElement('div');
        stageDiv.className = 'stage-item';
        stageDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';
        
        // ✅ ИСПРАВЛЕНО: вставляем значение duration как есть (дробное) и добавляем step/min
        stageDiv.innerHTML = `
            <input type="text" placeholder="Название этапа" value="${stage.name || 'Этап ' + (index + 1)}"
                   class="stage-name" style="flex: 2; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <input type="number" placeholder="Время (мин)" value="${stage.duration}" min="0.1" step="0.1"
                   class="stage-duration" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" onchange="recalculateTotalDuration('edit')">
            <button type="button" onclick="removeEditStage(this)" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;"> 🗑️ </button>
        `;
        container.insertBefore(stageDiv, buttonRow);
    });
    
    recalculateTotalDuration('edit');
}

// ✅ НОВАЯ ФУНКЦИЯ: Пересчет общей длительности
function recalculateTotalDuration(mode) {
    const prefix = mode === 'add' ? 'add' : 'edit';
    const stageItems = document.querySelectorAll(`#${prefix}-stages-container .stage-item`);
    let total = 0;
    
    stageItems.forEach(item => {
        const val = parseFloat(item.querySelector('.stage-duration').value);
        if (!isNaN(val)) {
            total += val;
        }
    });
    
    document.getElementById(`${prefix}-procedure-duration`).value = parseFloat(total.toFixed(1));
}