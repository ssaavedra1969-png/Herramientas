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
        <p class="text-[#4a5568] text-xs mt-1">${err.message || 'Permiso denegado o cámara no disponible'}</p>
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
        <p class="text-sm text-[#8b9bb4]">Código: <span class="text-[#ffffff] font-mono">${decodedText}</span></p>
        <p class="text-sm text-[#8b9bb4] mt-1">ID detectado: <span class="text-[#2563EB] font-medium">${vehicleId}</span></p>
      </div>
      <button onclick="goToVehicle('${vehicleId}')" class="btn-primary text-sm px-4 py-2">
        Ver Vehículo
      </button>
    </div>
    <div id="scanned-info" class="mt-3 text-sm text-[#8b9bb4]">Cargando datos del vehículo...</div>
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
          <span class="text-[#8b9bb4]">Patente:</span>
          <span class="text-[#ffffff] font-medium">${v.patente || '-'}</span>
          <span class="text-[#8b9bb4]">Interno:</span>
          <span class="text-[#ffffff]">${v.interno || '-'}</span>
          <span class="text-[#8b9bb4]">Marca:</span>
          <span class="text-[#ffffff]">${v.marca || '-'}</span>
          <span class="text-[#8b9bb4]">Modelo:</span>
          <span class="text-[#ffffff]">${v.modelo || '-'}</span>
          <span class="text-[#8b9bb4]">Tipo:</span>
          <span class="text-[#ffffff]">${v.tipo || '-'}</span>
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
  result.innerHTML = '<p class="text-[#8b9bb4]">Buscando...</p>';
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

function ocrOpenCamera() {
  document.getElementById('ocr-camera-input')?.click();
}

function ocrHandleFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const preview = document.getElementById('ocr-preview');
  const previewContainer = document.getElementById('ocr-preview-container');
  const status = document.getElementById('ocr-status');
  const result = document.getElementById('ocr-result');

  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    previewContainer.classList.remove('hidden');
    result.classList.add('hidden');
    ocrProcessImage(e.target.result);
  };
  reader.readAsDataURL(file);
}

async function ocrProcessImage(imageData) {
  const status = document.getElementById('ocr-status');
  const statusText = document.getElementById('ocr-status-text');
  const progressFill = document.getElementById('ocr-progress-fill');
  const result = document.getElementById('ocr-result');

  status.classList.remove('hidden');
  result.classList.add('hidden');
  statusText.textContent = 'Cargando motor OCR...';
  progressFill.style.width = '10%';

  try {
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          progressFill.style.width = pct + '%';
          statusText.textContent = 'Reconociendo texto... ' + pct + '%';
        }
      }
    });

    statusText.textContent = 'Analizando imagen...';
    progressFill.style.width = '30%';

    const { data } = await worker.recognize(imageData);
    await worker.terminate();

    progressFill.style.width = '100%';
    statusText.textContent = 'Procesamiento completo';

    const rawText = data.text.replace(/\s+/g, ' ').trim();
    console.log('[OCR] Texto completo:', rawText);

    const candidates = ocrExtractPlates(rawText);
    console.log('[OCR] Candidatos:', candidates);

    if (candidates.length > 0) {
      ocrShowCandidates(candidates, rawText);
    } else {
      result.classList.remove('hidden');
      result.innerHTML = `
        <div class="text-center">
          <svg class="w-10 h-10 text-yellow-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
          <p class="text-yellow-400 font-medium">No se detectó patente</p>
          <p class="text-[#4a5568] text-xs mt-1">Texto leído: "${rawText}"</p>
          <div class="mt-3">
            <label class="text-xs text-[#8b9bb4]">Ingresá la patente manualmente:</label>
            <div class="flex gap-2 mt-1">
              <input type="text" id="ocr-manual-input" placeholder="Ej: AE335KK" class="flex-1 px-3 py-2 bg-[#0a0e17]/50 border border-[#2563EB]/20 rounded-lg text-sm text-[#ffffff] placeholder-[#4a5568] input-neon uppercase" maxlength="7">
              <button onclick="ocrManualSearch()" class="btn-primary text-sm px-4 py-2">Buscar</button>
            </div>
          </div>
        </div>
      `;
    }

    setTimeout(() => { status.classList.add('hidden'); }, 2000);
  } catch (err) {
    console.error('[OCR] Error:', err);
    statusText.textContent = 'Error al procesar';
    progressFill.style.width = '0%';
    result.classList.remove('hidden');
    result.innerHTML = `
      <div class="text-center">
        <p class="text-red-400">Error: ${err.message}</p>
      </div>
    `;
  }
}

