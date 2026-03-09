// ==================== МЕНЕДЖЕР ЗВУКОВЫХ УВЕДОМЛЕНИЙ ====================

export class AlarmManager {
    constructor(soundPath = '/sounds/beep.mp3') {
        this.soundPath = soundPath;
        this.audio = null;
        this.isEnabled = localStorage.getItem('sound-enabled') !== 'false';
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;

        this.audio = new Audio(this.soundPath);
        this.audio.preload = 'auto';
        this.audio.volume = 1.0;

        // Разблокировка аудио при первом взаимодействии
        const unlock = () => {
            this.audio.play().then(() => {
                this.audio.pause();
                this.audio.currentTime = 0;
                this.isInitialized = true;
                console.log('✅ Аудиосистема разблокирована');
                document.removeEventListener('click', unlock);
                document.removeEventListener('touchstart', unlock);
            }).catch(() => {});
        };

        document.addEventListener('click', unlock, { once: true });
        document.addEventListener('touchstart', unlock, { once: true });
    }

    play() {
        if (!this.isEnabled) return;
        if (!this.audio) this.init();

        this.audio.currentTime = 0;
        this.audio.play().catch(e => {
            console.warn('Воспроизведение звука заблокировано или произошла ошибка:', e);
        });
    }

    toggle(enabled) {
        this.isEnabled = typeof enabled === 'boolean' ? enabled : !this.isEnabled;
        localStorage.setItem('sound-enabled', this.isEnabled);
        return this.isEnabled;
    }

    getEnabled() {
        return this.isEnabled;
    }
}
