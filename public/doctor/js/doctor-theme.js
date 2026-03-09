// doctor-theme.js
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('theme-toggle-doctor');
    const htmlElement = document.documentElement;
    
    // Проверяем сохраненную тему (можно использовать ключ 'doctor-theme' для независимости настроек)
    const savedTheme = localStorage.getItem('doctor-theme') || 'light';
    setTheme(savedTheme);

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            setTheme(newTheme);
            localStorage.setItem('doctor-theme', newTheme);
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