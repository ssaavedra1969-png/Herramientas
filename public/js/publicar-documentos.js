const DOC_TIPOS_PUBLICAR = ['titulo', 'cedula', 'seguro', 'registro', 'vtv', 'dni'];

function abrirPublicarDocumentos() {
  const modal = document.createElement('div');
  modal.id = 'modal-publicar-docs';
  modal.className = 'fixed inset-0 z-50 hidden modal-backdrop flex items-center justify-center p-3 sm:p-4';
  modal.innerHTML = `
    <div class="bg-[#12151f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
      <div class="flex items-center justify-between p-5 border-b border-white/5">
        <h3 class="text-lg font-bold text-white flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" style="color:#d4af37"/></svg>
          Publicar documentos
        </h3>
        <button type="button" onclick="cerrarPublicarDocs()" class="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
      </div>
      <div class="p-5 space-y-4">
        <p class="text-sm text-[#B0B0D0]">
          Seleccioná la patente del vehículo y los archivos <b>PDF optimizados</b> que querés subir a la
          carpeta <code class="text-[#d4af37]">PATENTE/</code> en producción. Cada archivo se identifica por su
          tipo (titulo, cedula, seguro, registro, vtv, dni) según el nombre del PDF.
        </p>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-[#8b9bb4] mb-1.5">Patente</label>
          <input id="pub-patente" type="text" maxlength="10" placeholder="Ej: AB123CD"
            class="w-full px-3.5 py-2.5 rounded-lg bg-[#0a0e17]/70 border border-white/10 text-white text-sm focus:border-[#d4af37]/50 focus:outline-none uppercase" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-[#8b9bb4] mb-1.5">Archivos PDF</label>
          <input id="pub-files" type="file" accept=".pdf,application/pdf" multiple
            class="block w-full text-sm text-gray-300 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-[#d4af37]/20 file:text-[#d4af37] file:font-semibold file:cursor-pointer" />
          <ul id="pub-lista" class="mt-3 space-y-1.5"></ul>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="cerrarPublicarDocs()" class="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition">Cancelar</button>
          <button type="button" onclick="ejecutarPublicarDocs()" class="px-4 py-2 rounded-lg text-sm font-semibold text-black transition hover:opacity-90" style="background:linear-gradient(135deg,#d4af37,#d4af37)">Publicar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('pub-files').addEventListener('change', actualizarListaDocs);
  modal.classList.remove('hidden');
}

function cerrarPublicarDocs() {
  const m = document.getElementById('modal-publicar-docs');
  if (m) m.remove();
}

function actualizarListaDocs() {
  const input = document.getElementById('pub-files');
  const ul = document.getElementById('pub-lista');
  ul.innerHTML = '';
  if (!input.files.length) return;
  Array.from(input.files).forEach((f, i) => {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between text-sm bg-[#0a0e17]/60 border border-white/5 rounded-lg px-3 py-2';
    li.innerHTML = `
      <span class="text-gray-200 truncate">${f.name}</span>
      <span class="text-xs px-2 py-0.5 rounded-full ${tipoValidoDeNombre(f.name) ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'} ml-2 flex-shrink-0">${tipoDeNombre(f.name)}</span>
    `;
    ul.appendChild(li);
  });
}

function tipoDeNombre(nombre) {
  const base = (nombre.split('.').slice(0, -1).join('.') || '').toLowerCase().replace(/[^a-z]/g, '');
  if (DOC_TIPOS_PUBLICAR.includes(base)) return base;
  const localizados = {
    'titulo': 'titulo', 'cedula': 'cedula', 'seguro': 'seguro', 'registro': 'registro', 'vtv': 'vtv', 'dni': 'dni',
    'verificacion': 'vtv', 'poliza': 'seguro'
  };
  if (localizados[base]) return localizados[base];
  for (const t of DOC_TIPOS_PUBLICAR) if (base.includes(t)) return t;
  return 'desconocido';
}

function tipoValidoDeNombre(nombre) {
  return DOC_TIPOS_PUBLICAR.includes(tipoDeNombre(nombre));
}

function leerArchivoBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function ejecutarPublicarDocs() {
  const patente = (document.getElementById('pub-patente').value || '').trim().toUpperCase();
  const input = document.getElementById('pub-files');
  const files = input.files;

  if (!patente) { showToast('Ingresá la patente', 'error'); return; }
  if (!files.length) { showToast('Seleccioná al menos un archivo PDF', 'error'); return; }

  const invalidos = Array.from(files).filter(f => !tipoValidoDeNombre(f.name));
  if (invalidos.length) {
    showToast(`Nombre de archivo no válido: ${invalidos.map(f => f.name).join(', ')}`, 'error');
    return;
  }

  showLoading(true);
  try {
    const archivos = [];
    for (const f of files) {
      const base64 = await leerArchivoBase64(f);
      archivos.push({ patente, tipo: tipoDeNombre(f.name), base64 });
    }
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/vehicles/documentos/publicar-github', {
      method: 'POST',
      headers,
      body: JSON.stringify({ archivos })
    });
    const data = await resp.json();
    if (!resp.ok) {
      showToast(data.error || 'Error al publicar', 'error');
      return;
    }
    const ok = data.publicados || [];
    const errs = data.errores || [];
    let msg = `${ok.length} publicado(s) OK`;
    if (errs.length) msg += ` · ${errs.length} con error`;
    showToast(msg, errs.length ? 'warning' : 'success');
    if (errs.length) {
      errs.forEach(e => showToast(`${e.patente || ''} ${e.tipo}: ${e.error}`, 'error'));
    }
    cerrarPublicarDocs();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}