function ocrExtractPlates(text) {
  const upper = text.toUpperCase();
  const candidates = [];
  const seen = new Set();

  const raw = upper.replace(/[^A-Z0-9]/g, '');
  const strict = raw.match(/[A-Z]{2}\d{3}[A-Z]{1,2}/g);
  if (strict) strict.forEach(p => { if (!seen.has(p)) { seen.add(p); candidates.push({ plate: p, score: 3 }); }});

  const spaced = upper.match(/[A-Z]{2}\s*\d{3}\s*[A-Z]{1,2}/g);
  if (spaced) spaced.forEach(p => {
    const clean = p.replace(/\s/g, '');
    if (!seen.has(clean)) { seen.add(clean); candidates.push({ plate: clean, score: 2 }); }
  });

  const mixed = upper.match(/[A-Z0-9]{2}\s*\d{3}\s*[A-Z0-9]{1,2}/g);
  if (mixed) mixed.forEach(p => {
    const clean = p.replace(/\s/g, '');
    const letters = clean.replace(/[0-9]/g, '');
    if (letters.length >= 3 && !seen.has(clean)) {
      seen.add(clean);
      candidates.push({ plate: clean, score: 1 });
    }
  });

  const allTokens = raw.match(/[A-Z0-9]{5,7}/g);
  if (allTokens) allTokens.forEach(t => {
    if (!seen.has(t) && t.length >= 5 && t.length <= 7) {
      seen.add(t);
      candidates.push({ plate: t, score: 0 });
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function ocrShowCandidates(candidates, rawText) {
  const result = document.getElementById('ocr-result');
  result.classList.remove('hidden');

  const items = candidates.slice(0, 8).map(c => {
    const label = c.score >= 2 ? 'Alta' : c.score === 1 ? 'Media' : 'Baja';
    const color = c.score >= 2 ? '#00E5FF' : c.score === 1 ? '#F59E0B' : '#8b9bb4';
    return `
      <button onclick="ocrLookupVehicle('${c.plate}')" class="flex items-center justify-between w-full px-3 py-2.5 bg-[#0a0e17]/30 hover:bg-[#2563EB]/10 rounded-lg transition text-left">
        <span class="text-[#ffffff] font-mono font-bold text-lg tracking-wider">${c.plate}</span>
        <span style="color:${color}" class="text-xs font-medium">${label}</span>
      </button>
    `;
  }).join('');

  result.innerHTML = `
    <p class="text-[#8b9bb4] text-xs mb-3">Posibles patentes detectadas (tocá la correcta):</p>
    <div class="space-y-1.5">${items}</div>
    <div class="mt-3 pt-3 border-t border-white/5">
      <label class="text-xs text-[#8b9bb4]">¿No aparece? Ingresala manual:</label>
      <div class="flex gap-2 mt-1">
        <input type="text" id="ocr-manual-input" placeholder="Ej: AE335KK" class="flex-1 px-3 py-2 bg-[#0a0e17]/50 border border-[#2563EB]/20 rounded-lg text-sm text-[#ffffff] placeholder-[#4a5568] input-neon uppercase" maxlength="7">
        <button onclick="ocrManualSearch()" class="btn-primary text-sm px-4 py-2">Buscar</button>
      </div>
    </div>
  `;
}

function ocrManualSearch() {
  const input = document.getElementById('ocr-manual-input');
  const val = (input?.value || '').trim().toUpperCase();
  if (!val) return;
  ocrLookupVehicle(val);
}

async function ocrLookupVehicle(plate) {
  const result = document.getElementById('ocr-result');
  result.classList.remove('hidden');
  result.innerHTML = `<p class="text-[#8b9bb4] text-sm">Buscando "${plate}" en la base...</p>`;

  try {
    const snapshot = await db.collection('vehicles')
      .where('patente', '==', plate.toUpperCase())
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const v = doc.data();
      result.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-[#00E5FF] font-semibold">Patente: ${plate}</p>
            <p class="text-sm text-[#8b9bb4] mt-1">${v.interno || ''} — ${v.marca || ''} ${v.modelo || ''}</p>
            ${v.chofer ? `<p class="text-xs text-[#4a5568] mt-1">Chofer: ${v.chofer}</p>` : ''}
          </div>
          <button onclick="window.location.href='/vehicle/${doc.id}'" class="btn-primary text-sm px-4 py-2">
            Ver Vehículo
          </button>
        </div>
      `;
    } else {
      const snapshot2 = await db.collection('vehicles')
        .where('interno', '==', plate.toUpperCase())
        .get();

      if (!snapshot2.empty) {
        const doc = snapshot2.docs[0];
        const v = doc.data();
        result.innerHTML = `
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-[#00E5FF] font-semibold">Interno: ${plate}</p>
              <p class="text-sm text-[#8b9bb4] mt-1">${v.patente || ''} — ${v.marca || ''} ${v.modelo || ''}</p>
            </div>
            <button onclick="window.location.href='/vehicle/${doc.id}'" class="btn-primary text-sm px-4 py-2">
              Ver Vehículo
            </button>
          </div>
        `;
      } else {
        result.innerHTML = `
          <div class="text-center">
            <svg class="w-10 h-10 text-yellow-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            <p class="text-yellow-400 font-medium">Patente "${plate}" no encontrada en la base</p>
            <div class="mt-3">
              <label class="text-xs text-[#8b9bb4]">Probá con otra patente:</label>
              <div class="flex gap-2 mt-1">
                <input type="text" id="ocr-manual-input" placeholder="Ej: AE335KK" class="flex-1 px-3 py-2 bg-[#0a0e17]/50 border border-[#2563EB]/20 rounded-lg text-sm text-[#ffffff] placeholder-[#4a5568] input-neon uppercase" maxlength="7">
                <button onclick="ocrManualSearch()" class="btn-primary text-sm px-4 py-2">Buscar</button>
              </div>
            </div>
          </div>
        `;
      }
    }
  } catch (err) {
    result.innerHTML = `<p class="text-red-400">Error al buscar: ${err.message}</p>`;
  }
}
