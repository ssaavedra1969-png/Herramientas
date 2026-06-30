let html5QrCode = null;

function startScanner() {
  const reader = document.getElementById('reader');
  const loading = document.getElementById('scanner-loading');
  const btnStart = document.getElementById('btn-start-scanner');
  const btnStop = document.getElementById('btn-stop-scanner');

  if (!reader) return;

  loading.classList.remove('hidden');
  btnStart.classList.add('hidden');

  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
    }).catch(() => {});
  }

  html5QrCode = new Html5Qrcode("reader");

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0
  };

  html5QrCode.start(
    { facingMode: "environment" },
    config,
    onScanSuccess,
    onScanFailure
  ).then(() => {
    loading.classList.add('hidden');
    btnStop.classList.remove('hidden');
  }).catch((err) => {
    loading.innerHTML = `
      <div class="text-center p-4">
        <svg class="w-10 h-10 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
        <p class="text-red-400">Error al acceder a la cámara</p>
        <p class="text-[#5C6378] text-xs mt-1">${err.message || 'Permiso denegado o cámara no disponible'}</p>
        <button onclick="startScanner()" class="mt-3 btn-primary text-sm px-4 py-2">Reintentar</button>
      </div>`;
    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
  });
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
    }).catch(() => {});
  }
  document.getElementById('btn-start-scanner').classList.remove('hidden');
  document.getElementById('btn-stop-scanner').classList.add('hidden');
  document.getElementById('scanner-loading').classList.add('hidden');
  document.getElementById('scanner-loading').innerHTML = `
    <div class="text-center">
      <svg class="w-8 h-8 animate-spin mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
      Iniciando cámara...
    </div>`;
}

function onScanSuccess(decodedText, decodedResult) {
  const resultDiv = document.getElementById('scan-result');
  resultDiv.classList.remove('hidden');

  const match = decodedText.match(/\/vehicle\/([a-zA-Z0-9_-]+)/);
  const vehicleId = match ? match[1] : decodedText.trim();

  showToast('Código detectado: ' + vehicleId, 'info');
  resultDiv.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm text-[#8E94A8]">Código: <span class="text-[#F1F3F8] font-mono">${decodedText}</span></p>
        <p class="text-sm text-[#8E94A8] mt-1">ID detectado: <span class="text-[#00D4FF] font-medium">${vehicleId}</span></p>
      </div>
      <button onclick="goToVehicle('${vehicleId}')" class="btn-primary text-sm px-4 py-2">
        Ver Vehículo
      </button>
    </div>
    <div id="scanned-info" class="mt-3 text-sm text-[#8E94A8]">Cargando datos del vehículo...</div>
  `;

  lookupVehicle(vehicleId);

  setTimeout(() => {
    stopScanner();
  }, 3000);
}

function onScanFailure(err) {
  // silent - scanning continues
}

async function lookupVehicle(id) {
  const infoDiv = document.getElementById('scanned-info');
  if (!infoDiv) return;

  try {
    let doc;
    if (id.length >= 20 && id.includes('/')) {
      // it might be a URL, extract the ID
      const match = id.match(/\/([a-zA-Z0-9_-]+)$/);
      if (match) id = match[1];
    }

    doc = await db.collection('vehicles').doc(id).get();

    if (!doc.exists) {
      const snapshot = await db.collection('vehicles')
        .where('patente', '==', id.toUpperCase())
        .get();
      if (!snapshot.empty) {
        doc = snapshot.docs[0];
      } else {
        const snapshot2 = await db.collection('vehicles')
          .where('interno', '==', id.toUpperCase())
          .get();
        if (!snapshot2.empty) {
          doc = snapshot2.docs[0];
        }
      }
    }

    if (!doc || !doc.exists) {
      infoDiv.innerHTML = `<p class="text-red-400">Vehículo no encontrado</p>`;
      return;
    }

    const v = doc.data();
    infoDiv.innerHTML = `
      <div class="glass-card rounded-lg p-3 mt-2">
        <div class="grid grid-cols-2 gap-2 text-sm">
          <span class="text-[#8E94A8]">Patente:</span>
          <span class="text-[#F1F3F8] font-medium">${v.patente || '-'}</span>
          <span class="text-[#8E94A8]">Interno:</span>
          <span class="text-[#F1F3F8]">${v.interno || '-'}</span>
          <span class="text-[#8E94A8]">Marca:</span>
          <span class="text-[#F1F3F8]">${v.marca || '-'}</span>
          <span class="text-[#8E94A8]">Modelo:</span>
          <span class="text-[#F1F3F8]">${v.modelo || '-'}</span>
          <span class="text-[#8E94A8]">Tipo:</span>
          <span class="text-[#F1F3F8]">${v.tipo || '-'}</span>
        </div>
        <div class="mt-2 flex gap-2">
          <a href="/vehicle/${doc.id}" class="btn-primary text-xs px-3 py-1.5">Ver detalle completo →</a>
        </div>
      </div>
    `;
  } catch (err) {
    infoDiv.innerHTML = `<p class="text-red-400">Error: ${err.message}</p>`;
  }
}

function goToVehicle(id) {
  window.location.href = `/vehicle/${id}`;
}

function lookupManual() {
  const id = document.getElementById('manual-id').value.trim();
  if (!id) {
    showToast('Ingresá un ID o patente', 'error');
    return;
  }
  const result = document.getElementById('manual-result');
  result.innerHTML = '<p class="text-[#8E94A8]">Buscando...</p>';
  lookupVehicle(id);
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
});

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}
