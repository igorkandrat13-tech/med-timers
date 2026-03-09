// admin-theme.js
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('theme-toggle-admin');
    const htmlElement = document.documentElement; // Или document.body, если предпочитаете
    
    // Проверяем сохраненную тему
    const savedTheme = localStorage.getItem('admin-theme') || 'light';
    setTheme(savedTheme);

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            setTheme(newTheme);
            localStorage.setItem('admin-theme', newTheme);
        });
    }

    function setTheme(theme) {
        if (theme === 'dark') {
            htmlElement.setAttribute('data-theme', 'dark');
            if (toggleBtn) toggleBtn.textContent = '☀️';
        } else {
            htmlElement.removeAttribute('data-theme');
            if (toggleBtn) toggleBtn.textContent = '🌙';
        }
    }
});