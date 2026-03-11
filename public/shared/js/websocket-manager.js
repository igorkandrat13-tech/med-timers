// ==================== МЕНЕДЖЕР WEBSOCKET ====================

export class WebSocketManager {
    constructor(role, bedId = null) {
        this.role = role;
        this.bedId = bedId;
        this.ws = null;
        this.bedsState = [];
        this.onMessageHandlers = new Set();
        this.onConnectHandlers = new Set();
        this.onDisconnectHandlers = new Set();
        this.reconnectAttempt = 0;
        this.reconnectTimer = null;
        this.lastDisconnectAt = 0;
    }

    connect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let url = `${protocol}//${window.location.host}?role=${this.role}`;
        if (this.bedId) url += `&bed=${this.bedId}`;

        // Если хост содержит med-timers.westa.by, но мы используем ws, форсируем wss
        // Это костыль для ситуации, когда браузер может быть в смешанном режиме,
        // но вообще, window.location.protocol должен отражать реальность
        if (window.location.host.includes('med-timers.westa.by') && protocol === 'ws:') {
             url = url.replace('ws:', 'wss:');
        }

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log(`✅ WebSocket подключен (${this.role})`);
            this.reconnectAttempt = 0;
            this.onConnectHandlers.forEach(handler => handler({ attempt: 0 }));
        };

        this.ws.onclose = () => {
            console.log('❌ WebSocket отключен. Переподключение...');
            this.lastDisconnectAt = Date.now();
            const attempt = this.reconnectAttempt;
            const base = 1000;
            const max = 30000;
            const delay = Math.min(max, base * Math.pow(2, attempt));
            const jitter = Math.floor(Math.random() * 250);
            const delayMs = delay + jitter;
            this.onDisconnectHandlers.forEach(handler => handler({ attempt, delayMs }));
            this.reconnectAttempt = Math.min(attempt + 1, 10);
            this.reconnectTimer = setTimeout(() => this.connect(), delayMs);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
                console.error('❌ Ошибка парсинга WebSocket:', e);
            }
        };

        this.ws.onerror = (error) => {
            console.error('❌ Ошибка WebSocket:', error);
        };
    }

    handleMessage(data) {
        if (data.type === 'state' || data.type === 'update_all' || data.type === 'time_update') {
            if (data.beds && Array.isArray(data.beds)) {
                this.bedsState = data.beds.map(bed => ({
                    status: bed.status || 'idle',
                    endTime: bed.endTime || null,
                    duration: bed.duration || 0,
                    procedureName: bed.procedureName || null,
                    remainingTime: bed.remainingTime || 0,
                    currentStageIndex: bed.currentStageIndex ?? null,
                    stages: Array.isArray(bed.stages) ? bed.stages : []
                }));
            } else if (this.bedId) {
                // Обработка состояния для конкретной койки
                this.bedsState[this.bedId - 1] = {
                    ...data,
                    stages: Array.isArray(data.stages) ? data.stages : []
                };
            }
        }
        
        this.onMessageHandlers.forEach(handler => handler(data));
    }

    addMessageHandler(handler) {
        this.onMessageHandlers.add(handler);
    }

    addConnectHandler(handler) {
        this.onConnectHandlers.add(handler);
    }

    addDisconnectHandler(handler) {
        this.onDisconnectHandlers.add(handler);
    }

    getBedsState() {
        return this.bedsState;
    }

    isConnected() {
        return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
    }

    async sendControl(bedId, action, params = {}) {
        const response = await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bed: bedId,
                action: action,
                ...params
            })
        });
        return await response.json();
    }
}
