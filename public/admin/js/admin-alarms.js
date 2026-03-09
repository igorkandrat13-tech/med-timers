import { AlarmManager } from '../../shared/js/alarm-manager.js';

const alarmManager = new AlarmManager();

export function playAlarm() {
  alarmManager.play();
}

export function initAlarms() {
  alarmManager.init();
}

// Attach to window for legacy access if needed
if (typeof window !== 'undefined') {
  window.playAlarm = playAlarm;
  window.initAlarms = initAlarms;
}
