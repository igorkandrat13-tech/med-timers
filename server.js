const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const MAX_BEDS = 100;

const cabinsFile = path.join(__dirname, 'cabins.json');
let cabins = [];

function buildDefaultCabins(count) {
    const out = [];
    for (let i = 1; i <= count; i++) {
        out.push({ id: i, number: i, name: `Кабинка ${i}` });
    }
    return out;
}

function loadCabins() {
    if (!fs.existsSync(cabinsFile)) {
        cabins = buildDefaultCabins(14);
        fs.writeFileSync(cabinsFile, JSON.stringify(cabins, null, 2));
        return;
    }
    try {
        const raw = JSON.parse(fs.readFileSync(cabinsFile, 'utf8'));
        if (Array.isArray(raw) && raw.length) {
            cabins = raw
                .map((c, idx) => ({
                    id: Number.isFinite(parseInt(c.id, 10)) ? parseInt(c.id, 10) : (idx + 1),
                    number: Number.isFinite(parseInt(c.number, 10)) ? parseInt(c.number, 10) : (idx + 1),
                    name: String(c.name || '').trim() || `Кабинка ${Number.isFinite(parseInt(c.number, 10)) ? parseInt(c.number, 10) : (idx + 1)}`
                }))
                .filter(c => Number.isFinite(c.id) && c.id >= 1 && c.id <= MAX_BEDS)
                .sort((a, b) => a.id - b.id);
        } else {
            cabins = buildDefaultCabins(14);
        }
    } catch {
        cabins = buildDefaultCabins(14);
    }
}

function saveCabins() {
    fs.writeFileSync(cabinsFile, JSON.stringify(cabins, null, 2));
}

function getCabinCount() {
    return Array.isArray(cabins) ? cabins.length : 0;
}

function getCabinNumberById(cabinId) {
    const c = (cabins || []).find(x => x.id === cabinId);
    return c && Number.isFinite(c.number) ? c.number : cabinId;
}

loadCabins();

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

const adminAuthFile = path.join(__dirname, 'admin_auth.json');
let adminAuth = null;

function deriveAdminPasswordHash(password, saltBase64) {
    const salt = Buffer.from(String(saltBase64 || ''), 'base64');
    const key = crypto.pbkdf2Sync(String(password || ''), salt, 120000, 32, 'sha256');
    return key.toString('hex');
}

function loadAdminAuth() {
    if (!fs.existsSync(adminAuthFile)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(adminAuthFile, 'utf8'));
        if (!raw || typeof raw !== 'object') return null;
        if (typeof raw.salt !== 'string' || typeof raw.hash !== 'string') return null;
        if (!raw.salt.trim() || !raw.hash.trim()) return null;
        return { salt: raw.salt, hash: raw.hash };
    } catch {
        return null;
    }
}

function verifyAdminPassword(password) {
    if (adminAuth && adminAuth.salt && adminAuth.hash) {
        const computed = deriveAdminPasswordHash(password, adminAuth.salt);
        const a = Buffer.from(computed, 'hex');
        const b = Buffer.from(String(adminAuth.hash), 'hex');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    }
    return String(password || '') === String(ADMIN_PASSWORD || '');
}

function setAdminPassword(newPassword) {
    const salt = crypto.randomBytes(16).toString('base64');
    const hash = deriveAdminPasswordHash(newPassword, salt);
    const payload = { version: 1, salt, hash, updatedAt: new Date().toISOString() };
    fs.writeFileSync(adminAuthFile, JSON.stringify(payload, null, 2));
    adminAuth = { salt, hash };
}

adminAuth = loadAdminAuth();

function hashPin(pin) {
    return crypto.createHmac('sha256', AUTH_SECRET).update(`pin:${String(pin)}`).digest('hex');
}

