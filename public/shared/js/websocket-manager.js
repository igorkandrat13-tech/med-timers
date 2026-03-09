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
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let url = `${protocol}//${window.location.host}?role=${this.role}`;
        if (this.bedId) url += `&bed=${this.bedId}`;

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log(`✅ WebSocket подключен (${this.role})`);
            this.onConnectHandlers.forEach(handler => handler());
        };

        this.ws.onclose = () => {
            console.log('❌ WebSocket отключен. Переподключение...');
            this.onDisconnectHandlers.forEach(handler => handler());
            setTimeout(() => this.connect(), 3000);
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
