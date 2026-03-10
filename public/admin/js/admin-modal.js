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
  };
}
