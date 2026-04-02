import { apiRequest, showNotification } from './admin-utils.js';
import { loadCabins, getCabinsSortedByNumber, getCabins, getCabinDisplayName } from '../../shared/js/cabins-store.js';

function buildAllCabinsSet() {
  const set = new Set();
  const cabinCount = (getCabins() || []).length || 14;
  for (let i = 1; i <= cabinCount; i += 1) set.add(i);
  return set;
}

function normalizeCabins(value) {
  if (!Array.isArray(value)) return null;
  const cabinCount = (getCabins() || []).length || 14;
  const out = value
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= cabinCount);
  return out.length ? out : [];
}

function toSortedArray(set) {
  return Array.from(set).sort((a, b) => a - b);
}

function makeExplicitAllowedSet(proc) {
  const list = normalizeCabins(proc.allowedCabins);
  if (list === null) return buildAllCabinsSet();
  if (list.length === 0) return new Set();
  return new Set(list);
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
  const selectAllBtn = document.getElementById('cabin-bindings-select-all');
  const clearAllBtn = document.getElementById('cabin-bindings-clear-all');
  const countEl = document.getElementById('cabin-bindings-count');

  if (!openBtn || !modal || !saveBtn || !cabinSelect || !searchEl || !listEl || !selectAllBtn || !clearAllBtn) return;

  let procedures = [];
  const allowedMap = new Map();
  const originalKeyMap = new Map();

  function getCabinId() {
    const v = parseInt(String(cabinSelect.value || ''), 10);
    return Number.isFinite(v) ? v : 1;
  }

  function buildOriginalKey(proc) {
    const list = normalizeCabins(proc.allowedCabins);
    if (list === null) return 'ALL';
    if (list.length === 0) return 'NONE';
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

    if (countEl) {
      const total = list.length;
      const checked = list.filter(p => isAllowedInCabin(p.id, cabinId)).length;
      countEl.textContent = `${checked}/${total}`;
    }
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
    await loadCabins().catch(() => {});
    cabinSelect.innerHTML = '';
    const cabins = getCabinsSortedByNumber();
    for (const c of cabins) {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = String(c.name || getCabinDisplayName(c.id));
      cabinSelect.appendChild(opt);
    }
    if (cabins.length) cabinSelect.value = String(cabins[0].id);
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
    const cabinCount = (getCabins() || []).length || 14;
    const updates = procedures
      .filter((p) => p && p.id)
      .map((p) => {
        const set = allowedMap.get(p.id) || allCabins;
        const arr = toSortedArray(set);
        const key = arr.length === 0 ? 'NONE' : (arr.length === cabinCount ? 'ALL' : arr.join(','));
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
        const allowedCabins = u.arr.length === cabinCount ? undefined : u.arr;
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

  selectAllBtn.addEventListener('click', () => {
    const cabinId = getCabinId();
    listEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = true;
      const procId = parseInt(cb.value, 10);
      if (!Number.isFinite(procId)) return;
      const set = allowedMap.get(procId) || buildAllCabinsSet();
      set.add(cabinId);
      allowedMap.set(procId, set);
    });
    renderList();
  });

  clearAllBtn.addEventListener('click', () => {
    const cabinId = getCabinId();
    listEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = false;
      const procId = parseInt(cb.value, 10);
      if (!Number.isFinite(procId)) return;
      const set = allowedMap.get(procId) || buildAllCabinsSet();
      set.delete(cabinId);
      allowedMap.set(procId, set);
    });
    renderList();
  });
}

document.addEventListener('DOMContentLoaded', initCabinBindings);
