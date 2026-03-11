"use strict";

async function getServerCandidates() {
  try {
    const res = await fetch('/api/server-info');
    return await res.json();
  } catch (_) {
    return null;
  }
}

function pickBaseUrl(serverInfo) {
  const loc = window.location;
  const portPart = loc.port ? `:${loc.port}` : '';

  // Если мы на домене (med-timers.westa.by), то используем его
  // Проверяем: не localhost и не IP-адрес
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(loc.hostname);
  if (!isIp && loc.hostname !== 'localhost') {
    return `${loc.protocol}//${loc.hostname}${portPart}`;
  }

  // Если открыто по IP или localhost, но есть внешний домен - используем его
  // Можно сделать это настраиваемым, но пока жестко пропишем med-timers.westa.by
  // Протокол определяем по текущему (если админ зашел по HTTP, скорее всего и домен по HTTP)
  // Но если настроен HTTPS, лучше сразу давать HTTPS. 
  // Предположим, что домен всегда работает
  return `${loc.protocol}//med-timers.westa.by${portPart}`; 

  /*
  const defaultBase = `${loc.protocol}//${loc.hostname}${portPart}`;
  if (!serverInfo || !Array.isArray(serverInfo.ips) || serverInfo.ips.length === 0) {
    return defaultBase;
  }
  // Выбираем первый внешний IPv4
  const ip = serverInfo.ips.find(ip => !ip.internal && ip.family === 'IPv4') 
          || serverInfo.ips.find(ip => ip.family === 'IPv4') 
          || serverInfo.ips[0];
  const host = ip && ip.address ? ip.address : loc.hostname;
  return `${loc.protocol}//${host}${portPart}`;
  */
}

function makeQR(url) {
  const container = document.getElementById('qr-container');
  if (!container) return;
  container.innerHTML = '';
  const Lib = (typeof window !== 'undefined') ? window.QRCode : null;
  if (!Lib) {
    console.error('QRCode library is not available');
    const input = document.getElementById('qr-url-input');
    if (input) input.value = url;
    const msg = document.createElement('div');
    msg.textContent = 'Не удалось загрузить библиотеку QR. Проверьте подключение qrcode.min.js';
    msg.style.color = 'var(--text-muted)';
    container.appendChild(msg);
    return;
  }
  const qr = new Lib(container, {
    text: url,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: Lib.CorrectLevel.M
  });
  // Обновим поле URL
  const input = document.getElementById('qr-url-input');
  if (input) {
    input.value = url;
  }
}

async function openQRModal(target) {
  const modal = document.getElementById('qr-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  const serverInfo = await getServerCandidates();
  const base = pickBaseUrl(serverInfo);
  const url = `${base}/`;
  makeQR(url);
}

function initQRUI() {
  const showBtn = document.getElementById('show-qr-btn');
  const modal = document.getElementById('qr-modal');
  const closeX = document.getElementById('qr-close-x');

  if (showBtn && !showBtn._qrBound) {
    showBtn._qrBound = true;
    showBtn.addEventListener('click', () => openQRModal('root'));
  }
  if (modal && !modal._qrBound) {
    modal._qrBound = true;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }
  if (closeX && !closeX._qrBound) {
    closeX._qrBound = true;
    closeX.addEventListener('click', () => {
      const m = document.getElementById('qr-modal');
      if (m) m.style.display = 'none';
    });
  }
}

// Инициализация: сразу, если DOM уже готов; иначе — по событию
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initQRUI();
} else {
  document.addEventListener('DOMContentLoaded', initQRUI);
}
