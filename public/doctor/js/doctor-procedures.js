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
        initProcedureDropdown();
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
    const prev = select.value;

    // Очищаем
    select.innerHTML = '<option value="">-- Выберите процедуру --</option>';

    // Заполняем активными процедурами
    const list = (procedures || []).filter(p => p && p.active);
    list.forEach(proc => {
        const option = document.createElement('option');
        option.value = proc.id; // ✅ Используем ID
        option.textContent = `${proc.name} (${proc.duration} мин)`;
        select.appendChild(option);
    });

    renderProcedureDropdownOptions(q);

    if (prev) {
      const exists = Array.from(select.options).some(o => o.value === prev);
      if (exists) select.value = prev;
    }

    updateProcedureLabel();
}

function initProcedureDropdown() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    const comboboxBtn = document.getElementById('procedure-combobox-btn');
    const dropdown = document.getElementById('procedure-dropdown');
    const searchEl = document.getElementById('procedure-search');
    const optionsEl = document.getElementById('procedure-options');
    const select = document.getElementById('global-procedure-select');

    if (!comboboxBtn || !dropdown || !searchEl || !optionsEl || !select) return;

    function open() {
        dropdown.classList.remove('hidden');
        comboboxBtn.setAttribute('aria-expanded', 'true');
        searchEl.value = '';
        renderProcedureDropdownOptions('');
        setTimeout(() => searchEl.focus(), 0);
    }
    function close() {
        dropdown.classList.add('hidden');
        comboboxBtn.setAttribute('aria-expanded', 'false');
    }

    comboboxBtn.addEventListener('click', () => {
        if (dropdown.classList.contains('hidden')) open();
        else close();
    });

    searchEl.addEventListener('input', () => {
        renderProcedureDropdownOptions(String(searchEl.value || '').trim().toLowerCase());
    });

    document.addEventListener('click', (e) => {
        const root = document.getElementById('procedure-combobox');
        if (!root) return;
        if (!root.contains(e.target)) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dropdown.classList.contains('hidden')) {
            close();
            comboboxBtn.focus();
        }
    });

    select.addEventListener('change', () => {
        updateProcedureLabel();
    });

    window.openProcedureDropdown = open;
    window.closeProcedureDropdown = close;
}

function renderProcedureDropdownOptions(query) {
    const optionsEl = document.getElementById('procedure-options');
    const select = document.getElementById('global-procedure-select');
    if (!optionsEl || !select) return;

    const list = (globalProcedures || [])
        .filter(p => p && p.active)
        .filter(p => !query || String(p.name || '').toLowerCase().includes(query))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));

    optionsEl.innerHTML = '';

    if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'procedure-option procedure-option-empty';
        empty.textContent = 'Ничего не найдено';
        optionsEl.appendChild(empty);
        return;
    }

    const current = select.value;
    list.forEach(proc => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `procedure-option${String(proc.id) === String(current) ? ' selected' : ''}`;
        btn.textContent = `${proc.name} (${proc.duration} мин)`;
        btn.addEventListener('click', () => {
            select.value = String(proc.id);
            select.dispatchEvent(new Event('change', { bubbles: true }));
            const dropdown = document.getElementById('procedure-dropdown');
            const comboboxBtn = document.getElementById('procedure-combobox-btn');
            dropdown?.classList.add('hidden');
            comboboxBtn?.setAttribute('aria-expanded', 'false');
        });
        optionsEl.appendChild(btn);
    });
}

function updateProcedureLabel() {
    const select = document.getElementById('global-procedure-select');
    const label = document.getElementById('procedure-selected-label');
    if (!select || !label) return;
    const id = select.value;
    if (!id) {
        label.textContent = '-- Выберите процедуру --';
        return;
    }
    const proc = globalProcedures.find(p => String(p.id) === String(id));
    label.textContent = proc ? `${proc.name} (${proc.duration} мин)` : '-- Выберите процедуру --';
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
