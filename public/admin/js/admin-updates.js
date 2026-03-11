// Логика проверки и установки обновлений

export function initUpdates() {
    const checkBtn = document.getElementById('check-updates-btn');
    const modal = document.getElementById('updates-modal');
    const closeBtn = document.getElementById('update-close-btn');
    const closeX = document.getElementById('updates-close-x');
    const confirmBtn = document.getElementById('update-confirm-btn');
    const statusDiv = document.getElementById('updates-status');
    const versionEl = document.getElementById('build-version');
    const rollbackBtn = document.getElementById('rollback-btn');
    const cleanupBtn = document.getElementById('cleanup-btn');
    const keepInput = document.getElementById('keep-releases');

    if (!checkBtn || !modal) return;

    // Отобразить текущую версию сборки
    if (versionEl) {
        fetch('/api/version')
          .then(r => r.json())
          .then(d => {
            if (d && d.version) versionEl.textContent = `v ${d.version}`;
          })
          .catch(() => {});
    }

    // Открытие модалки и проверка
    checkBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        confirmBtn.style.display = 'none';
        statusDiv.innerHTML = '<div style="text-align: center; padding: 20px;"><h3>⏳ Проверка...</h3></div>';
        checkUpdates();
    });

    // Закрытие модалки
    const closeModal = () => {
        modal.style.display = 'none';
        confirmBtn.style.display = 'none';
    };
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeX) closeX.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Кнопка обновления
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Обновление...';
            statusDiv.innerHTML = '<div style="text-align: center; padding: 20px;"><h3>🔄 Загрузка обновлений...</h3></div>';
            
            try {
                const res = await fetch('/api/updates/pull', { method: 'POST' });
                const data = await res.json();
                
                if (data.success || res.ok) {
                    statusDiv.innerHTML = `
                        <div style="color: var(--success-color); text-align: center;">
                            <h3>✅ Готово!</h3>
                            <p>${data.message || 'Обновлено успешно'}</p>
                            <p>Сервер перезагружается...</p>
                        </div>
                    `;
                    // Ждем перезагрузки сервера
                    setTimeout(() => {
                        window.location.reload();
                    }, 5000);
                } else {
                    throw new Error(data.error || 'Unknown error');
                }
            } catch (err) {
                console.error(err);
                statusDiv.innerHTML = `
                    <div style="color: var(--danger-color); text-align: center;">
                        <h3>❌ Ошибка</h3>
                        <p>${err.message}</p>
                    </div>
                `;
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Попробовать снова';
            }
        });
    }

    // Кнопка отката
    if (rollbackBtn) {
        rollbackBtn.addEventListener('click', async () => {
            rollbackBtn.disabled = true;
            statusDiv.innerHTML = '<div style="text-align:center; padding: 12px;"><h3>↩️ Откат на предыдущую версию...</h3></div>';
            try {
                const res = await fetch('/api/updates/rollback', { method: 'POST' });
                const text = await res.text();
                let data = null;
                try { data = JSON.parse(text); } catch(_) {}
                if (res.ok && (data?.success || res.status === 200)) {
                    statusDiv.innerHTML = `
                      <div style="color: var(--success-color); text-align:center;">
                        <h3>✅ Откат выполнен</h3>
                        <p>${(data && data.message) ? data.message : 'Сервер перезагружается...'}</p>
                      </div>`;
                    setTimeout(() => window.location.reload(), 5000);
                } else {
                    const details = (data && (data.error || data.details)) ? `${data.error} — ${data.details || ''}` : text;
                    throw new Error(details || `HTTP ${res.status}`);
                }
            } catch (e) {
                statusDiv.innerHTML = `
                  <div style="color: var(--danger-color); text-align:center;">
                    <h3>❌ Ошибка отката</h3>
                    <p>${(e && e.message) ? e.message : 'Rollback failed'}</p>
                  </div>`;
            } finally {
                rollbackBtn.disabled = false;
            }
        });
    }

    // Кнопка очистки
    if (cleanupBtn) {
        cleanupBtn.addEventListener('click', async () => {
            const keep = Math.max(1, parseInt(keepInput?.value || '5', 10) || 5);
            cleanupBtn.disabled = true;
            statusDiv.innerHTML = '<div style="text-align:center; padding: 12px;"><h3>🧹 Очистка старых релизов...</h3></div>';
            try {
                const res = await fetch(`/api/updates/cleanup?keep=${keep}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                const text = await res.text();
                let data = null;
                try { data = JSON.parse(text); } catch(_) {}
                if (res.ok && (data?.success || res.status === 200)) {
                    const removed = (data && data.removed) ? data.removed.join(', ') : '';
                    statusDiv.innerHTML = `
                      <div style="color: var(--success-color); text-align:center;">
                        <h3>✅ Очистка завершена</h3>
                        <p>${removed ? ('Удалено: ' + removed) : (data?.message || 'Готово')}</p>
                      </div>`;
                } else {
                    const details = (data && (data.error || data.details)) ? `${data.error} — ${data.details || ''}` : text;
                    throw new Error(details || `HTTP ${res.status}`);
                }
            } catch (e) {
                statusDiv.innerHTML = `
                  <div style="color: var(--danger-color); text-align:center;">
                    <h3>❌ Ошибка очистки</h3>
                    <p>${(e && e.message) ? e.message : 'Cleanup failed'}</p>
                  </div>`;
            } finally {
                cleanupBtn.disabled = false;
            }
        });
    }
    async function checkUpdates() {
        try {
            const res = await fetch('/api/updates/check');
            const contentType = res.headers.get('content-type') || '';
            const rawText = await res.text();
            let data = null;
            if (contentType.includes('application/json')) {
                try {
                    data = JSON.parse(rawText);
                } catch (_) {}
            }
            
            if (res.ok && data && data.available) {
                statusDiv.innerHTML = `
                    <div style="color: var(--primary-color); text-align: center;">
                        <h3>🎉 Доступны обновления!</h3>
                        <p>Новых изменений: <strong>${data.count}</strong></p>
                    </div>
                `;
                confirmBtn.style.display = 'inline-block';
                confirmBtn.disabled = false;
                confirmBtn.textContent = '⬇️ Скачать и обновить';
            } else if (data && data.error) {
                statusDiv.innerHTML = `
                    <div style="color: var(--warning-color); text-align: center;">
                        <h3>⚠️ Ошибка проверки</h3>
                        <p>${data.error}</p>
                        <small>Убедитесь, что сервер запущен из Git-папки</small>
                    </div>
                `;
            } else if (!res.ok) {
                const trimmed = String(rawText || `HTTP ${res.status} ${res.statusText}`).trim();
                const clipped = trimmed.length > 500 ? trimmed.slice(0, 500) + '…' : trimmed;
                statusDiv.innerHTML = `
                    <div style="color: var(--warning-color); text-align: center;">
                        <h3>⚠️ Ошибка проверки</h3>
                        <p>${clipped}</p>
                    </div>
                `;
            } else {
                statusDiv.innerHTML = `
                    <div style="color: var(--text-muted); text-align: center;">
                        <h3>✅ У вас последняя версия</h3>
                        <p>Обновлений нет.</p>
                    </div>
                `;
            }
        } catch (err) {
            console.error(err);
            statusDiv.innerHTML = `
                <div style="color: var(--danger-color); text-align: center;">
                    <h3>❌ Ошибка сети</h3>
                    <p>Не удалось связаться с сервером.</p>
                </div>
            `;
        }
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initUpdates);