const usersFile = path.join(__dirname, 'users.json');
let users = [];
if (fs.existsSync(usersFile)) {
    try {
        users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        if (!Array.isArray(users)) users = [];
    } catch {
        users = [];
    }
} else {
    users = [
        { id: 1, fio: 'Врач', pinHash: hashPin('0000'), active: true, createdAt: new Date().toISOString() }
    ];
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function saveUsers() {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

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
    const { role } = req.body || {};

    if (role === 'admin') {
        const { username, password } = req.body || {};
        if (username !== ADMIN_USER || !verifyAdminPassword(password)) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }
        const exp = Date.now() + 1000 * 60 * 60 * 12;
        const token = signToken({ role: 'admin', sub: username, exp });
        const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
        const secure = isHttps ? '; Secure' : '';
        res.setHeader('Set-Cookie', `mtoken=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${secure}`);
        return res.json({ success: true, role: 'admin' });
    }

    if (role === 'doctor') {
        const { userId, pin } = req.body || {};
        const id = parseInt(userId, 10);
        const user = users.find(u => u.id === id && u.active);
        if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
        if (user.pinHash !== hashPin(pin)) return res.status(401).json({ error: 'Неверный ПИН-код' });
        const exp = Date.now() + 1000 * 60 * 60 * 12;
        const token = signToken({ role: 'doctor', sub: String(id), userId: id, fio: user.fio, exp });
        const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
        const secure = isHttps ? '; Secure' : '';
        res.setHeader('Set-Cookie', `mtoken=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${secure}`);
        return res.json({ success: true, role: 'doctor', fio: user.fio });
    }

    return res.status(400).json({ error: 'Неверная роль' });
});

app.post('/api/auth/logout', (req, res) => {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const secure = isHttps ? '; Secure' : '';
    res.setHeader('Set-Cookie', `mtoken=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`);
    res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
    const cookies = parseCookies(req);
    const payload = verifyToken(cookies.mtoken);
    if (!payload) return res.json({ role: null });
    res.json({ role: payload.role, sub: payload.sub || null, userId: payload.userId || null, fio: payload.fio || null });
});

app.post('/api/admin/password', ensureApiRole('admin'), (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!verifyAdminPassword(currentPassword)) {
        return res.status(401).json({ error: 'Неверный текущий пароль' });
    }
    const next = String(newPassword || '');
    if (next.length < 6 || next.length > 64) {
        return res.status(400).json({ error: 'Новый пароль должен быть 6–64 символа' });
    }
    setAdminPassword(next);
    res.json({ success: true });
});

app.get('/api/users/public', (req, res) => {
    res.json({ users: users.filter(u => u.active).map(u => ({ id: u.id, fio: u.fio })) });
});

app.get('/api/users', ensureApiRole('admin'), (req, res) => {
    res.json({ users: users.map(u => ({ id: u.id, fio: u.fio, active: !!u.active, createdAt: u.createdAt || null })) });
});

app.post('/api/users', ensureApiRole('admin'), (req, res) => {
    const { fio, pin } = req.body || {};
    const cleanFio = String(fio || '').trim();
    const cleanPin = String(pin || '').trim();
    if (!cleanFio) return res.status(400).json({ error: 'Введите ФИО' });
    if (!/^\d{4,10}$/.test(cleanPin)) return res.status(400).json({ error: 'ПИН должен быть 4-10 цифр' });
    const nextId = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1;
    users.push({ id: nextId, fio: cleanFio, pinHash: hashPin(cleanPin), active: true, createdAt: new Date().toISOString() });
    saveUsers();
    res.json({ success: true });
});

app.put('/api/users/:id', ensureApiRole('admin'), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (req.body && req.body.fio !== undefined) {
        const cleanFio = String(req.body.fio || '').trim();
        if (!cleanFio) return res.status(400).json({ error: 'Введите ФИО' });
        user.fio = cleanFio;
    }
    if (req.body && req.body.pin !== undefined && String(req.body.pin || '').trim()) {
        const cleanPin = String(req.body.pin || '').trim();
        if (!/^\d{4,10}$/.test(cleanPin)) return res.status(400).json({ error: 'ПИН должен быть 4-10 цифр' });
        user.pinHash = hashPin(cleanPin);
    }
    if (req.body && req.body.active !== undefined) {
        user.active = !!req.body.active;
    }
    saveUsers();
    res.json({ success: true });
});

function ensureRole(role) {
    return (req, res, next) => {
        const cookies = parseCookies(req);
        const payload = verifyToken(cookies.mtoken);
        if (!payload || payload.role !== role) {
            const target = role === 'admin' ? '/auth/login.html?role=admin' : '/auth/login.html?role=doctor';
            return res.redirect(target);
        }
        req.user = payload;
        next();
    };
}

