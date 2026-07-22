const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let currentUserData = window.__SERVER_USER_DATA || null;

async function completeSignIn(user) {
  console.log('completeSignIn called, uid:', user.uid, 'email:', user.email);
  currentUser = user;
  const loginPage = window.location.pathname === '/login' || window.location.pathname === '/';
  try {
    if (!sessionStorage.getItem('sessionInit')) {
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      });
      if (!res.ok) throw new Error('Error al crear sesión');
      sessionStorage.setItem('sessionInit', '1');
    }

    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      currentUserData = userDoc.data();
    } else {
      const allSnap = await db.collection('users').limit(1).get();
      const isFirst = allSnap.empty;
      const newUser = {
        email: user.email,
        role: isFirst ? 'Admin' : 'Usuario',
        displayName: user.displayName || user.email.split('@')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(user.uid).set(newUser);
      currentUserData = newUser;
    }

    if (loginPage) window.location.href = '/dashboard';
  } catch (e) {
    console.warn('Error loading user data:', e.code || e.message, e);
    currentUserData = { role: 'Usuario', displayName: user.displayName || user.email?.split('@')[0] };
    showToast('Error al cargar datos de usuario: ' + (e.message || 'desconocido'), 'error');
  }
}

async function initAuthResult() {
}

auth.onAuthStateChanged(async (user) => {
  console.log('onAuthStateChanged:', user ? 'user:' + user.uid : 'null', 'path:', window.location.pathname);
  currentUser = user;
  const publicPage = window.location.pathname === '/login' || window.location.pathname === '/';

  if (user) {
    await completeSignIn(user);
  } else {
    currentUserData = null;
    sessionStorage.removeItem('sessionInit');
    await fetch('/api/auth/logout', { method: 'POST' });
    if (!publicPage) window.location.href = '/login';
  }
});

function clearSession() {
  sessionStorage.removeItem('sessionInit');
}

async function registerUser(email, password, displayName) {
  clearSession();
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName });
  return cred;
}

async function loginUser(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}

async function handleLogout() {
  await auth.signOut();
}

function isAdmin() {
  return currentUserData?.role === 'Admin' || window.__IS_ADMIN === true;
}

async function ensureAuth() {
  if (currentUser) return;
  await new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(u => {
      if (u) { currentUser = u; unsub(); resolve(); }
    });
    setTimeout(() => { unsub(); resolve(); }, 10000);
  });
  if (!currentUser) throw new Error('Usuario no autenticado');
}

async function getAuthHeaders() {
  await ensureAuth();
  const token = await currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysUntil(date) {
  if (!date) return null;
  const now = new Date();
  const target = date.toDate ? date.toDate() : new Date(date);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function getAlertLevel(days) {
  if (days === null || days === undefined) return 'none';
  if (days <= 1) return 'critical';
  if (days <= 7) return 'warning';
  if (days <= 15) return 'info';
  return 'none';
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '-';
  return '$ ' + Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setSelectValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const exists = Array.from(el.options).some(o => o.value === val);
  el.value = exists ? val : '';
}

function showToast(message, type = 'success') {
  const colors = { success: 'text-green-400 bg-green-900/50 border-green-500/30', error: 'text-red-400 bg-red-900/50 border-red-500/30', warning: 'text-yellow-400 bg-yellow-900/50 border-yellow-500/30', info: 'text-blue-400 bg-blue-900/50 border-blue-500/30' };
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 z-50 px-5 py-3 rounded-lg border backdrop-blur-sm shadow-2xl transition-all duration-300 animate-slide-up ${colors[type] || 'text-gray-300 bg-gray-800/50 border-gray-600/30'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showLoading(show = true) {
  let loader = document.getElementById('global-loader');
  if (show) {
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'global-loader';
      loader.innerHTML = '<div class="loading-spinner"></div>';
      loader.className = 'fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50';
      document.body.appendChild(loader);
    }
  } else {
    if (loader) loader.remove();
  }
}

function showModal(modalId) { document.getElementById(modalId)?.classList.remove('hidden'); }
function hideModal(modalId) { document.getElementById(modalId)?.classList.add('hidden'); }

function friendlyError(e) {
  const map = {
    'auth/invalid-credential': 'Credenciales incorrectas.',
    'auth/user-not-found': 'Credenciales incorrectas.',
    'auth/wrong-password': 'Credenciales incorrectas.',
    'auth/operation-not-allowed': 'El registro con email está deshabilitado.',
    'auth/admin-restricted-operation': 'El registro con email está deshabilitado.',
    'auth/email-already-in-use': 'Este email ya está registrado.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá un momento.',
    'auth/network-request-failed': 'Error de conexión. Revisá tu internet.',
    'auth/invalid-email': 'El email ingresado no es válido.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana emergente. Hacé clic de nuevo o permití popups para este sitio.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google. Intentá de nuevo.',
    'auth/cancelled-popup-request': 'Ventana emergente cancelada. Intentá de nuevo.'
  };
  return map[e.code] || e.message;
}

function createActionButtons(editFn, deleteFn, viewFn) {
  const admin = isAdmin();
  const s = 'event.stopPropagation();';
  const viewBtn = viewFn ? `<button onclick="${s}${viewFn}" class="text-green-500 hover:text-green-400 mr-2 transition-colors" title="Ver">
    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
    </svg>
  </button>` : '';
  const editBtn = editFn && admin ? `<button onclick="${s}${editFn}" class="text-blue-500 hover:text-blue-400 mr-2 transition-colors" title="Editar">
    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
    </svg>
  </button>` : '';
  const deleteBtn = deleteFn && admin ? `<button onclick="${s}${deleteFn}" class="text-red-500 hover:text-red-400 transition-colors" title="Eliminar">
    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>
  </button>` : '';
  return `${viewBtn}${editBtn}${deleteBtn}`;
}

const _toJSON = (data) => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(_toJSON);
  const r = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object') {
      if (v.toDate && typeof v.toDate === 'function') {
        r[k] = { __type: 'timestamp', value: v.toDate().toISOString() };
      } else {
        r[k] = _toJSON(v);
      }
    } else {
      r[k] = v;
    }
  }
  return r;
};

