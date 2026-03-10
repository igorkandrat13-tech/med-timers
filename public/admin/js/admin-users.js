import { apiRequest, showNotification } from './admin-utils.js';

let listenersInitialized = false;

export async function loadUsers() {
    try {
        const data = await apiRequest('/api/users');
        renderUsersTable(data.users || []);
        initListeners();
    } catch (e) {
        showNotification(e.message || 'Ошибка загрузки пользователей', 'error');
    }
}

function initListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    const addBtn = document.getElementById('add-user-btn');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const fioEl = document.getElementById('add-user-fio');
            const pinEl = document.getElementById('add-user-pin');
            const fio = fioEl ? fioEl.value.trim() : '';
            const pin = pinEl ? pinEl.value.trim() : '';
            if (!fio) {
                showNotification('Введите ФИО', 'error');
                return;
            }
            if (!/^\d{4,10}$/.test(pin)) {
                showNotification('ПИН должен быть 4-10 цифр', 'error');
                return;
            }
            try {
                await apiRequest('/api/users', {
                    method: 'POST',
                    body: JSON.stringify({ fio, pin })
                });
                if (fioEl) fioEl.value = '';
                if (pinEl) pinEl.value = '';
                showNotification('Пользователь добавлен', 'success');
                loadUsers();
            } catch (e) {
                showNotification(e.message || 'Ошибка добавления', 'error');
            }
        });
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

window.editUser = async (id) => {
    try {
        const data = await apiRequest('/api/users');
        const user = (data.users || []).find(x => x.id === id);
        if (!user) return;

        const fio = prompt('ФИО', user.fio || '');
        if (fio === null) return;
        const pin = prompt('Новый ПИН (оставьте пустым, чтобы не менять)', '');
        if (pin === null) return;

        const body = { fio: fio.trim() };
        if (pin.trim()) body.pin = pin.trim();

        await apiRequest(`/api/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        showNotification('Пользователь обновлён', 'success');
        loadUsers();
    } catch (e) {
        showNotification(e.message || 'Ошибка обновления', 'error');
    }
};

window.toggleUser = async (id, active) => {
    try {
        await apiRequest(`/api/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ active: !!active })
        });
        showNotification(active ? 'Пользователь активирован' : 'Пользователь деактивирован', 'success');
        loadUsers();
    } catch (e) {
        showNotification(e.message || 'Ошибка изменения статуса', 'error');
    }
};

