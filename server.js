const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const MAX_BEDS = 14; // Настройка количества коек

// CORS для локального тестирования
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Парсинг JSON
app.use(express.json());

// Проверка доступа к HTML страницам админа и врача
app.use((req, res, next) => {
    if (req.method === 'GET' && typeof req.path === 'string' && req.path.endsWith('.html')) {
        if (req.path.startsWith('/admin')) {
            const cookies = parseCookies(req);
            const payload = verifyToken(cookies.mtoken);
            if (!payload || payload.role !== 'admin') {
                return res.redirect('/auth/login.html?role=admin');
            }
        } else if (req.path.startsWith('/doctor')) {
            const cookies = parseCookies(req);
            const payload = verifyToken(cookies.mtoken);
            if (!payload || payload.role !== 'doctor') {
                return res.redirect('/auth/login.html?role=doctor');
            }
        }
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

const AUTH_SECRET = process.env.AUTH_SECRET || 'change-this-secret';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const DOCTOR_USER = process.env.DOCTOR_USER || 'doctor';
const DOCTOR_PASSWORD = process.env.DOCTOR_PASSWORD || 'doctor123';

function base64url(input) {
    return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signToken(payload) {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64url(JSON.stringify(payload));
    const hmac = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${header}.${body}.${hmac}`;
}

function verifyToken(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    if (sig !== expected) return null;
    try {
        const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

function parseCookies(req) {
    const header = req.headers.cookie || '';
    const out = {};
    header.split(';').forEach(p => {
        const idx = p.indexOf('=');
        if (idx > -1) {
            const k = p.slice(0, idx).trim();
            const v = p.slice(idx + 1).trim();
            out[k] = decodeURIComponent(v);
        }
    });
    return out;
}

app.post('/api/auth/login', (req, res) => {
    const { username, password, role } = req.body || {};
    let ok = false;
    if (role === 'admin' && username === ADMIN_USER && password === ADMIN_PASSWORD) ok = true;
    if (role === 'doctor' && username === DOCTOR_USER && password === DOCTOR_PASSWORD) ok = true;
    if (!ok) return res.status(401).json({ error: 'Неверные учетные данные' });
    const exp = Date.now() + 1000 * 60 * 60 * 12;
    const token = signToken({ role, sub: username, exp });
    res.setHeader('Set-Cookie', `mtoken=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`);
    res.json({ success: true, role });
});

app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'mtoken=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
    const cookies = parseCookies(req);
    const payload = verifyToken(cookies.mtoken);
    if (!payload) return res.json({ role: null });
    res.json({ role: payload.role });
});

function ensureRole(role) {
    return (req, res, next) => {
        const cookies = parseCookies(req);
        const payload = verifyToken(cookies.mtoken);
        if (!payload || payload.role !== role) {
            const target = role === 'admin' ? '/auth/login.html?role=admin' : '/auth/login.html?role=doctor';
            return res.redirect(target);
        }
        next();
    };
}

app.get('/admin/admin.html', ensureRole('admin'), (req, res, next) => next());
app.get('/doctor/doctor.html', ensureRole('doctor'), (req, res, next) => next());

app.get(['/doctor', '/tablet'], (req, res) => {
    res.redirect('/doctor/doctor.html');
});

app.get('/admin', (req, res) => {
    res.redirect('/admin/admin.html');
});

app.get('/', (req, res) => {
    res.redirect('/doctor/doctor.html');
});

// Служебная информация о сервере (для QR)
app.get('/api/server-info', (req, res) => {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            ips.push({
                interface: name,
                address: net.address,
                family: net.family,
                internal: net.internal
            });
        }
    }
    res.json({
        protocol: req.protocol,
        host: req.headers.host,
        ips
    });
});

// Версия сборки из git
app.get('/api/version', (req, res) => {
    exec('git rev-parse --short HEAD', (err, stdout) => {
        if (err) {
            return res.json({ version: null });
        }
        res.json({ version: stdout.trim() });
    });
});

// ==================== GIT ОБНОВЛЕНИЯ ====================

// Проверка обновлений (fetch и статус)
app.get('/api/updates/check', (req, res) => {
    exec('git fetch', (err) => {
        if (err) {
            console.error('Git fetch error:', err);
            return res.json({ available: false, error: 'Git fetch failed' });
        }
        
        // Проверяем, сколько коммитов позади
        exec('git rev-list HEAD...origin/main --count', (err, stdout) => {
            if (err) {
                // Если origin/main нет, пробуем origin/master
                 exec('git rev-list HEAD...origin/master --count', (err2, stdout2) => {
                     if (err2) {
                         console.error('Git rev-list error:', err2);
                         return res.json({ available: false, error: 'Git check failed' });
                     }
                     const count = parseInt(stdout2.trim());
                     res.json({ available: count > 0, count });
                 });
                 return;
            }
            const count = parseInt(stdout.trim());
            res.json({ available: count > 0, count });
        });
    });
});

// Установка обновлений (pull)
app.post('/api/updates/pull', (req, res) => {
    exec('git pull', (err, stdout, stderr) => {
        if (err) {
            console.error('Git pull error:', err);
            return res.status(500).json({ error: 'Update failed', details: stderr });
        }
        console.log('Update successful:', stdout);
        
        // Перезапуск сервера (для systemd: exit 1 вызовет рестарт, если Restart=on-failure)
        // Но дадим клиенту ответ перед выходом
        res.json({ success: true, message: 'Updated successfully. Restarting server...' });
        
        setTimeout(() => {
            console.log('Restarting process...');
            process.exit(1); 
        }, 1000);
    });
});

// Список последних коммитов (для информации/диагностики)
app.get('/api/updates/commits', (req, res) => {
    exec('git log -n 10 --pretty=format:%h|%ct|%s', (err, stdout, stderr) => {
        if (err) {
            console.error('Git log error:', err);
            return res.status(500).json({ error: 'List commits failed', details: stderr });
        }
        const commits = String(stdout).split('\n').filter(Boolean).map(line => {
            const [hash, ts, ...rest] = line.split('|');
            return { hash, time: Number(ts) || null, subject: rest.join('|') || '' };
        });
        res.json({ commits });
    });
});

// Откат на предыдущий коммит (legacy layout)
app.post('/api/updates/rollback', (req, res) => {
    exec('git rev-parse --short HEAD~1', (e1, prevHash) => {
        if (e1) {
            console.error('Git rev-parse error:', e1);
            return res.status(400).json({ error: 'Rollback failed', details: 'Previous commit not found' });
        }
        exec('git reset --hard HEAD~1', (e2, out2, err2) => {
            if (e2) {
                console.error('Git reset error:', e2);
                return res.status(500).json({ error: 'Rollback failed', details: err2 });
            }
            const msg = `Rolled back to ${String(prevHash).trim()}. Restarting server...`;
            res.json({ success: true, message: msg });
            setTimeout(() => process.exit(1), 1000);
        });
    });
});

// Очистка "старых релизов" (в legacy-режиме не используется)
app.post('/api/updates/cleanup', (req, res) => {
    // Для working-copy из git нет каталогов releases; делаем лёгкую очистку объектов
    exec('git gc --prune=now', (err, stdout, stderr) => {
        if (err) {
            console.error('Git gc error:', err);
            return res.status(500).json({ error: 'Cleanup failed', details: stderr });
        }
        res.json({ success: true, message: 'Cleanup completed (git gc)' });
    });
});

// ==================== ХРАНЕНИЕ ДАННЫХ ====================

// Журнал таймеров
const logFile = path.join(__dirname, 'timers_log.csv');

// Инициализация журнала
if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, 'Дата,Время,Койка,Событие,Длительность,Оператор,Процедура\n');
}

// Вспомогательная функция логирования
function logEvent(bedId, event, duration, operator, procedureName) {
    const timestamp = new Date().toLocaleString('ru-RU');
    const [date, time] = timestamp.split(', ');
    fs.appendFileSync(logFile, `${date},${time},${bedId},${event},${duration},${operator},${procedureName || '-'}\n`);
}

// Справочник процедур
const proceduresFile = path.join(__dirname, 'procedures.json');
let procedures = [
    { id: 1, name: 'Электрофорез', duration: 15, active: true },
    { id: 2, name: 'Магнитотерапия', duration: 20, active: true },
    { id: 3, name: 'УВЧ-терапия', duration: 10, active: true },
    { id: 4, name: 'Лазеротерапия', duration: 12, active: true },
    { id: 5, name: 'Дарсонвализация', duration: 8, active: true }
];

if (fs.existsSync(proceduresFile)) {
    try {
        procedures = JSON.parse(fs.readFileSync(proceduresFile, 'utf8'));
        console.log('✅ Справочник процедур загружен из файла');
    } catch (e) {
        console.error('⚠️ Ошибка загрузки процедур, используется стандартный справочник');
    }
} else {
    fs.writeFileSync(proceduresFile, JSON.stringify(procedures, null, 2));
    console.log('✅ Создан стандартный справочник процедур');
}

function saveProceduresToFile() {
    try {
        fs.writeFileSync(proceduresFile, JSON.stringify(procedures, null, 2));
        console.log('💾 Справочник процедур сохранён');
    } catch (e) {
        console.error('❌ Ошибка сохранения процедур:', e.message);
    }
}

// Хранилище состояний таймеров (MAX_BEDS коек, индекс 1-MAX_BEDS)
const beds = Array(MAX_BEDS + 1).fill(null).map(() => ({
    status: 'idle',
    endTime: null,
    duration: 0,
    startedAt: null,
    procedureName: null,
    remainingTime: 0,
    currentStageIndex: null,
    stages: []
}));

// ==================== API ДЛЯ УПРАВЛЕНИЯ КОЙКАМИ ====================

app.post('/api/control', (req, res) => {
    const { bed, action, minutes, operator = 'system', procedureName = null } = req.body;
    const bedId = parseInt(bed);
    
    if (bedId < 1 || bedId > MAX_BEDS) {
        return res.status(400).json({ error: 'Неверный номер койки' });
    }

    const bedData = beds[bedId];
    if (!bedData) {
        return res.status(400).json({ error: 'Койка не найдена' });
    }

    try {
        switch (action) {
            case 'start':
                if (bedData.status !== 'idle') {
                    return res.status(400).json({ error: 'Койка занята' });
                }

                const proc = procedures.find(p => p.name === procedureName);
                let duration = minutes;
                let currentStageIndex = 0;
                let stages = [];

                if (proc && Array.isArray(proc.stages) && proc.stages.length > 0) {
                    duration = proc.stages[0]?.duration || minutes;
                    currentStageIndex = 0;
                    stages = proc.stages;
                }

                const endTime = Date.now() + (duration * 60 * 1000);

                beds[bedId] = {
                    status: 'running',
                    endTime: endTime,
                    duration: duration,
                    startedAt: Date.now(),
                    procedureName: procedureName,
                    remainingTime: 0,
                    currentStageIndex: currentStageIndex,
                    stages: stages
                };

                logEvent(bedId, 'Старт', duration, operator, procedureName);
                break;

            case 'pause':
                if (bedData.status !== 'running') {
                    return res.status(400).json({ error: 'Таймер не запущен' });
                }
                beds[bedId] = {
                    ...bedData,
                    status: 'paused',
                    remainingTime: bedData.endTime - Date.now()
                };
                logEvent(bedId, 'Пауза', Math.round(bedData.remainingTime / 60000), operator, bedData.procedureName);
                break;

            case 'resume':
              if (bedData.status !== 'paused') {
                  return res.status(400).json({ error: 'Таймер не на паузе' });
              }

              if (bedData.remainingTime > 0) {
                  beds[bedId] = {
                      ...bedData,
                      status: 'running',
                      endTime: Date.now() + bedData.remainingTime,
                      remainingTime: 0
                  };
                  logEvent(bedId, 'Продолжить', Math.round(bedData.remainingTime / 60000), operator, bedData.procedureName);
              } else {
                  return res.status(400).json({ error: 'Невозможно продолжить: этап завершён. Используйте «Следующий этап».' });
              }
              break;

            case 'stop':
                if (bedData.status !== 'running' && bedData.status !== 'paused') {
                    return res.status(400).json({ error: 'Таймер не запущен' });
                }
                const stopDuration = bedData.duration;
                const stopProc = bedData.procedureName;
                
                beds[bedId] = {
                    status: 'idle',
                    endTime: null,
                    duration: 0,
                    startedAt: null,
                    procedureName: null,
                    remainingTime: 0,
                    currentStageIndex: null,
                    stages: []
                };
                logEvent(bedId, 'Стоп', stopDuration, operator, stopProc);
                break;

            case 'reset':
                const resetDuration = bedData.duration;
                const resetProc = bedData.procedureName;
                
                beds[bedId] = {
                    status: 'idle',
                    endTime: null,
                    duration: 0,
                    startedAt: null,
                    procedureName: null,
                    remainingTime: 0,
                    currentStageIndex: null,
                    stages: []
                };
                logEvent(bedId, 'Сброс', resetDuration, operator, resetProc);
                break;

            case 'next_stage':
                if (bedData.status !== 'paused') {
                    return res.status(400).json({ error: 'Только на паузе можно перейти к следующему этапу' });
                }

                const proc2 = procedures.find(p => p.name === bedData.procedureName);
                if (!proc2 || !Array.isArray(proc2.stages) || proc2.stages.length === 0) {
                    return res.status(400).json({ error: 'Процедура не имеет этапов' });
                }

                const nextIndex = (bedData.currentStageIndex || 0) + 1;
                if (nextIndex >= proc2.stages.length) {
                    return res.status(400).json({ error: 'Это последний этап' });
                }

                const nextStage = proc2.stages[nextIndex];
                const nextDuration = nextStage.duration || 5;
                const nextEndTime = Date.now() + (nextDuration * 60 * 1000);

                beds[bedId] = {
                    ...bedData,
                    status: 'running',
                    endTime: nextEndTime,
                    duration: nextDuration,
                    currentStageIndex: nextIndex,
                    remainingTime: 0
                };

                logEvent(bedId, 'Следующий этап', nextDuration, operator, procedureName);
                break;

            default:
                return res.status(400).json({ error: 'Неизвестное действие' });
        }

        broadcastUpdate();
        res.json({ success: true, state: beds[bedId] });
    } catch (e) {
        console.error('Error in /api/control:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/state', (req, res) => {
    res.json({ beds: beds.slice(1, MAX_BEDS + 1) });
});

// ==================== API ДЛЯ СПРАВОЧНИКА ПРОЦЕДУР ====================

app.get('/api/procedures', (req, res) => {
    res.json(procedures);
});

app.get('/api/procedures/active', (req, res) => {
    const activeProcs = procedures.filter(p => p.active);
    res.json(activeProcs);
});

function broadcastProcedures() {
    const payload = JSON.stringify({ type: 'procedures_updated', procedures });
    broadcastToRole(['admin', 'doctor'], payload);
}

app.post('/api/procedures', (req, res) => {
    const { name, duration, stages } = req.body;
    if (!name || !duration) {
        return res.status(400).json({ error: 'Название и длительность обязательны' });
    }

    const maxId = procedures.length > 0 ? Math.max(...procedures.map(p => p.id)) : 0;
    const newProcedure = {
        id: maxId + 1,
        name: name.trim(),
        duration: parseFloat(duration) || 0,
        active: true,
        createdAt: new Date().toISOString()
    };

    if (Array.isArray(stages) && stages.length > 0) {
        newProcedure.stages = stages;
    }

    procedures.push(newProcedure);
    saveProceduresToFile();
    res.json({ success: true, procedure: newProcedure });
    broadcastProcedures();
});

app.put('/api/procedures/:id', (req, res) => {
    const procedureId = parseInt(req.params.id);
    const { name, duration, active, stages } = req.body;
    const index = procedures.findIndex(p => p.id === procedureId);
    if (index === -1) {
        return res.status(404).json({ error: 'Процедура не найдена' });
    }

    if (name !== undefined) procedures[index].name = name.trim();
    if (duration !== undefined) procedures[index].duration = parseFloat(duration) || 0;
    if (active !== undefined) procedures[index].active = active;

    if (stages !== undefined) {
        if (Array.isArray(stages) && stages.length > 0) {
            procedures[index].stages = stages;
        } else {
            delete procedures[index].stages;
        }
    }

    saveProceduresToFile();
    res.json({ success: true, procedure: procedures[index] });
    broadcastProcedures();
});

app.delete('/api/procedures/:id', (req, res) => {
    const procedureId = parseInt(req.params.id);
    const proc = procedures.find(p => p.id === procedureId);
    if (!proc) {
        return res.status(404).json({ error: 'Процедура не найдена' });
    }
    proc.active = false;
    saveProceduresToFile();
    res.json({ success: true });
    broadcastProcedures();
});

// Скачать журнал
app.get('/timers_log.csv', (req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=timers_log.csv');
    res.sendFile(logFile);
});

// ==================== WEBSOCKET СЕРВЕР ====================

const wss = new WebSocket.Server({ noServer: true });
const clients = new Map(); // ws -> { bedId, role }

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const bedId = parseInt(url.searchParams.get('bed'));
    const role = url.searchParams.get('role');
    const cookies = parseCookies(req);
    const payload = verifyToken(cookies.mtoken);
    if (!payload || (role && payload.role !== role)) {
        ws.close(4001, 'unauthorized');
        return;
    }

    clients.set(ws, { bedId, role });

    // Отправляем начальное состояние
    if (role === 'admin' || role === 'doctor') {
        ws.send(JSON.stringify({
            type: 'state',
            beds: beds.slice(1, MAX_BEDS + 1)
        }));
        ws.send(JSON.stringify({
            type: 'procedures_updated',
            procedures: procedures
        }));
    } else if (bedId >= 1 && bedId <= MAX_BEDS) {
        ws.send(JSON.stringify({
            type: 'state',
            ...beds[bedId]
        }));
    }

    ws.on('close', () => clients.delete(ws));
    ws.on('error', console.error);
});

// ==================== ОБНОВЛЕНИЕ ТАЙМЕРОВ ====================

function broadcastToRole(roles, payload) {
    clients.forEach((info, ws) => {
        if (ws.readyState === WebSocket.OPEN && roles.includes(info.role)) {
            ws.send(payload);
        }
    });
}

function broadcastToBed(bedId, payload) {
    clients.forEach((info, ws) => {
        if (ws.readyState === WebSocket.OPEN && info.bedId === bedId) {
            ws.send(payload);
        }
    });
}

function broadcastUpdate() {
    const payload = JSON.stringify({
        type: 'update_all',
        beds: beds.slice(1, MAX_BEDS + 1)
    });
    
    clients.forEach((info, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        }
    });
}

// Отправка обновления каждую секунду
setInterval(() => {
    const now = Date.now();
    const currentBeds = beds.slice(1, MAX_BEDS + 1);

    // Тик таймера для админов и врачей
    const timePayload = JSON.stringify({
        type: 'time_update',
        serverTime: now,
        beds: currentBeds
    });
    broadcastToRole(['admin', 'doctor'], timePayload);

    // Обновляем состояние сервера и проверяем завершение
    for (let i = 1; i <= MAX_BEDS; i++) {
        const bed = beds[i];
        if (!bed || bed.status !== 'running' || !bed.endTime) continue;

        const diff = bed.endTime - now;

        if (diff <= 0) {
            const proc = procedures.find(p => p.name === bed.procedureName);
            const isMultiStage = proc && Array.isArray(proc.stages) && proc.stages.length > 0;

            if (isMultiStage) {
                const nextIndex = (bed.currentStageIndex || 0) + 1;
                const totalStages = proc.stages.length;

                if (nextIndex < totalStages) {
                    bed.status = 'paused';
                    bed.remainingTime = 0;

                    const stagePayload = JSON.stringify({
                        type: 'stage_completed',
                        bedId: i,
                        currentStageIndex: bed.currentStageIndex,
                        totalStages: totalStages
                    });

                    broadcastToBed(i, stagePayload);
                    broadcastToRole(['admin', 'doctor'], stagePayload);
                    logEvent(i, 'Этап завершён', bed.duration, 'system', bed.procedureName);
                } else {
                    bed.status = 'completed';
                    const completedPayload = JSON.stringify({ type: 'completed', bedId: i });
                    broadcastToBed(i, completedPayload);
                    broadcastToRole(['admin', 'doctor'], completedPayload);
                    logEvent(i, 'Завершено', bed.duration, 'system', bed.procedureName);
                }
            } else {
                bed.status = 'completed';
                const completedPayload = JSON.stringify({ type: 'completed', bedId: i });
                broadcastToBed(i, completedPayload);
                broadcastToRole(['admin', 'doctor'], completedPayload);
                logEvent(i, 'Завершено', bed.duration, 'system', bed.procedureName);
            }
            broadcastUpdate();
        }
    }
}, 1000);

// ==================== HTTP СЕРВЕР ====================

const server = app.listen(PORT, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
    console.log(`Админка: http://localhost:${PORT}/admin/admin.html`);
    console.log(`Планшет врача: http://localhost:${PORT}/doctor/doctor.html`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
    });
});
