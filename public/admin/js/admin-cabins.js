import { apiRequest, showNotification } from './admin-utils.js';
import { loadCabins, getCabinsSortedByNumber } from '../../shared/js/cabins-store.js';
import { updatePageTitle } from './admin-app.js';

function initCabinsModal() {
  const openBtn = document.getElementById('cabins-btn');
  const modal = document.getElementById('cabins-modal');
  const closeX = document.getElementById('cabins-close-x');
  const cancelBtn = document.getElementById('cabins-cancel');
  const listEl = document.getElementById('cabins-list');
  const addNumberEl = document.getElementById('cabins-add-number');
  const addNameEl = document.getElementById('cabins-add-name');
  const addBtn = document.getElementById('cabins-add-btn');

  if (!openBtn || !modal || !listEl || !addNumberEl || !addNameEl || !addBtn) return;

  function closeModal() {
    modal.style.display = 'none';
  }

  function renderList() {
    const cabins = getCabinsSortedByNumber();
    listEl.innerHTML = '';
    cabins.forEach((c) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; justify-content:space-between; gap:10px; padding:8px 6px; border-bottom: 1px solid var(--border-color);';
      const left = document.createElement('div');
      left.textContent = `${c.number} — ${c.name || ''}`;
      left.style.cssText = 'font-weight:600; color: var(--text-main);';
      const right = document.createElement('div');
      right.textContent = `ID: ${c.id}`;
      right.style.cssText = 'color: var(--text-muted); font-weight:600;';
      row.appendChild(left);
      row.appendChild(right);
      listEl.appendChild(row);
    });
  }

  async function openModal() {
    modal.style.display = 'flex';
    await loadCabins().catch(() => {});
    renderList();
  }

  async function addCabin() {
    const number = parseInt(String(addNumberEl.value || ''), 10);
    const name = String(addNameEl.value || '').trim();
    if (!Number.isFinite(number) || number < 1) {
      showNotification('Введите корректный номер кабинки', 'error');
      addNumberEl.focus();
      return;
    }

    addBtn.disabled = true;
    addBtn.textContent = 'Добавляем...';
    try {
      await apiRequest('/api/cabins', {
        method: 'POST',
        body: JSON.stringify({ number, name })
      });
      addNumberEl.value = '';
      addNameEl.value = '';
      await loadCabins().catch(() => {});
      renderList();
      updatePageTitle();
      if (typeof window.initBedsDisplay === 'function') {
        window.initBedsDisplay();
      }
      if (typeof window.renderAdminTable === 'function') {
        window.renderAdminTable();
      }
      showNotification('Кабинка добавлена', 'success');
    } catch (e) {
      showNotification(e && e.message ? e.message : 'Ошибка добавления кабинки', 'error');
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = 'Добавить';
    }
  }

  openBtn.addEventListener('click', openModal);
  if (closeX) closeX.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  addBtn.addEventListener('click', addCabin);
  [addNumberEl, addNameEl].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addCabin();
      if (e.key === 'Escape') closeModal();
    });
  });
}

document.addEventListener('DOMContentLoaded', initCabinsModal);

