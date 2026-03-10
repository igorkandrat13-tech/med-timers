// Логика проверки и установки обновлений

export function initUpdates() {
    const checkBtn = document.getElementById('check-updates-btn');
    const modal = document.getElementById('updates-modal');
    const closeBtn = document.getElementById('update-close-btn');
    const closeX = document.querySelector('.close-updates');
    const confirmBtn = document.getElementById('update-confirm-btn');
    const statusDiv = document.getElementById('updates-status');
    const versionEl = document.getElementById('build-version');

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
                const contentType = res.headers.get('content-type') || '';
                const rawText = await res.text();
                let data = null;
                if (contentType.includes('application/json')) {
                    try {
                        data = JSON.parse(rawText);
                    } catch (_) {}
                }
                
                if (res.ok && (data?.success || res.status === 200)) {
                    statusDiv.innerHTML = `
                        <div style="color: var(--success-color); text-align: center;">
                            <h3>✅ Готово!</h3>
                            <p>${(data && data.message) ? data.message : 'Обновлено успешно'}</p>
                            <p>Сервер перезагружается...</p>
                        </div>
                    `;
                    // Ждем перезагрузки сервера
                    setTimeout(() => {
                        window.location.reload();
                    }, 5000);
                } else {
                    const serverDetails = (data && (data.error || data.details))
                        ? `${data.error || 'Ошибка'}${data.details ? ' — ' + data.details : ''}`
                        : rawText;
                    const trimmed = String(serverDetails || '').trim();
                    const clipped = trimmed.length > 500 ? trimmed.slice(0, 500) + '…' : trimmed;
                    const errText = clipped ? `${clipped}` : `HTTP ${res.status}`;
                    throw new Error(errText);
                }
            } catch (err) {
                console.error(err);
                statusDiv.innerHTML = `
                    <div style="color: var(--danger-color); text-align: center;">
                        <h3>❌ Ошибка</h3>
                        <p>${err.message || 'Update failed'}</p>
                    </div>
                `;
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Попробовать снова';
            }
        });
    }

    async function checkUpdates() {
        try {
            const res = await fetch('/api/updates/check');
            
            // Если сервер вернул не JSON (например, HTML с ошибкой Nginx 404/502), обрабатываем это
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Сервер вернул некорректный ответ: ${res.status} ${res.statusText}`);
            }

            const data = await res.json();
            
            if (data.available) {
                statusDiv.innerHTML = `
                    <div style="color: var(--primary-color); text-align: center;">
                        <h3>🎉 Доступны обновления!</h3>
                        <p>Новых изменений: <strong>${data.count}</strong></p>
                    </div>
                `;
                confirmBtn.style.display = 'inline-block';
                confirmBtn.disabled = false;
                confirmBtn.textContent = '⬇️ Скачать и обновить';
            } else if (data.error) {
                statusDiv.innerHTML = `
                    <div style="color: var(--warning-color); text-align: center;">
                        <h3>⚠️ Ошибка проверки</h3>
                        <p>${data.error}</p>
                        <small>Убедитесь, что сервер запущен из Git-папки</small>
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
