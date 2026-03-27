import { apiRequest, showNotification } from './admin-utils.js';

function fmtDateToday() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '') return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

function initLogDownload() {
  const openBtn = document.getElementById('download-log-btn');
  const modal = document.getElementById('download-log-modal');
  const closeX = document.getElementById('download-log-close-x');
  const cancelBtn = document.getElementById('download-log-cancel');

  const fromEl = document.getElementById('log-from');
  const toEl = document.getElementById('log-to');
  const bedsBox = document.getElementById('log-beds');
  const opsBox = document.getElementById('log-operators');
  const bedAllBtn = document.getElementById('log-bed-select-all');
  const bedClearBtn = document.getElementById('log-bed-clear');
  const opAllBtn = document.getElementById('log-operator-select-all');
  const opClearBtn = document.getElementById('log-operator-clear');
  const xlsxEl = document.getElementById('download-log-xlsx');

  if (!openBtn || !modal || !fromEl || !toEl || !bedsBox || !opsBox || !xlsxEl) return;

  function closeModal() {
    modal.style.display = 'none';
  }

  function getCheckedValues(container) {
    const out = [];
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.checked) out.push(cb.value);
    });
    return out;
  }

  function updateLinks() {
    const beds = getCheckedValues(bedsBox);
    const operators = getCheckedValues(opsBox);
    const from = fromEl.value || '';
    const to = toEl.value || '';
    const q = buildQuery({
      bed: beds.length ? beds.join(',') : '',
      operator: operators.length ? operators.join(',') : '',
      from, to
    });
    xlsxEl.href = `/api/logs.xlsx${q}`;
  }

  function parseFilename(contentDisposition) {
    const v = String(contentDisposition || '');
    const m = v.match(/filename\*?=(?:UTF-8''|")?([^\";]+)"?/i);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch (_) {
      return m[1];
    }
  }

  async function downloadXlsx(e) {
    e.preventDefault();
    updateLinks();
    const url = xlsxEl.href;
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status === 401) {
        showNotification('Требуется повторный вход', 'warning');
        window.location.href = '/auth/login.html?role=admin';
        return;
      }
      if (!res.ok) {
        if (res.status === 404) {
          showNotification('Эндпоинт XLSX не найден. Перезапустите сервер.', 'error');
          return;
        }
        const text = await res.text().catch(() => '');
        showNotification(text || `Ошибка скачивания (HTTP ${res.status})`, 'error');
        return;
      }
      const cd = res.headers.get('content-disposition');
      const filename = parseFilename(cd) || 'timers_log.xlsx';
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      showNotification(err && err.message ? err.message : 'Ошибка сети при скачивании', 'error');
    }
  }

  async function openModal() {
    modal.style.display = 'flex';
    if (!fromEl.value || !toEl.value) {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      fromEl.value = dateStr(from);
      toEl.value = dateStr(now);
    }

    bedsBox.innerHTML = '';
    for (let i = 1; i <= 14; i += 1) {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = String(i);
      cb.addEventListener('change', updateLinks);
      label.appendChild(cb);
      const text = document.createTextNode(` Койка ${i}`);
      label.appendChild(text);
      bedsBox.appendChild(label);
    }

    opsBox.innerHTML = '';

    try {
      const data = await apiRequest('/api/users');
      const list = data && data.users ? data.users : [];
      list.forEach((u) => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = String(u.fio || '');
        cb.addEventListener('change', updateLinks);
        label.appendChild(cb);
        const text = document.createTextNode(` ${String(u.fio || '')}`);
        label.appendChild(text);
        opsBox.appendChild(label);
      });
    } catch (_) {
    }

    updateLinks();
  }

  openBtn.addEventListener('click', openModal);
  xlsxEl.addEventListener('click', downloadXlsx);
  if (closeX) closeX.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  [fromEl, toEl].forEach((el) => {
    el.addEventListener('change', updateLinks);
    el.addEventListener('input', updateLinks);
  });

  const presetToday = document.getElementById('log-preset-today');
  const presetYesterday = document.getElementById('log-preset-yesterday');
  const preset7d = document.getElementById('log-preset-7d');
  const presetMonth = document.getElementById('log-preset-month');
  const presetPrevMonth = document.getElementById('log-preset-prev-month');

  function setRange(from, to) {
    fromEl.value = from;
    toEl.value = to;
    updateLinks();
  }

  function dateStr(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  if (presetToday) presetToday.addEventListener('click', () => {
    const now = new Date();
    const s = dateStr(now);
    setRange(s, s);
  });
  if (presetYesterday) presetYesterday.addEventListener('click', () => {
    const now = new Date();
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const s = dateStr(y);
    setRange(s, s);
  });
  if (preset7d) preset7d.addEventListener('click', () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    setRange(dateStr(from), dateStr(now));
  });
  if (presetMonth) presetMonth.addEventListener('click', () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    setRange(dateStr(from), dateStr(now));
  });
  if (presetPrevMonth) presetPrevMonth.addEventListener('click', () => {
    const now = new Date();
    const firstPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastPrev = new Date(now.getFullYear(), now.getMonth(), 0);
    setRange(dateStr(firstPrev), dateStr(lastPrev));
  });

  if (bedAllBtn) bedAllBtn.addEventListener('click', () => {
    bedsBox.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = true; });
    updateLinks();
  });
  if (bedClearBtn) bedClearBtn.addEventListener('click', () => {
    bedsBox.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    updateLinks();
  });
  if (opAllBtn) opAllBtn.addEventListener('click', () => {
    opsBox.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = true; });
    updateLinks();
  });
  if (opClearBtn) opClearBtn.addEventListener('click', () => {
    opsBox.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    updateLinks();
  });
}

document.addEventListener('DOMContentLoaded', initLogDownload);
