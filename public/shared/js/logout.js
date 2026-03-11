async function doLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (_) {
  } finally {
    window.location.href = '/';
  }
}

function initLogoutButton(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    if (btn.textContent && btn.textContent.includes('Выйти')) btn.textContent = '...';
    await doLogout();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLogoutButton('logout-btn-admin');
  initLogoutButton('logout-btn-doctor');
});

