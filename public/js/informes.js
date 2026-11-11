let informesCfg = { destinatarios: [], asunto: '', cuerpo: '', dias: 90, activo: true };

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  bindEventos();
  cargarConfig();
});

function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}

function bindEventos() {
  document.getElementById('btn-agregar')?.addEventListener('click', agregarDestinatario);
  document.getElementById('nuevo-email')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); agregarDestinatario(); }
  });
  document.getElementById('btn-guardar')?.addEventListener('click', guardar);
  document.getElementById('btn-enviar')?.addEventListener('click', enviar);
  document.getElementById('btn-pdf')?.addEventListener('click', descargarPDF);
  document.getElementById('btn-vista')?.addEventListener('click', vistaPrevia);

  if (window.__DEV_READ_ONLY) {
    ['btn-guardar', 'btn-enviar', 'btn-agregar'].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.disabled = true;
    });
  }
}

function estado(msg, error) {
  const el = document.getElementById('estado');
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'mt-4 text-sm ' + (error ? 'text-red-400' : 'text-[#8b9bb4]');
}

function emailValido(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function renderDestinatarios() {
  const cont = document.getElementById('destinatarios');
  if (!cont) return;
  if (!informesCfg.destinatarios.length) {
    cont.innerHTML = '<span class="text-sm text-[#4a5568]">Sin destinatarios. Agregá al menos uno.</span>';
    return;
  }
  cont.innerHTML = informesCfg.destinatarios.map((email, i) => `
    <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-[#2563EB]/15 text-[#ffffff] border border-[#2563EB]/25">
      ${email}
      <button type="button" onclick="quitarDestinatario(${i})" class="text-[#8b9bb4] hover:text-red-400" title="Quitar" ${window.__DEV_READ_ONLY ? 'disabled' : ''}>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </span>`).join('');
}

function quitarDestinatario(i) {
  informesCfg.destinatarios.splice(i, 1);
  renderDestinatarios();
}

function agregarDestinatario() {
  const input = document.getElementById('nuevo-email');
  const email = String(input?.value || '').trim();
  if (!emailValido(email)) {
    showToast('Email inválido', 'error');
    return;
  }
  const existe = informesCfg.destinatarios.some((e) => e.toLowerCase() === email.toLowerCase());
  if (existe) {
    showToast('Ese email ya está en la lista', 'error');
    return;
  }
  if (informesCfg.destinatarios.length >= 20) {
    showToast('Máximo 20 destinatarios', 'error');
    return;
  }
  informesCfg.destinatarios.push(email);
  input.value = '';
  renderDestinatarios();
}

function leerFormulario() {
  return {
    destinatarios: informesCfg.destinatarios.slice(),
    asunto: document.getElementById('asunto')?.value || '',
    cuerpo: document.getElementById('cuerpo')?.value || '',
    dias: parseInt(document.getElementById('dias')?.value, 10) || 90,
    activo: !!document.getElementById('activo')?.checked
  };
}

function pintarFormulario(cfg) {
  document.getElementById('asunto').value = cfg.asunto || '';
  document.getElementById('cuerpo').value = cfg.cuerpo || '';
  document.getElementById('dias').value = cfg.dias || 90;
  document.getElementById('activo').checked = cfg.activo !== false;
  renderDestinatarios();
}

async function cargarConfig() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/informes/config', { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo cargar la configuración');
    informesCfg = data.config;
    pintarFormulario(informesCfg);
    estado('');
  } catch (e) {
    estado('Error al cargar: ' + e.message, true);
  }
}

async function guardar() {
  const payload = leerFormulario();
  if (!payload.destinatarios.length) {
    showToast('Agregá al menos un destinatario', 'error');
    return;
  }
  const btn = document.getElementById('btn-guardar');
  btn.disabled = true;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/informes/config', {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al guardar');
    informesCfg = data.config;
    pintarFormulario(informesCfg);
    showToast('Configuración guardada');
    estado('Guardado ' + new Date().toLocaleString('es-AR'));
  } catch (e) {
    showToast('Error al guardar: ' + e.message, 'error');
    estado('Error al guardar: ' + e.message, true);
  } finally {
    btn.disabled = !!window.__DEV_READ_ONLY;
  }
}

async function enviar() {
  const payload = leerFormulario();
  if (!payload.destinatarios.length) {
    showToast('Agregá al menos un destinatario', 'error');
    return;
  }
  const confirm = await Swal.fire({
    title: '¿Enviar el informe ahora?',
    html: `<div class="text-left text-sm">Se enviará a:<br><b>${payload.destinatarios.join('<br>')}</b><br><br>Ventana: ${payload.dias} días</div>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Enviar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#2563EB',
    cancelButtonColor: '#6B7280'
  });
  if (!confirm.isConfirmed) return;

  const btn = document.getElementById('btn-enviar');
  btn.disabled = true;
  estado('Generando y enviando...');
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/informes/enviar', {
      method: 'POST',
      headers,
      body: JSON.stringify({ dias: payload.dias })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al enviar');
    estado(`Enviado por ${data.mail.via} a ${data.mail.destinatarios.join(', ')} — ${data.stats.total} vencimientos`);
    showToast('Informe enviado');
  } catch (e) {
    estado('Error al enviar: ' + e.message, true);
    showToast('Error al enviar: ' + e.message, 'error');
  } finally {
    btn.disabled = !!window.__DEV_READ_ONLY;
  }
}

async function descargarPDF() {
  const dias = parseInt(document.getElementById('dias')?.value, 10) || 90;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/report/vencimientos/semanal/pdf?dias=${dias}`, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo generar el PDF');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VENCIMIENTOS_SEMANAL_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) {
    showToast('Error al descargar: ' + e.message, 'error');
  }
}

async function vistaPrevia() {
  const dias = parseInt(document.getElementById('dias')?.value, 10) || 90;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/informes/vista-previa?dias=${dias}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo generar la vista previa');
    Swal.fire({
      title: 'Vista previa',
      html: `<div class="text-left text-sm">
        <p class="font-semibold mb-1">Asunto</p>
        <p class="mb-3">${escapeHtml(data.asunto)}</p>
        <p class="font-semibold mb-1">Cuerpo</p>
        <pre class="whitespace-pre-wrap font-mono text-xs">${escapeHtml(data.cuerpo)}</pre>
        <p class="mt-3 text-xs opacity-70">${data.stats.total} vencimientos en ${data.dias} días</p>
      </div>`,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#2563EB'
    });
  } catch (e) {
    showToast('Error en vista previa: ' + e.message, 'error');
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
