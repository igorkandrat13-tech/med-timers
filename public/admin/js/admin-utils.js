import * as sharedUtils from '../../shared/js/utils.js';

export const formatTime = sharedUtils.formatTime;
export const getStatusText = sharedUtils.getStatusText;
export const getStatusClass = sharedUtils.getStatusClass;
export const apiRequest = sharedUtils.apiRequest;
export const showNotification = sharedUtils.showNotification;
export const getProgress = sharedUtils.getProgress;
export const getProgressBarHTML = sharedUtils.getProgressBarHTML;

// Attach to window for legacy scripts that might expect global access
if (typeof window !== 'undefined') {
    window.formatTime = formatTime;
    window.getStatusText = getStatusText;
    window.getStatusClass = getStatusClass;
    window.apiRequest = apiRequest;
    window.showNotification = showNotification;
    window.getProgress = getProgress;
    window.getProgressBarHTML = getProgressBarHTML;
}