function ensureAnyRole(roles) {
    return (req, res, next) => {
        const cookies = parseCookies(req);
        const payload = verifyToken(cookies.mtoken);
        if (!payload || !roles.includes(payload.role)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = payload;
        next();
    };
}

function ensureApiRole(role) {
    return ensureAnyRole([role]);
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
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
    exec('git rev-parse --short HEAD', { cwd: __dirname }, (err, stdout) => {
        if (err) {
            return res.json({ version: null });
        }
        res.json({ version: stdout.trim() });
    });
});

// ==================== GIT ОБНОВЛЕНИЯ ====================

function execInRepo(command, cb) {
    exec(command, { cwd: __dirname }, cb);
}

// Проверка обновлений (fetch и статус)
app.get('/api/updates/check', ensureApiRole('admin'), (req, res) => {
    execInRepo('git fetch', (err) => {
        if (err) {
            console.error('Git fetch error:', err);
            return res.json({ available: false, error: 'Git fetch failed' });
        }
        
        // Проверяем, сколько коммитов позади
        execInRepo('git rev-list HEAD...origin/main --count', (err, stdout) => {
            if (err) {
                // Если origin/main нет, пробуем origin/master
                 execInRepo('git rev-list HEAD...origin/master --count', (err2, stdout2) => {
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
app.post('/api/updates/pull', ensureApiRole('admin'), (req, res) => {
    execInRepo('git pull', (err, stdout, stderr) => {
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
app.get('/api/updates/commits', ensureApiRole('admin'), (req, res) => {
    execInRepo('git log -n 10 --pretty=format:%h%x1f%ct%x1f%s', (err, stdout, stderr) => {
        if (err) {
            console.error('Git log error:', err);
            return res.status(500).json({ error: 'List commits failed', details: stderr });
        }
        const commits = String(stdout).split('\n').filter(Boolean).map(line => {
            const [hash, ts, ...rest] = line.split('\x1f');
            return { hash, time: Number(ts) || null, subject: rest.join('\x1f') || '' };
        });
        res.json({ commits });
    });
});

app.get('/api/updates/releases', ensureApiRole('admin'), (req, res) => {
    const limitRaw = parseInt(String(req.query.limit || '15'), 10);
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 15));
    execInRepo('git rev-parse HEAD', (eHead, headStdout) => {
        if (eHead) {
            return res.status(500).json({ error: 'Releases failed', details: 'Cannot get HEAD' });
        }
        const headFull = String(headStdout || '').trim();
        execInRepo(`git log -n ${limit} --pretty=format:%h%x1f%H%x1f%ct%x1f%s`, (err, stdout, stderr) => {
            if (err) {
                return res.status(500).json({ error: 'Releases failed', details: stderr });
            }
            const lines = String(stdout || '').split('\n').filter(Boolean);
            const releases = lines.map(line => {
                const [shortHash, fullHash, ts, ...rest] = line.split('\x1f');
                const message = rest.join('\x1f');
                const time = parseInt(ts, 10);
                return {
                    hash: String(fullHash || '').trim(),
                    short: String(shortHash || '').trim(),
                    time: Number.isFinite(time) ? time : null,
                    subject: String(message || '').trim(),
                    current: String(fullHash || '').trim() === headFull
                };
            });
            res.json({ releases });
        });
    });
});

app.post('/api/updates/rollback-to', ensureApiRole('admin'), (req, res) => {
    const hash = String(req.body?.hash || '').trim();
    if (!/^[0-9a-f]{7,40}$/i.test(hash)) {
        return res.status(400).json({ error: 'Rollback failed', details: 'Invalid hash' });
    }
    execInRepo(`git rev-parse --verify ${hash}^{commit}`, (e1, out1, err1) => {
        if (e1) {
            return res.status(400).json({ error: 'Rollback failed', details: 'Commit not found' });
        }
        const resolved = String(out1 || '').trim();
        execInRepo(`git reset --hard ${resolved}`, (e2, out2, err2) => {
            if (e2) {
                return res.status(500).json({ error: 'Rollback failed', details: err2 });
            }
            res.json({ success: true, message: `Rolled back to ${hash}. Restarting server...` });
            setTimeout(() => process.exit(1), 1000);
        });
    });
});

// Откат на предыдущий коммит (legacy layout)
app.post('/api/updates/rollback', ensureApiRole('admin'), (req, res) => {
    execInRepo('git rev-parse --short HEAD~1', (e1, prevHash) => {
        if (e1) {
            console.error('Git rev-parse error:', e1);
            return res.status(400).json({ error: 'Rollback failed', details: 'Previous commit not found' });
        }
        execInRepo('git reset --hard HEAD~1', (e2, out2, err2) => {
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
app.post('/api/updates/cleanup', ensureApiRole('admin'), (req, res) => {
    // Для working-copy из git нет каталогов releases; делаем лёгкую очистку объектов
    execInRepo('git gc --prune=now', (err, stdout, stderr) => {
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
    fs.writeFileSync(logFile, 'Дата,Время,Кабинка,Событие,Длительность,Оператор,Процедура\n');
}

// Вспомогательная функция логирования
function logEvent(bedId, event, duration, operator, procedureName) {
    const timestamp = new Date().toLocaleString('ru-RU');
    const [date, time] = timestamp.split(', ');
    const cabinNumber = getCabinNumberById(bedId);
    fs.appendFileSync(logFile, `${date},${time},${cabinNumber},${event},${duration},${operator},${procedureName || '-'}\n`);
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

function normalizeCabinsList(value) {
    if (value === undefined || value === null) return null;
    const arr = Array.isArray(value) ? value : [value];
    const out = arr
        .flatMap(v => String(v).split(','))
        .map(s => parseInt(String(s).trim(), 10))
        .filter(n => Number.isFinite(n) && n >= 1 && n <= MAX_BEDS);
    return out.length ? Array.from(new Set(out)).sort((a, b) => a - b) : [];
}

function isProcedureAllowedInCabin(proc, cabinId) {
    if (!proc) return true;
    const list = normalizeCabinsList(proc.allowedCabins);
    if (list === null) return true;
    if (list.length === 0) return false;
    return list.includes(cabinId);
}

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

// Хранилище состояний таймеров (индекс 1..MAX_BEDS, активных: getCabinCount())
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

app.post('/api/control', ensureAnyRole(['admin', 'doctor']), (req, res) => {
    const { bed, action, minutes, operator = 'system', procedureName = null } = req.body;
    const operatorName = (req.user && req.user.role === 'doctor' && req.user.fio)
        ? req.user.fio
        : ((req.user && req.user.role === 'admin' && req.user.sub) ? req.user.sub : operator);
    const bedId = parseInt(bed);
    
    if (bedId < 1 || bedId > getCabinCount()) {
        return res.status(400).json({ error: 'Неверный номер кабинки' });
    }

    const bedData = beds[bedId];
    if (!bedData) {
        return res.status(400).json({ error: 'Кабинка не найдена' });
    }

    try {
        switch (action) {
            case 'start':
                if (bedData.status !== 'idle') {
                    return res.status(400).json({ error: 'Кабинка занята' });
                }

                const proc = procedures.find(p => p.name === procedureName);
                if (proc && !isProcedureAllowedInCabin(proc, bedId)) {
                    return res.status(400).json({ error: `Процедура недоступна для кабинки ${getCabinNumberById(bedId)}` });
                }
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

                logEvent(bedId, 'Старт', duration, operatorName, procedureName);
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
                logEvent(bedId, 'Пауза', Math.round(bedData.remainingTime / 60000), operatorName, bedData.procedureName);
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
                  logEvent(bedId, 'Продолжить', Math.round(bedData.remainingTime / 60000), operatorName, bedData.procedureName);
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
                logEvent(bedId, 'Стоп', stopDuration, operatorName, stopProc);
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
                logEvent(bedId, 'Сброс', resetDuration, operatorName, resetProc);
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

                logEvent(bedId, 'Следующий этап', nextDuration, operatorName, procedureName);
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
    res.json({ beds: beds.slice(1, getCabinCount() + 1) });
});

app.get('/api/cabins', ensureAnyRole(['admin', 'doctor']), (req, res) => {
    res.json({ cabins });
});

app.post('/api/cabins', ensureApiRole('admin'), (req, res) => {
    const { number, name } = req.body || {};
    const cabinNumber = parseInt(number, 10);
    if (!Number.isFinite(cabinNumber) || cabinNumber < 1 || cabinNumber > 999) {
        return res.status(400).json({ error: 'Некорректный номер кабинки' });
    }
    if ((cabins || []).some(c => parseInt(c.number, 10) === cabinNumber)) {
        return res.status(400).json({ error: 'Кабинка с таким номером уже существует' });
    }
    const nextId = (cabins || []).length + 1;
    if (nextId > MAX_BEDS) {
        return res.status(400).json({ error: 'Достигнут лимит кабинок' });
    }
    const cabinName = String(name || '').trim() || `Кабинка ${cabinNumber}`;
    const newCabin = { id: nextId, number: cabinNumber, name: cabinName };
    cabins.push(newCabin);
    saveCabins();
    res.json({ success: true, cabin: newCabin, cabins });
    broadcastCabins();
    broadcastUpdate();
});

app.put('/api/cabins/:id', ensureApiRole('admin'), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const index = (cabins || []).findIndex(c => c.id === id);
    if (index === -1) return res.status(404).json({ error: 'Кабинка не найдена' });
    const { number, name } = req.body || {};
    if (number !== undefined) {
        const cabinNumber = parseInt(number, 10);
        if (!Number.isFinite(cabinNumber) || cabinNumber < 1 || cabinNumber > 999) {
            return res.status(400).json({ error: 'Некорректный номер кабинки' });
        }
        const exists = (cabins || []).some(c => c.id !== id && parseInt(c.number, 10) === cabinNumber);
        if (exists) return res.status(400).json({ error: 'Кабинка с таким номером уже существует' });
        cabins[index].number = cabinNumber;
    }
    if (name !== undefined) {
        cabins[index].name = String(name || '').trim() || `Кабинка ${cabins[index].number}`;
    }
    saveCabins();
    res.json({ success: true, cabin: cabins[index], cabins });
    broadcastCabins();
    broadcastUpdate();
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

function broadcastCabins() {
    const payload = JSON.stringify({ type: 'cabins_updated', cabins });
    broadcastToRole(['admin', 'doctor'], payload);
}

app.post('/api/procedures', (req, res) => {
    const { name, duration, stages, allowedCabins } = req.body;
    if (!name || !duration) {
        return res.status(400).json({ error: 'Название и длительность обязательны' });
    }

    const maxId = procedures.length > 0 ? Math.max(...procedures.map(p => p.id)) : 0;
    const maxOrder = procedures.length > 0 ? Math.max(...procedures.map(p => Number.isFinite(p.order) ? p.order : 0)) : 0;
    const newProcedure = {
        id: maxId + 1,
        name: name.trim(),
        duration: parseFloat(duration) || 0,
        active: true,
        order: maxOrder + 1,
        createdAt: new Date().toISOString()
    };

    const cabins = normalizeCabinsList(allowedCabins);
    const cabinCount = getCabinCount();
    if (cabins !== null) {
        if (cabins.length === cabinCount) {
        } else {
            newProcedure.allowedCabins = cabins;
        }
    }

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
    const { name, duration, active, stages, allowedCabins, order } = req.body;
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

    if (allowedCabins !== undefined) {
        if (allowedCabins === null) {
            delete procedures[index].allowedCabins;
        } else {
            const cabins = normalizeCabinsList(allowedCabins);
            const cabinCount = getCabinCount();
            if (cabins === null) {
                delete procedures[index].allowedCabins;
            } else if (cabins.length === cabinCount) {
                delete procedures[index].allowedCabins;
            } else {
                procedures[index].allowedCabins = cabins;
            }
        }
    }

    if (order !== undefined) {
        const n = parseInt(order, 10);
        if (!Number.isFinite(n) || n < 1) {
            return res.status(400).json({ error: 'Некорректный порядок' });
        }
        procedures[index].order = n;
    }

    saveProceduresToFile();
    res.json({ success: true, procedure: procedures[index] });
    broadcastProcedures();
});

app.post('/api/procedures/order', ensureApiRole('admin'), (req, res) => {
    const { orders } = req.body || {};
    if (!Array.isArray(orders) || orders.length === 0) {
        return res.status(400).json({ error: 'orders обязателен' });
    }
    const updates = [];
    for (const item of orders) {
        if (!item || item.id === undefined || item.order === undefined) continue;
        const id = parseInt(item.id, 10);
        const ord = parseInt(item.order, 10);
        if (!Number.isFinite(id) || !Number.isFinite(ord) || ord < 1) {
            return res.status(400).json({ error: 'Некорректные данные в orders' });
        }
        updates.push({ id, order: ord });
    }
    if (updates.length === 0) {
        return res.status(400).json({ error: 'orders пуст' });
    }
    const byId = new Map(procedures.map(p => [p.id, p]));
    for (const u of updates) {
        const p = byId.get(u.id);
        if (p) p.order = u.order;
    }
    saveProceduresToFile();
    res.json({ success: true });
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

function parseRuDateTime(dateStr, timeStr) {
    const d = String(dateStr || '').trim();
    const t = String(timeStr || '').trim();
    const m = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    const tm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m || !tm) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const hour = Number(tm[1]);
    const minute = Number(tm[2]);
    const second = Number(tm[3] || '0');
    const dt = new Date(year, month - 1, day, hour, minute, second, 0);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
}

function parseLogLine(line) {
    const raw = String(line || '').trim();
    if (!raw) return null;
    const parts = raw.split(',');
    if (parts.length < 7) return null;
    const date = parts[0];
    const time = parts[1];
    const bedId = parseInt(parts[2], 10);
    const event = parts[3];
    const durationMin = Number(parts[4]);
    const operator = parts[5];
    const procedureName = parts.slice(6).join(',').trim();
    const ts = parseRuDateTime(date, time);
    if (!Number.isFinite(bedId)) return null;
    return {
        ts,
        date,
        time,
        bedId,
        event: String(event || '').trim(),
        durationMin: Number.isFinite(durationMin) ? durationMin : null,
        operator: String(operator || '').trim(),
        procedureName: procedureName || null
    };
}

function buildProcedureSessions(rows) {
    const openByBed = new Map();
    const sessions = [];

    for (const row of rows) {
        if (!row || !row.ts) continue;
        const bedId = row.bedId;
        const ev = row.event;

        if (ev === 'Старт') {
            const session = {
                bedId,
                operator: row.operator || '',
                procedureName: row.procedureName || '',
                startedAt: row.ts,
                endedAt: null,
                result: null,
                cancelEvent: null,
                plannedMinutes: row.durationMin || 0
            };
            openByBed.set(bedId, session);
            continue;
        }

        const current = openByBed.get(bedId);
        if (!current) continue;

        if (ev === 'Следующий этап') {
            if (row.durationMin) current.plannedMinutes += row.durationMin;
            continue;
        }

        if (ev === 'Завершено') {
            current.endedAt = row.ts;
            current.result = 'completed';
            sessions.push(current);
            openByBed.delete(bedId);
            continue;
        }

        if (ev === 'Сброс' || ev === 'Стоп') {
            current.endedAt = row.ts;
            current.result = 'cancelled';
            current.cancelEvent = ev;
            sessions.push(current);
            openByBed.delete(bedId);
        }
    }

    return sessions;
}

app.get('/api/logs.xlsx', ensureApiRole('admin'), async (req, res) => {
    try {
        let ExcelJS;
        try {
            ExcelJS = require('exceljs');
        } catch (e) {
            return res.status(503).json({ error: 'XLSX generation module not installed' });
        }
        const fromStr = String(req.query.from || '').trim();
        const toStr = String(req.query.to || '').trim();
        const bedRaw = req.query.bed;
        const operatorRaw = req.query.operator;

        let bedSet = null;
        if (bedRaw !== undefined) {
            let arr = Array.isArray(bedRaw) ? bedRaw : [String(bedRaw || '')];
            arr = arr.join(',').split(',').map(s => parseInt(String(s).trim(), 10)).filter(n => Number.isFinite(n));
            if (arr.length > 0) bedSet = new Set(arr);
        }

        let operatorSet = null;
        if (operatorRaw !== undefined) {
            let arr = Array.isArray(operatorRaw) ? operatorRaw : [String(operatorRaw || '')];
            arr = arr.join(',').split(',').map(s => String(s).trim()).filter(Boolean);
            if (arr.length > 0) operatorSet = new Set(arr);
        }

        let fromDt = null;
        let toDt = null;
        if (fromStr) {
            const m = fromStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) fromDt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
        }
        if (toStr) {
            const m = toStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) toDt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
        }

        const content = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
        const rows = String(content || '').split('\n').map(parseLogLine).filter(Boolean);
        const sessions = buildProcedureSessions(rows)
            .filter(s => s.endedAt)
            .filter(s => (bedSet ? bedSet.has(s.bedId) : true))
            .filter(s => (operatorSet ? operatorSet.has(s.operator) : true))
            .filter(s => (fromDt ? ((s.endedAt && s.endedAt >= fromDt) || (!s.endedAt && s.startedAt >= fromDt)) : true))
            .filter(s => (toDt ? ((s.endedAt && s.endedAt <= toDt) || (!s.endedAt && s.startedAt <= toDt)) : true))
            .sort((a, b) => a.startedAt - b.startedAt);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Журнал');

        sheet.columns = [
            { header: 'Дата', key: 'date', width: 12 },
            { header: 'Время начала', key: 'startTime', width: 12 },
            { header: 'Время конца', key: 'endTime', width: 12 },
            { header: 'Кабинка', key: 'bed', width: 9 },
            { header: 'Пользователь', key: 'user', width: 22 },
            { header: 'Процедура', key: 'proc', width: 34 },
            { header: 'План (мин)', key: 'planned', width: 12 },
            { header: 'Факт (мин)', key: 'actual', width: 12 },
            { header: 'Результат', key: 'result', width: 14 },
            { header: 'Причина отмены', key: 'cancel', width: 18 }
        ];

        sessions.forEach(s => {
            const dd = s.startedAt;
            const ee = s.endedAt;
            const date = dd.toLocaleDateString('ru-RU');
            const startTime = dd.toLocaleTimeString('ru-RU');
            const endTime = ee ? ee.toLocaleTimeString('ru-RU') : '';
            const actual = ee ? Math.max(0, Math.round((ee.getTime() - dd.getTime()) / 60000)) : '';
            const planned = Number.isFinite(s.plannedMinutes) && s.plannedMinutes > 0 ? s.plannedMinutes : '';
            const result = s.result === 'completed' ? 'Завершено' : 'Отменено';
            const cancel = s.result === 'cancelled' ? (s.cancelEvent || 'Отмена') : '';
            sheet.addRow({
                date,
                startTime,
                endTime,
                bed: s.bedId,
                user: s.operator || '',
                proc: s.procedureName || '',
                planned,
                actual,
                result,
                cancel
            });
        });

        sheet.getRow(1).font = { bold: true };
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: sheet.columns.length }
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="timers_log.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (e) {
        res.status(500).json({ error: 'Export failed', details: e.message || String(e) });
    }
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
    const needsAuth = role === 'admin' || role === 'doctor';
    if (needsAuth) {
        if (!payload || payload.role !== role) {
            ws.close(4001, 'unauthorized');
            return;
        }
    }

    clients.set(ws, { bedId, role });

    // Отправляем начальное состояние
    if (role === 'admin' || role === 'doctor') {
        const cabinCount = getCabinCount();
        ws.send(JSON.stringify({
            type: 'state',
            beds: beds.slice(1, cabinCount + 1)
        }));
        ws.send(JSON.stringify({
            type: 'cabins_updated',
            cabins: cabins
        }));
        ws.send(JSON.stringify({
            type: 'procedures_updated',
            procedures: procedures
        }));
    } else if (bedId >= 1 && bedId <= getCabinCount()) {
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
    const cabinCount = getCabinCount();
    const payload = JSON.stringify({
        type: 'update_all',
        beds: beds.slice(1, cabinCount + 1)
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
    const cabinCount = getCabinCount();
    const currentBeds = beds.slice(1, cabinCount + 1);

    // Тик таймера для админов и врачей
    const timePayload = JSON.stringify({
        type: 'time_update',
        serverTime: now,
        beds: currentBeds
    });
    broadcastToRole(['admin', 'doctor'], timePayload);

    // Обновляем состояние сервера и проверяем завершение
    for (let i = 1; i <= cabinCount; i++) {
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
