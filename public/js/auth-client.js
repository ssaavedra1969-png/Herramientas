const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let currentUserData = null;

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

// Process redirect result via Firebase SDK
async function handleRedirectResult() {
  try {
    const result = await auth.getRedirectResult();
    if (result && result.user) {
      console.log('getRedirectResult success:', result.user.uid, result.user.email);
      await completeSignIn(result.user);
      return true;
    }
    console.log('getRedirectResult: no user');
    return false;
  } catch (e) {
    console.error('getRedirectResult error:', e.code || e.message, e);
    return false;
  }
}

// Process Google OAuth redirect result from URL hash (fallback manual)
async function processGoogleRedirect() {
  const hash = window.location.hash;
  if (!hash || hash.length < 5) return false;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const idToken = params.get('id_token');

  if (!accessToken && !idToken) return false;

  try {
    const credential = firebase.auth.GoogleAuthProvider.credential(idToken || null, accessToken || null);
    const result = await auth.signInWithCredential(credential);
    console.log('signInWithCredential success:', result.user.uid, result.user.email);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    await completeSignIn(result.user);
    return true;
  } catch (e) {
    console.error('Google redirect processing error:', e.code || e.message, e);
    return false;
  }
}

// Try all redirect/fallback methods on init
async function initAuthResult() {
  const processed = await handleRedirectResult();
  if (!processed) {
    await processGoogleRedirect();
  }
}

auth.onAuthStateChanged(async (user) => {
  console.log('onAuthStateChanged:', user ? 'user:' + user.uid : 'null', 'loginPage:', window.location.pathname);
  currentUser = user;
  const loginPage = window.location.pathname === '/login' || window.location.pathname === '/';

  if (user) {
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

// Google login using Firebase signInWithPopup, fallback to redirect
async function loginGoogle() {
  clearSession();
  const googleProvider = new firebase.auth.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await auth.signInWithPopup(googleProvider);
    console.log('signInWithPopup success:', result.user.uid);
    return result;
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
      console.log('Popup blocked/closed, falling back to redirect');
      try {
        await auth.signInWithRedirect(googleProvider);
      } catch (redirectErr) {
        console.error('Redirect error:', redirectErr.code, redirectErr.message);
        const fn = typeof showLoginError === 'function' ? showLoginError : (typeof showToast === 'function' ? showToast : alert);
        fn('Error al iniciar sesión con Google: ' + (friendlyError(redirectErr) || redirectErr.message), 'error');
        throw redirectErr;
      }
    } else {
      console.error('Google signInWithPopup error:', e.code, e.message);
      const fn = typeof showLoginError === 'function' ? showLoginError : (typeof showToast === 'function' ? showToast : alert);
      fn('Error al iniciar sesión con Google: ' + (friendlyError(e) || e.message), 'error');
      throw e;
    }
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
  const viewBtn = viewFn ? `<button onclick="${viewFn}" class="text-green-500 hover:text-green-400 mr-2 transition-colors" title="Ver">
    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
    </svg>
  </button>` : '';
  return `${viewBtn}
    <button onclick="${editFn}" class="text-blue-500 hover:text-blue-400 mr-2 transition-colors" title="Editar">
      <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
      </svg>
    </button>
    <button onclick="${deleteFn}" class="text-red-500 hover:text-red-400 transition-colors" title="Eliminar">
      <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
    </button>`;
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
