// Логика проверки и установки обновлений

export function initUpdates() {
    const checkBtn = document.getElementById('check-updates-btn');
    const modal = document.getElementById('updates-modal');
    const closeBtn = document.getElementById('update-close-btn');
    const closeX = document.querySelector('.close-updates');
    const confirmBtn = document.getElementById('update-confirm-btn');
    const statusDiv = document.getElementById('updates-status');

    if (!checkBtn || !modal) return;

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
