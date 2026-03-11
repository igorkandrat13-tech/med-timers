import { apiRequest, showNotification } from './admin-utils.js';

let listenersInitialized = false;
let usersCache = [];

export async function loadUsers() {
    try {
        const data = await apiRequest('/api/users');
        usersCache = data.users || [];
        renderUsersTable(getFilteredUsers());
        initListeners();
    } catch (e) {
        showNotification(e.message || 'Ошибка загрузки пользователей', 'error');
    }
}

function getFilteredUsers() {
    const searchEl = document.getElementById('users-search');
    const q = String(searchEl?.value || '').trim().toLowerCase();
    if (!q) return usersCache;
    return usersCache.filter(u => String(u.fio || '').toLowerCase().includes(q));
}

function initListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    // Кнопка "Добавить пользователя" (открыть модалку)
    const openAddBtn = document.getElementById('open-add-user-btn');
    const addModal = document.getElementById('add-user-modal');
    const addCloseX = document.getElementById('add-user-close-x');
    const addCancel = document.getElementById('add-user-cancel');
    const addSave = document.getElementById('add-user-save');
    const addFio = document.getElementById('add-fio');
    const addPin = document.getElementById('add-pin');

    const editModal = document.getElementById('edit-user-modal');
    const editCloseX = document.getElementById('edit-user-close-x');
    const editCancel = document.getElementById('edit-user-cancel');
    const editSave = document.getElementById('edit-user-save');
    const editFio = document.getElementById('edit-fio');
    const editPin = document.getElementById('edit-pin');
    const editIdEl = document.getElementById('edit-user-id');
    const searchEl = document.getElementById('users-search');

    function openAddUserModal() {
        if (!addModal) return;
        if (addFio) addFio.value = '';
        if (addPin) addPin.value = '';
        addModal.style.display = 'flex';
        addFio?.focus();
    }
    function closeAddUserModal() { if (addModal) addModal.style.display = 'none'; }
    async function submitAddUser() {
        const fio = addFio?.value.trim() || '';
        const pin = addPin?.value.trim() || '';
        if (!fio) return showNotification('Введите ФИО', 'error');
        if (!/^\d{4,10}$/.test(pin)) return showNotification('ПИН должен быть 4-10 цифр', 'error');
        addSave.disabled = true;
        try {
            await apiRequest('/api/users', { method: 'POST', body: JSON.stringify({ fio, pin }) });
            showNotification('Пользователь добавлен', 'success');
            closeAddUserModal();
            loadUsers();
        } catch (e) {
            showNotification(e.message || 'Ошибка добавления', 'error');
        } finally {
            addSave.disabled = false;
        }
    }

    function closeEditUserModal() { if (editModal) editModal.style.display = 'none'; }
    async function submitEditUser() {
        const id = parseInt(editIdEl?.value || '0', 10);
        const fio = editFio?.value.trim() || '';
        const pin = editPin?.value.trim() || '';
        if (!id) return;
        if (!fio) return showNotification('Введите ФИО', 'error');
        if (pin && !/^\d{4,10}$/.test(pin)) return showNotification('ПИН должен быть 4-10 цифр', 'error');
        editSave.disabled = true;
        try {
            const body = { fio };
            if (pin) body.pin = pin;
            await apiRequest(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            showNotification('Пользователь обновлён', 'success');
            closeEditUserModal();
            loadUsers();
        } catch (e) {
            showNotification(e.message || 'Ошибка обновления', 'error');
        } finally {
            editSave.disabled = false;
        }
    }

    openAddBtn?.addEventListener('click', openAddUserModal);
    addCloseX?.addEventListener('click', closeAddUserModal);
    addCancel?.addEventListener('click', closeAddUserModal);
    addSave?.addEventListener('click', submitAddUser);
    addFio?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAddUser(); });
    addPin?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAddUser(); });
    addModal?.addEventListener('click', (e) => { if (e.target === addModal) closeAddUserModal(); });

    editCloseX?.addEventListener('click', closeEditUserModal);
    editCancel?.addEventListener('click', closeEditUserModal);
    editSave?.addEventListener('click', submitEditUser);
    editFio?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitEditUser(); });
    editPin?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitEditUser(); });
    editModal?.addEventListener('click', (e) => { if (e.target === editModal) closeEditUserModal(); });

    searchEl?.addEventListener('input', () => {
        renderUsersTable(getFilteredUsers());
    });
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
    const modal = document.getElementById('edit-user-modal');
    const editFio = document.getElementById('edit-fio');
    const editPin = document.getElementById('edit-pin');
    const editIdEl = document.getElementById('edit-user-id');
    if (!modal || !editFio || !editIdEl) return;
    editIdEl.value = String(user.id);
    editFio.value = user.fio || '';
    if (editPin) editPin.value = '';
    modal.style.display = 'flex';
    editFio.focus();
};

window.toggleUser = async (id, active) => {
    if (!active) {
        const user = usersCache.find(u => u.id === id);
        const fio = user ? user.fio : '';
        if (!confirm(`Деактивировать пользователя${fio ? ` «${fio}»` : ''}?`)) return;
    }
    try {
        await apiRequest(`/api/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ active: !!active })
        });
        showNotification(active ? 'Пользователь активирован' : 'Пользователь деактивирован', 'success');
        // если редактируется тот же пользователь — просто закрыть модалку
        const editIdEl = document.getElementById('edit-user-id');
        const editModal = document.getElementById('edit-user-modal');
        if (editIdEl && parseInt(editIdEl.value || '', 10) === id && !active && editModal) {
            editModal.style.display = 'none';
        }
        loadUsers();
    } catch (e) {
        showNotification(e.message || 'Ошибка изменения статуса', 'error');
    }
};
