/**
 * Управление вкладками для админ-панели
 */

const AdminTabs = {
    /**
     * Инициализация
     */
    init() {
        this.setupTabListeners();
    },

    /**
     * Настройка обработчиков событий вкладок
     */
    setupTabListeners() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                this.switchTab(targetTab);
            });
        });
    },

    /**
     * Переключение вкладки
     */
    switchTab(tabId) {
        // Убираем активный класс у всех кнопок
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Убираем активный класс у всех контентов
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Добавляем активный класс нужной кнопке
        const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Добавляем активный класс нужному контенту
        const activeContent = document.getElementById(tabId);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        // Если переключились на вкладку процедур - обновляем данные
        if (tabId === 'procedures-tab') {
            AdminProcedures.loadProcedures();
        }
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    AdminTabs.init();
});