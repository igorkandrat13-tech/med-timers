import { AlarmManager } from '../../shared/js/alarm-manager.js';

const alarmManager = new AlarmManager();

export function toggleSound(enabled) {
    const isEnabled = alarmManager.toggle(enabled);
    updateSoundIcon(isEnabled);
    return isEnabled;
}

function updateSoundIcon(isEnabled) {
    const btn = document.getElementById('sound-toggle-doctor');
    if (btn) {
        btn.textContent = isEnabled ? '🔊' : '🔇';
        btn.style.opacity = isEnabled ? '1' : '0.6';
        btn.title = isEnabled ? 'Выключить звук' : 'Включить звук';
    }
}

export function playAlarm() {
    alarmManager.play();
}

export function initAlarms() {
    alarmManager.init();
    updateSoundIcon(alarmManager.getEnabled());
    
    // Подключаем кнопку переключения звука
    const btn = document.getElementById('sound-toggle-doctor');
    if (btn) {
        btn.addEventListener('click', () => toggleSound());
    }
}

// Attach to window for legacy access if needed
if (typeof window !== 'undefined') {
    window.playAlarm = playAlarm;
    window.toggleSound = toggleSound;
    window.initAlarms = initAlarms;
}

// Авто-инициализация
initAlarms();
