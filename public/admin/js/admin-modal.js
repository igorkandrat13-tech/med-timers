// ==================== МОДАЛЬНЫЕ ОКНА ====================

export function initModalHandlers() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });

    // ✅ Новый обработчик
  const openProcBtn = document.getElementById('open-procedures-btn');
  if (openProcBtn) {
    openProcBtn.addEventListener('click', () => {
      document.getElementById('procedures-modal').style.display = 'flex';
      import('./admin-procedures.js').then(module => {
        module.loadProcedures();
      });
    });
  }
  
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').style.display = 'none';
    });
  });
  
  window.openProceduresModal = () => {
    document.getElementById('procedures-modal').style.display = 'flex';
    import('./admin-procedures.js').then(module => {
      module.loadProcedures();
    });
  };

  window.openUsersModal = () => {
    document.getElementById('users-modal').style.display = 'flex';
    import('./admin-users.js').then(module => {
      module.loadUsers();
    });
    const modal = document.getElementById('users-modal');
    const closeX = document.getElementById('users-close-x');
    const closeBtn = document.getElementById('users-close-btn');
    if (modal && !modal._usersBound) {
      modal._usersBound = true;
      modal.addEventListener('click', (e) => { if (e.target === modal) window.closeUsersModal(); });
    }
    if (closeX && !closeX._usersBound) {
      closeX._usersBound = true;
      closeX.addEventListener('click', () => window.closeUsersModal());
    }
    if (closeBtn && !closeBtn._usersBound) {
      closeBtn._usersBound = true;
      closeBtn.addEventListener('click', () => window.closeUsersModal());
    }
  };

  window.closeUsersModal = () => {
    const m = document.getElementById('users-modal');
    if (m) m.style.display = 'none';
  };
}
