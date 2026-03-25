import { showNotification } from './admin-utils.js';

function initAdminPassword() {
  const openBtn = document.getElementById('admin-password-btn');
  const modal = document.getElementById('admin-password-modal');
  const closeX = document.getElementById('admin-password-close-x');
  const cancelBtn = document.getElementById('admin-pass-cancel');
  const saveBtn = document.getElementById('admin-pass-save');
  const currentEl = document.getElementById('admin-pass-current');
  const nextEl = document.getElementById('admin-pass-new');
  const confirmEl = document.getElementById('admin-pass-confirm');
  const errEl = document.getElementById('admin-pass-error');

  if (!openBtn || !modal || !saveBtn || !currentEl || !nextEl || !confirmEl || !errEl) return;

  const closeModal = () => {
    modal.style.display = 'none';
  };

  const openModal = () => {
    errEl.textContent = '';
    currentEl.value = '';
    nextEl.value = '';
    confirmEl.value = '';
    modal.style.display = 'flex';
    setTimeout(() => currentEl.focus(), 0);
  };

  openBtn.addEventListener('click', openModal);
  if (closeX) closeX.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  async function savePassword() {
    errEl.textContent = '';
    const currentPassword = String(currentEl.value || '');
    const newPassword = String(nextEl.value || '');
    const confirmPassword = String(confirmEl.value || '');

    if (!currentPassword) {
      errEl.textContent = 'Введите текущий пароль';
      currentEl.focus();
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 64) {
      errEl.textContent = 'Новый пароль должен быть 6–64 символа';
      nextEl.focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      errEl.textContent = 'Новый пароль и подтверждение не совпадают';
      confirmEl.focus();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохраняем...';
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}
      if (!res.ok || !data || !data.success) {
        const msg = (data && data.error) ? data.error : (text || `HTTP ${res.status}`);
        throw new Error(msg);
      }
      showNotification('Пароль администратора обновлён', 'success');
      closeModal();
    } catch (e) {
      errEl.textContent = e && e.message ? e.message : 'Ошибка сохранения пароля';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить';
    }
  }

  saveBtn.addEventListener('click', savePassword);
  [currentEl, nextEl, confirmEl].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') savePassword();
      if (e.key === 'Escape') closeModal();
    });
  });
}

document.addEventListener('DOMContentLoaded', initAdminPassword);

