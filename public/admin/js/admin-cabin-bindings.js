import { apiRequest, showNotification } from './admin-utils.js';

const CABIN_COUNT = 14;

function buildAllCabinsSet() {
  const set = new Set();
  for (let i = 1; i <= CABIN_COUNT; i += 1) set.add(i);
  return set;
}

function normalizeCabins(value) {
  if (!Array.isArray(value)) return null;
  const out = value
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= CABIN_COUNT);
  return out.length ? out : [];
}

function toSortedArray(set) {
  return Array.from(set).sort((a, b) => a - b);
}

function makeExplicitAllowedSet(proc) {
  const list = normalizeCabins(proc.allowedCabins);
  if (list && list.length > 0) return new Set(list);
  return buildAllCabinsSet();
}

function initCabinBindings() {
  const openBtn = document.getElementById('cabin-bindings-btn');
  const modal = document.getElementById('cabin-bindings-modal');
  const closeX = document.getElementById('cabin-bindings-close-x');
  const cancelBtn = document.getElementById('cabin-bindings-cancel');
  const saveBtn = document.getElementById('cabin-bindings-save');
  const cabinSelect = document.getElementById('cabin-bindings-cabin');
  const searchEl = document.getElementById('cabin-bindings-search');
  const listEl = document.getElementById('cabin-bindings-list');

  if (!openBtn || !modal || !saveBtn || !cabinSelect || !searchEl || !listEl) return;

  let procedures = [];
  const allowedMap = new Map();
  const originalKeyMap = new Map();

  function getCabinId() {
    const v = parseInt(String(cabinSelect.value || ''), 10);
    return Number.isFinite(v) ? v : 1;
  }

  function buildOriginalKey(proc) {
    const list = normalizeCabins(proc.allowedCabins);
    if (!list || list.length === 0) return 'ALL';
    return list.slice().sort((a, b) => a - b).join(',');
  }

  function isAllowedInCabin(procId, cabinId) {
    const set = allowedMap.get(procId);
    if (!set) return true;
    return set.has(cabinId);
  }

  function renderList() {
    const cabinId = getCabinId();
    const q = String(searchEl.value || '').trim().toLowerCase();
    listEl.innerHTML = '';

    const list = procedures
      .filter((p) => p && p.active)
      .filter((p) => !q || String(p.name || '').toLowerCase().includes(q))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));

    list.forEach((p) => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = String(p.id);
      cb.checked = isAllowedInCabin(p.id, cabinId);
      cb.addEventListener('change', () => {
        const set = allowedMap.get(p.id) || buildAllCabinsSet();
        if (cb.checked) set.add(cabinId);
        else set.delete(cabinId);
        allowedMap.set(p.id, set);
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(` ${String(p.name || '')}`));
      listEl.appendChild(label);
    });
  }

  async function loadData() {
    procedures = await apiRequest('/api/procedures');
    allowedMap.clear();
    originalKeyMap.clear();
    procedures.forEach((p) => {
      allowedMap.set(p.id, makeExplicitAllowedSet(p));
      originalKeyMap.set(p.id, buildOriginalKey(p));
    });
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  async function openModal() {
    modal.style.display = 'flex';
    cabinSelect.innerHTML = '';
    for (let i = 1; i <= CABIN_COUNT; i += 1) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `Кабинка ${i}`;
      cabinSelect.appendChild(opt);
    }
    cabinSelect.value = '1';
    searchEl.value = '';
    listEl.innerHTML = '';
    try {
      await loadData();
      renderList();
    } catch (e) {
      showNotification(e && e.message ? e.message : 'Ошибка загрузки справочника процедур', 'error');
    }
  }

  async function saveChanges() {
    const allCabins = buildAllCabinsSet();
    const updates = procedures
      .filter((p) => p && p.id)
      .map((p) => {
        const set = allowedMap.get(p.id) || allCabins;
        const arr = toSortedArray(set);
        const key = arr.length === CABIN_COUNT ? 'ALL' : arr.join(',');
        return { id: p.id, key, arr };
      })
      .filter((u) => u.key !== originalKeyMap.get(u.id));

    if (updates.length === 0) {
      showNotification('Изменений нет', 'info');
      closeModal();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохраняем...';
    try {
      for (const u of updates) {
        const allowedCabins = (u.arr.length === CABIN_COUNT || u.arr.length === 0) ? [] : u.arr;
        await apiRequest(`/api/procedures/${u.id}`, {
          method: 'PUT',
          body: JSON.stringify({ allowedCabins })
        });
      }
      showNotification('Привязки обновлены', 'success');
      closeModal();
    } catch (e) {
      showNotification(e && e.message ? e.message : 'Ошибка сохранения', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить';
    }
  }

  openBtn.addEventListener('click', openModal);
  if (closeX) closeX.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  cabinSelect.addEventListener('change', renderList);
  searchEl.addEventListener('input', renderList);
  saveBtn.addEventListener('click', saveChanges);
}

document.addEventListener('DOMContentLoaded', initCabinBindings);

