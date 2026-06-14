const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let currentUserData = null;

const googleProvider = new firebase.auth.GoogleAuthProvider();

let redirectProcessing = false;

async function completeSignIn(user) {
  console.log('completeSignIn called, uid:', user.uid, 'email:', user.email);
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
      const newUser = {
        email: user.email,
        role: 'Usuario',
        displayName: user.displayName || user.email.split('@')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(user.uid).set(newUser);
      currentUserData = newUser;
    }
    currentUser = user;

    if (loginPage) window.location.href = '/dashboard';
  } catch (e) {
    console.warn('Error loading user data:', e.code || e.message, e);
    currentUserData = { role: 'Usuario', displayName: user.displayName || user.email?.split('@')[0] };
    showToast('Error al iniciar sesión: ' + (e.message || 'desconocido'), 'error');
  }
}

auth.getRedirectResult().then(async (result) => {
  console.log('getRedirectResult resolved:', result ? 'has result' : 'null');
  if (result) {
    console.log('Result type:', typeof result, 'proto:', Object.prototype.toString.call(result));
    console.log('Result keys:', Object.keys(result));
    console.log('Has user:', !!result.user, 'Has credential:', !!result.credential);
    if (result.error) console.log('Result has error:', result.error);
    if (result.operationType) console.log('Operation type:', result.operationType);
    if (result.user) {
      console.log('Redirect user found:', result.user.uid, result.user.email);
      redirectProcessing = true;
      await completeSignIn(result.user);
    } else {
      console.log('Result has no user. Full result:', JSON.stringify(result, (key, value) => {
        if (key === '_lat' || key === '_lng') return undefined;
        if (typeof value === 'object' && value !== null && Object.keys(value).length > 20) return '[Object]';
        return value;
      }, 2));
    }
  } else {
    console.log('No redirect result available');
  }
}).catch(error => {
  console.warn('getRedirectResult error:', error.code || error.message || error);
  if (error.code !== 'auth/no-redirect-result') {
    if (window.location.pathname === '/login' || window.location.pathname === '/') {
      const fn = typeof showLoginError === 'function' ? showLoginError : showToast;
      fn('Error de Google: ' + (error.message || error.code || 'Error de redirección'));
    }
  }
});

auth.onAuthStateChanged(async (user) => {
  console.log('onAuthStateChanged:', user ? 'user:' + user.uid : 'null', 'loginPage:', window.location.pathname, 'redirectProcessing:', redirectProcessing);
  currentUser = user;
  const loginPage = window.location.pathname === '/login' || window.location.pathname === '/';

  if (user) {
    if (redirectProcessing) { console.log('Skipping onAuthStateChanged, redirect in progress'); return; }

    await completeSignIn(user);
  } else {
    currentUserData = null;
    sessionStorage.removeItem('sessionInit');
    await fetch('/api/auth/logout', { method: 'POST' });
    if (!loginPage) window.location.href = '/login';
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

async function loginGoogle() {
  clearSession();
  try {
    await auth.signInWithRedirect(googleProvider);
  } catch (e) {
    const fn = typeof showLoginError === 'function' ? showLoginError : (typeof showToast === 'function' ? showToast : alert);
    fn('Error al iniciar sesión con Google: ' + (friendlyError(e) || e.message));
    console.error('signInWithRedirect error:', e.code, e.message);
  }
}

async function handleLogout() {
  await auth.signOut();
}

function isAdmin() {
  return currentUserData?.role === 'Admin';
}

async function getAuthHeaders() {
  const token = await currentUser?.getIdToken();
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

function showToast(message, type = 'success') {
  const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' };
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 ${colors[type] || 'bg-gray-700'} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showLoading(show = true) {
  let loader = document.getElementById('global-loader');
  if (show) {
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'global-loader';
      loader.innerHTML = '<div class="loading-spinner"></div>';
      loader.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50';
      document.body.appendChild(loader);
    }
  } else {
    if (loader) loader.remove();
  }
}

function showModal(modalId) { document.getElementById(modalId)?.classList.remove('hidden'); }
function hideModal(modalId) { document.getElementById(modalId)?.classList.add('hidden'); }

function createActionButtons(editFn, deleteFn, viewFn) {
  const viewBtn = viewFn ? `<button onclick="${viewFn}" class="text-green-600 hover:text-green-800 mr-2" title="Ver">
    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
    </svg>
  </button>` : '';
  return `${viewBtn}
    <button onclick="${editFn}" class="text-blue-600 hover:text-blue-800 mr-2" title="Editar">
      <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
      </svg>
    </button>
    <button onclick="${deleteFn}" class="text-red-600 hover:text-red-800" title="Eliminar">
      <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
    </button>`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
});
