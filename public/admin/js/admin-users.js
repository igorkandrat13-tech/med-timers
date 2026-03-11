import { apiRequest, showNotification } from './admin-utils.js';

let listenersInitialized = false;
let usersCache = [];

export async function loadUsers() {
    try {
        const data = await apiRequest('/api/users');
        usersCache = data.users || [];
        renderUsersTable(usersCache);
        initListeners();
    } catch (e) {
        showNotification(e.message || 'Ошибка загрузки пользователей', 'error');
    }
}

function initListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    const addBtn = document.getElementById('add-user-btn');
    const cancelBtn = document.getElementById('cancel-edit-user-btn');
    const fioEl = document.getElementById('add-user-fio');
    const pinEl = document.getElementById('add-user-pin');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const editIdEl = document.getElementById('edit-user-id');
            const isEdit = !!(editIdEl && String(editIdEl.value || '').trim());
            const fio = fioEl ? fioEl.value.trim() : '';
            const pin = pinEl ? pinEl.value.trim() : '';
            if (!fio) {
                showNotification('Введите ФИО', 'error');
                return;
            }
            try {
                if (isEdit) {
                    if (pin && !/^\d{4,10}$/.test(pin)) {
                        showNotification('ПИН должен быть 4-10 цифр', 'error');
                        return;
                    }
                    const id = parseInt(editIdEl.value, 10);
                    const body = { fio };
                    if (pin) body.pin = pin;
                    addBtn.disabled = true;
                    await apiRequest(`/api/users/${id}`, {
                        method: 'PUT',
                        body: JSON.stringify(body)
                    });
                    showNotification('Пользователь обновлён', 'success');
                    setEditMode(null);
                } else {
                    if (!/^\d{4,10}$/.test(pin)) {
                        showNotification('ПИН должен быть 4-10 цифр', 'error');
                        return;
                    }
                    addBtn.disabled = true;
                    await apiRequest('/api/users', {
                        method: 'POST',
                        body: JSON.stringify({ fio, pin })
                    });
                    showNotification('Пользователь добавлен', 'success');
                    if (fioEl) fioEl.value = '';
                    if (pinEl) pinEl.value = '';
                }
                loadUsers();
            } catch (e) {
                showNotification(e.message || 'Ошибка добавления', 'error');
            } finally {
                addBtn.disabled = false;
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            setEditMode(null);
        });
    }

    // Enter запускает действие добавления/сохранения
    if (fioEl && !fioEl._enterBound) {
        fioEl._enterBound = true;
        fioEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn?.click(); });
    }
    if (pinEl && !pinEl._enterBound) {
        pinEl._enterBound = true;
        pinEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn?.click(); });
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id}</td>
            <td>${escapeHtml(u.fio || '')}</td>
            <td>${u.active ? '✅ Активен' : '❌ Неактивен'}</td>
            <td>
                <button class="btn btn-edit" onclick="window.editUser(${u.id})">✏️</button>
                <button class="btn btn-delete" onclick="window.toggleUser(${u.id}, ${u.active ? 'false' : 'true'})">${u.active ? '⛔' : '✅'}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.loadUsers = loadUsers;

function setEditMode(user) {
    const fioEl = document.getElementById('add-user-fio');
    const pinEl = document.getElementById('add-user-pin');
    const editIdEl = document.getElementById('edit-user-id');
    const addBtn = document.getElementById('add-user-btn');
    const cancelBtn = document.getElementById('cancel-edit-user-btn');
    const fioLabel = document.getElementById('user-fio-label');
    const pinLabel = document.getElementById('user-pin-label');

    if (!fioEl || !pinEl || !editIdEl || !addBtn || !cancelBtn || !fioLabel || !pinLabel) return;

    if (!user) {
        editIdEl.value = '';
        fioEl.value = '';
        pinEl.value = '';
        pinEl.placeholder = '4-10 цифр';
        fioLabel.textContent = 'ФИО *';
        pinLabel.textContent = 'ПИН-код *';
        addBtn.textContent = '➕ Добавить';
        cancelBtn.style.display = 'none';
        return;
    }

    editIdEl.value = String(user.id);
    fioEl.value = user.fio || '';
    pinEl.value = '';
    pinEl.placeholder = 'Оставьте пустым, чтобы не менять';
    fioLabel.textContent = `ФИО (ID ${user.id}) *`;
    pinLabel.textContent = 'Новый ПИН (необязательно)';
    addBtn.textContent = '💾 Сохранить';
    cancelBtn.style.display = 'inline-block';
}

window.editUser = async (id) => {
    let user = usersCache.find(u => u.id === id);
    if (!user) {
        try {
            const data = await apiRequest('/api/users');
            usersCache = data.users || [];
            user = usersCache.find(u => u.id === id);
        } catch (e) {
            showNotification(e.message || 'Ошибка загрузки пользователей', 'error');
            return;
        }
    }
    if (!user) return;
    setEditMode(user);
};

window.toggleUser = async (id, active) => {
    try {
        await apiRequest(`/api/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ active: !!active })
        });
        showNotification(active ? 'Пользователь активирован' : 'Пользователь деактивирован', 'success');
        const editIdEl = document.getElementById('edit-user-id');
        if (editIdEl && parseInt(editIdEl.value || '', 10) === id && !active) {
            setEditMode(null);
        }
        loadUsers();
    } catch (e) {
        showNotification(e.message || 'Ошибка изменения статуса', 'error');
    }
};
