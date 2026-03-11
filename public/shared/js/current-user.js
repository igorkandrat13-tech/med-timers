async function loadCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', { method: 'GET' });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    const el = document.getElementById('current-user');
    if (!el) return;
    if (!data || !data.role) {
      el.textContent = '';
      return;
    }
    if (data.role === 'admin') {
      el.textContent = `👤 ${data.sub || 'admin'}`;
      return;
    }
    if (data.role === 'doctor') {
      el.textContent = `👤 ${data.fio || 'врач'}`;
      return;
    }
    el.textContent = `👤 ${data.role}`;
  } catch (_) {
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadCurrentUser();
});