async function _dumpCollection(name) {
  const snap = await db.collection(name).get();
  const docs = snap.docs.map(d => ({ id: d.id, ..._toJSON(d.data()) }));

  if (name !== 'vehicles') return docs;

  for (const doc of docs) {
    doc.subcolecciones = {};
    for (const sub of ['combustible', 'repuestos']) {
      const subSnap = await db.collection('vehicles').doc(doc.id).collection(sub).get();
      doc.subcolecciones[sub] = subSnap.docs.map(d => ({ id: d.id, ..._toJSON(d.data()) }));
    }
  }
  return docs;
}

async function getNextVehicleNumber() {
  const counterRef = db.collection('counters').doc('vehicles');
  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      if (!doc.exists) {
        const vehiclesSnap = await db.collection('vehicles').get();
        let max = 0;
        vehiclesSnap.docs.forEach(d => {
          const m = (d.data().interno || '').match(/^V0*(\d+)$/);
          if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
        });
        transaction.set(counterRef, { current: max });
        return { number: max + 1, formatted: `V${String(max + 1).padStart(3, '0')}` };
      }
      const next = (doc.data().current || 0) + 1;
      transaction.update(counterRef, { current: next });
      return { number: next, formatted: `V${String(next).padStart(3, '0')}` };
    });
    return result;
  } catch {
    return { number: Date.now(), formatted: `V${String(Date.now()).slice(-3).padStart(3, '0')}` };
  }
}

function _backupFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `Backup_[${yy}.${mm}.${dd}]_${hh}:${mi}:${ss}.json`;
}

async function _dumpAll() {
  const docs = await Promise.all([
    _dumpCollection('vehicles'),
    _dumpCollection('maintenance')
  ]);
  return { vehicles: docs[0], maintenance: docs[1] };
}

async function deleteMultipleWithBackup(collection, ids, label) {
  if (!isAdmin() || !ids.length) return;

  const plural = label === 'Vehículo' ? 'Vehículos' : label === 'Herramienta' ? 'Herramientas' : 'Mantenimientos';
  const ok = await Swal.fire({
    title: `Eliminar ${ids.length} ${plural}`,
    text: `Se descargará el estado completo de la base.\n${ids.length} registro(s) quedarán marcados como "baja" en el backup local.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6B7280',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    background: '#0F1220',
    color: '#F1F3F8'
  });
  if (!ok.isConfirmed) return;

  try {
    showLoading(true);

    const data = await _dumpAll();
    const backup = {
      _meta: {
        exportado: new Date().toISOString(),
        tipo: 'baja_completa',
        documentosEliminados: ids.map(id => ({ coleccion: collection, id }))
      },
      ...data
    };

    const idSet = new Set(ids);
    for (const doc of (backup[collection] || [])) {
      if (idSet.has(doc.id)) doc._meta = { estado: 'baja' };
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = _backupFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    await new Promise(r => setTimeout(r, 1500));

    const isVehicles = collection === 'vehicles';
    for (const id of ids) {
      if (isVehicles) {
        for (const sub of ['combustible', 'repuestos']) {
          const snap = await db.collection('vehicles').doc(id).collection(sub).get();
          if (!snap.empty) {
            const batch = db.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }
      }
      await db.collection(collection).doc(id).delete();
    }

    showToast(`${ids.length} ${plural} eliminados de Firebase. Backup descargado en tu PC.`);
  } catch (e) {
    showToast('Error: ' + (e.message || 'desconocido'), 'error');
  } finally {
    showLoading(false);
  }
}

async function deleteWithBackup(collection, docId, label) {
  await deleteMultipleWithBackup(collection, [docId], label);
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthResult();

  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
});
