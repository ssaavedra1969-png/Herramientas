let allUsers = [];

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initRealtimeListener();
  document.getElementById('form-usuario')?.addEventListener('submit', saveUserRole);
  setupModalClose('modal-usuario');
});

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}

function setupModalClose(modalId) {
  document.getElementById(modalId)?.addEventListener('click', (e) => {
    if (e.target === document.getElementById(modalId)) hideModal(modalId);
  });
}

function initRealtimeListener() {
  showLoading(true);
  db.collection('users').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
    allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers(allUsers);
    showLoading(false);
  }, (error) => {
    console.error('Error loading users:', error);
    document.getElementById('users-table-body').innerHTML =
      '<tr><td colspan="5" class="text-center py-8 text-red-500">Error al cargar usuarios</td></tr>';
    showLoading(false);
  });
}

function renderUsers(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-400">No hay usuarios registrados</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isCurrentUser = u.id === (currentUser?.uid || '');
    const isAdminUser = currentUserData?.role === 'Admin';
    const roleStyle = u.role === 'Admin'
      ? 'background-color:rgba(52,211,153,0.15);color:#34D399'
      : 'background-color:rgba(96,165,250,0.15);color:#60A5FA';
    return `
      <tr class="border-b border-white/5 hover:bg-[#6C3CE1]/10">
        <td class="py-3 pr-3 font-medium">${u.displayName || '—'} ${isCurrentUser ? '<span class="text-xs text-blue-500 ml-1">(tú)</span>' : ''}</td>
        <td class="py-3 pr-3">${u.email || '—'}</td>
        <td class="py-3 pr-3"><span class="status-badge" style="${roleStyle}">${u.role || 'Usuario'}</span></td>
        <td class="py-3 pr-3 text-xs">${formatDate(u.createdAt)}</td>
        <td class="py-3 no-print flex gap-2">
          <button onclick="viewUser('${u.id}')" class="text-[#8E94A8] hover:text-[#F1F3F8]" title="Ver detalle">
            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
          ${isAdminUser ? `
          <button onclick="openUserModal('${u.id}')" class="text-blue-400 hover:text-blue-300" title="Editar rol">
            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          ${!isCurrentUser ? `
          <button onclick="deleteUser('${u.id}', '${(u.displayName || u.email || '').replace(/'/g, "\\'")}')" class="text-red-400 hover:text-red-300" title="Eliminar usuario">
            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>` : ''}
          ` : ''}
        </td>
      </tr>`;
  }).join('');
}

function openUserModal(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('user-id').value = userId;
  document.getElementById('user-display-name').textContent = user.displayName || '—';
  document.getElementById('user-email').textContent = user.email || '—';
  document.getElementById('user-role').value = user.role || 'Usuario';

  showModal('modal-usuario');
}

function closeUserModal() {
  hideModal('modal-usuario');
}

async function deleteUser(userId, displayName) {
  if (!confirm(`¿Eliminar el usuario "${displayName}"?\n\nEsto eliminará su registro de la base de datos. Si tiene cuenta de Firebase Auth, esa cuenta seguirá existiendo.`)) return;

  try {
    showLoading(true);
    await db.collection('users').doc(userId).delete();
    showToast('Usuario eliminado');
  } catch (e) {
    showToast('Error al eliminar: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

function viewUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  const info = [
    { label: 'Nombre', value: user.displayName || '—' },
    { label: 'Email', value: user.email || '—' },
    { label: 'Rol', value: user.role || 'Usuario' },
    { label: 'Registrado', value: formatDate(user.createdAt) },
    { label: 'Último ingreso', value: formatDate(user.lastLoginAt) || '—' },
    { label: 'UID', value: user.id }
  ];

  let html = '';
  info.forEach(i => {
    html += `<div class="flex justify-between py-2 border-b border-[#6C3CE1]/10">
      <span class="text-[#8E94A8] text-sm">${i.label}</span>
      <span class="text-[#F1F3F8] text-sm font-medium text-right max-w-[200px] truncate">${i.value}</span>
    </div>`;
  });

  Swal.fire({
    title: 'Detalle del Usuario',
    html: `<div class="text-left">${html}</div>`,
    icon: 'info',
    background: '#0F1220',
    color: '#F1F3F8',
    confirmButtonColor: '#6C3CE1',
    confirmButtonText: 'Cerrar'
  });
}

async function triggerBackup() {
  const btn = document.getElementById('btn-backup');
  btn.disabled = true;
  btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> Respaldando...';

  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/backup', { method: 'POST', headers });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Error desconocido' }));
      showToast('Error en backup: ' + (errData.error || 'desconocido'), 'error');
      return;
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
    const filename = filenameMatch ? filenameMatch[1] : `backup-${new Date().toISOString().slice(0,10)}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    showToast('Backup descargado exitosamente', 'success');
  } catch (err) {
    showToast('Error al conectar con el servidor: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> Backup DB';
  }
}

async function saveUserRole(e) {
  e.preventDefault();

  const userId = document.getElementById('user-id').value;
  const newRole = document.getElementById('user-role').value;

  if (!userId) return;

  try {
    showLoading(true);
    await db.collection('users').doc(userId).update({
      role: newRole,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Rol actualizado exitosamente');
    if (userId === currentUser?.uid) {
      currentUserData.role = newRole;
    }
    closeUserModal();
  } catch (error) {
    showToast('Error al actualizar rol: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}
