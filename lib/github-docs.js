const path = require('path');

const GITHUB_API = 'https://api.github.com/repos';
const REPO = process.env.GITHUB_REPO || 'ssaavedra1969-png/Herramientas';
const TOKEN = process.env.GITHUB_TOKEN || '';
const TIPOS = ['titulo', 'cedula', 'seguro', 'registro', 'vtv', 'dni'];
const EXT_PRIORIDAD = ['pdf', 'jpg', 'jpeg', 'png'];

function carpetaDe(patente) {
  return `PATENTE/${String(patente).toUpperCase()}`;
}

function validarRuta(ruta) {
  const limpia = String(ruta || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!/^PATENTE\//i.test(limpia) || /(^|\/)\.\.(\/|$)/.test(limpia)) {
    throw new Error('Ruta de documento inválida');
  }
  return limpia;
}

function carpetaEmpleado(id) {
  const limpio = String(id || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!limpio) throw new Error('ID de empleado inválido');
  return `PATENTE/EMPLEADOS/${limpio}`;
}

function rutaDocumentoEmpleado(id, tipo) {
  return `${carpetaEmpleado(id)}/${String(tipo || '').toLowerCase()}.pdf`;
}

async function ghRequest(ruta, opts = {}) {
  if (!TOKEN) {
    const err = new Error('GITHUB_TOKEN no está configurado en el servidor.');
    err.code = 'NO_TOKEN';
    throw err;
  }
  const resp = await fetch(`${GITHUB_API}/${REPO}/contents/${ruta}`, {
    ...opts,
    headers: {
      'Authorization': `token ${TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'falpat-herramientas',
      ...(opts.headers || {})
    }
  });
  return resp;
}

async function listarDirectorio(ruta) {
  const resp = await ghRequest(ruta);
  if (resp.status === 404) return [];
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`GitHub listar ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (!Array.isArray(data)) return [];
  return data.map(a => ({ nombre: a.name, path: a.path, sha: a.sha, size: a.size }));
}

async function listarCarpeta(patente) {
  return listarDirectorio(carpetaDe(patente));
}

function esDeTipo(nombre, tipo) {
  const base = path.parse(nombre).name.toLowerCase();
  const ext = path.parse(nombre).ext.toLowerCase().replace('.', '');
  if (!EXT_PRIORIDAD.includes(ext)) return false;
  return base === tipo || (base.startsWith(tipo) && /^\d*$/.test(base.slice(tipo.length)));
}

/* Un solo request para TODA la carpeta PATENTE/.
   El reporte de documentación necesita los 54 camiones, y pedirle a la API la
   carpeta de cada uno son 54 requests por cache miss. GitHub trunca el árbol a
   ~100k archivos / 7 MB; si pasa eso devuelve null y el caller cae al modo de
   a uno (listarCarpeta), que es el comportamiento de siempre. */
async function listarPatenteGlobal() {
  const resp = await ghApi('git/trees/main?recursive=1');
  if (!resp || !resp.ok) return null;
  let data;
  try { data = await resp.json(); } catch (e) { return null; }
  if (!data || data.truncated) return null;
  const porPatente = new Map();
  (data.tree || []).forEach(n => {
    if (!n || n.type !== 'blob') return;
    const m = /^PATENTE\/([A-Z0-9]+)\//i.exec(n.path || '');
    if (!m) return;
    if (m[1].toUpperCase() === 'EMPLEADOS') return;
    const patente = m[1].toUpperCase();
    if (!porPatente.has(patente)) porPatente.set(patente, []);
    porPatente.get(patente).push(n.path.split('/').pop());
  });
  return porPatente;
}

async function listarEmpleadosGlobal() {
  const resp = await ghApi('git/trees/main?recursive=1');
  if (!resp || !resp.ok) return null;
  let data;
  try { data = await resp.json(); } catch (e) { return null; }
  if (!data || data.truncated) return null;
  const porEmpleado = new Map();
  (data.tree || []).forEach(n => {
    if (!n || n.type !== 'blob') return;
    const m = /^PATENTE\/EMPLEADOS\/([^/]+)\/([^/]+)$/i.exec(n.path || '');
    if (!m) return;
    const id = m[1];
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return;
    if (!porEmpleado.has(id)) porEmpleado.set(id, []);
    porEmpleado.get(id).push(n.path.split('/').pop());
  });
  return porEmpleado;
}

function mejorNombre(archivos, tipo) {
  const candidatos = archivos.filter(a => esDeTipo(a.nombre, tipo));
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => {
    const ea = path.parse(a.nombre).ext.toLowerCase();
    const eb = path.parse(b.nombre).ext.toLowerCase();
    const ia = EXT_PRIORIDAD.indexOf(ea.replace('.', ''));
    const ib = EXT_PRIORIDAD.indexOf(eb.replace('.', ''));
    if (ia !== ib) return ia - ib;
    return a.nombre.length - b.nombre.length;
  });
  return candidatos[0];
}

async function subirArchivo(patente, tipo, base64) {
  const carpeta = carpetaDe(patente);
  const ruta = `${carpeta}/${tipo}.pdf`;
  const limpiados = [];
  const archivos = await listarCarpeta(patente);
  for (const a of archivos) {
    if (a.nombre === `${tipo}.pdf`) continue;
    if (esDeTipo(a.nombre, tipo)) {
      try {
        const del = await ghRequest(`${carpeta}/${a.nombre}`, {
          method: 'DELETE',
          body: JSON.stringify({
            message: `Docs: limpiar ${patente} ${a.nombre}`,
            sha: a.sha,
            committer: { name: 'Falpat App', email: 'app@falpat.local' }
          })
        });
        if (del.ok) limpiados.push(a.nombre);
      } catch (e) { /* no bloquea el upload */ }
    }
  }
  const resp = await ghRequest(ruta, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Docs: ${patente} ${tipo}`,
      content: base64,
      committer: { name: 'Falpat App', email: 'app@falpat.local' }
    })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`GitHub subir ${resp.status}: ${t.slice(0, 200)}`);
  }
  return { ok: true, limpiados };
}

async function borrarTipo(patente, tipo) {
  const carpeta = carpetaDe(patente);
  const archivos = await listarCarpeta(patente);
  const borrados = [];
  for (const a of archivos) {
    if (esDeTipo(a.nombre, tipo)) {
      try {
        const del = await ghRequest(`${carpeta}/${a.nombre}`, {
          method: 'DELETE',
          body: JSON.stringify({
            message: `Docs: borrar ${patente} ${a.nombre}`,
            sha: a.sha,
            committer: { name: 'Falpat App', email: 'app@falpat.local' }
          })
        });
        if (del.ok) borrados.push(a.nombre);
      } catch (e) { /* ignora */ }
    }
  }
  return borrados;
}

async function leerRuta(ruta, opciones = {}) {
  const limpia = validarRuta(ruta);
  const partes = limpia.split('/');
  const nombre = partes.pop();
  const carpeta = partes.join('/');
  const archivos = await listarDirectorio(carpeta);
  const mejor = opciones.tipo
    ? mejorNombre(archivos, String(opciones.tipo).toLowerCase())
    : archivos.find(a => a.nombre === nombre) || null;
  if (!mejor) return null;
  const resp = await ghRequest(`${carpeta}/${encodeURIComponent(mejor.nombre)}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  return {
    nombre: mejor.nombre,
    path: mejor.path || `${carpeta}/${mejor.nombre}`,
    sha: mejor.sha,
    encoding: data.encoding,
    content: data.content,
    download_url: data.download_url,
    size: mejor.size == null ? data.size : mejor.size
  };
}

async function escribirRuta(ruta, base64, mensaje) {
  const limpia = validarRuta(ruta);
  const resp = await ghRequest(limpia, {
    method: 'PUT',
    body: JSON.stringify({
      message: mensaje || `Docs: ${limpia}`,
      content: base64,
      committer: { name: 'Falpat App', email: 'app@falpat.local' }
    })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`GitHub subir ${resp.status}: ${t.slice(0, 200)}`);
  }
  return { ok: true, path: limpia };
}

async function borrarRuta(ruta, sha, mensaje) {
  const limpia = validarRuta(ruta);
  let firma = sha;
  if (!firma) {
    const partes = limpia.split('/');
    const nombre = partes.pop();
    const archivos = await listarDirectorio(partes.join('/'));
    const encontrado = archivos.find(a => a.nombre === nombre);
    if (!encontrado) return { ok: true, borrado: false };
    firma = encontrado.sha;
  }
  const resp = await ghRequest(limpia, {
    method: 'DELETE',
    body: JSON.stringify({
      message: mensaje || `Docs: borrar ${limpia}`,
      sha: firma,
      committer: { name: 'Falpat App', email: 'app@falpat.local' }
    })
  });
  if (resp.status === 404) return { ok: true, borrado: false };
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`GitHub borrar ${resp.status}: ${t.slice(0, 200)}`);
  }
  return { ok: true, borrado: true };
}

async function moverRuta(origen, destino, opciones = {}) {
  const rutaOrigen = validarRuta(origen);
  const rutaDestino = validarRuta(destino);
  if (rutaOrigen.toLowerCase() === rutaDestino.toLowerCase()) {
    throw new Error('El origen y el destino son el mismo archivo');
  }
  const leido = await leerRuta(rutaOrigen, { tipo: opciones.tipoOrigen });
  if (!leido) throw new Error(`No se encontró el archivo de origen: ${rutaOrigen}`);
  let base64 = leido.content;
  if (!base64 || !base64.length) {
    if (!leido.download_url) throw new Error('El archivo de origen no tiene contenido');
    const raw = await fetch(leido.download_url);
    if (!raw.ok) throw new Error(`No se pudo descargar el origen (${raw.status})`);
    base64 = Buffer.from(await raw.arrayBuffer()).toString('base64');
  }
  await escribirRuta(rutaDestino, base64, opciones.mensaje || `Docs: mover ${leido.nombre}`);
  const tipoDestino = Object.prototype.hasOwnProperty.call(opciones, 'tipoDestino') ? opciones.tipoDestino : opciones.tipoOrigen;
  const verificado = await leerRuta(rutaDestino, { tipo: tipoDestino });
  if (!verificado) throw new Error('No se pudo verificar el destino; el origen NO fue borrado');
  const iguales = !!verificado.content && verificado.content.replace(/\s/g, '') === String(base64).replace(/\s/g, '');
  const mismoTamano = leido.size == null || verificado.size == null || Number(leido.size) === Number(verificado.size);
  if (!iguales && !mismoTamano) throw new Error('El destino no coincide con el origen; el origen NO fue borrado');
  const borrado = await borrarRuta(rutaOrigen, leido.sha, opciones.mensajeBorrado || `Docs: quitar ${leido.nombre} del origen`);
  return { ok: true, origen: rutaOrigen, destino: rutaDestino, nombre: leido.nombre, size: leido.size, borrado: borrado.borrado };
}

async function leerArchivo(patente, tipo) {
  const leido = await leerRuta(`${carpetaDe(patente)}/${String(tipo).toLowerCase()}.pdf`, { tipo });
  if (!leido) return null;
  if (leido.content && leido.content.length > 0) {
    return { nombre: leido.nombre, encoding: leido.encoding, content: leido.content, size: leido.size };
  }
  if (leido.download_url) {
    return { nombre: leido.nombre, download_url: leido.download_url, size: leido.size };
  }
  return null;
}

async function ghApi(camino, opts = {}) {
  if (!TOKEN) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(`${GITHUB_API}/${REPO}/${camino}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'falpat-herramientas',
        ...(opts.headers || {})
      }
    });
    return resp;
  } catch (e) {
    console.error('[ghApi] Error accediendo a GitHub:', e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const RE_CARPETA_DOC = /^PATENTE\/([A-Z0-9]+)\/(titulo|cedula|seguro|registro|vtv|dni)\.(pdf|jpg|jpeg|png)$/i;

async function cambiosDesde(fechaISO, opciones = {}) {
  const cambios = {};
  const estricto = opciones.estricto === true;
  if (!TOKEN) {
    if (estricto) throw new Error('GITHUB_TOKEN no está configurado para revisar PATENTE/.');
    return cambios;
  }

  try {
    const agregar = (c) => {
      const files = c.files || [];
      for (const f of files) {
        const m = RE_CARPETA_DOC.exec(f.filename || '');
        if (m) {
          const patente = m[1].toUpperCase();
          if (patente === 'EMPLEADOS') return;
          const tipo = m[2].toLowerCase();
          (cambios[patente] = cambios[patente] || new Set()).add(tipo);
        }
      }
    };

    const listResp = await ghApi(`commits?path=PATENTE&since=${encodeURIComponent(fechaISO)}&per_page=100`);
    if (!listResp || !listResp.ok) {
      if (estricto) throw new Error('GitHub no permitió consultar los cambios de PATENTE/.');
      return cambios;
    }
    const list = await listResp.json();
    if (!Array.isArray(list)) {
      if (estricto) throw new Error('GitHub devolvió una respuesta inválida al consultar PATENTE/.');
      return cambios;
    }
    if (estricto && list.length > 25) {
      throw new Error('Hay más de 25 commits de PATENTE/ desde el último envío. Enviá las novedades con mayor frecuencia para no omitir cambios.');
    }

    for (const c of list.slice(0, 25)) {
      if (Array.isArray(c.files) && c.files.length > 0) {
        agregar(c);
        continue;
      }
      const det = await ghApi(`commits/${c.sha}`);
      if (det && det.ok) {
        agregar(await det.json());
      } else if (estricto) {
        throw new Error('GitHub no permitió leer el detalle de un commit de PATENTE/.');
      }
    }
  } catch (e) {
    console.error('[cambiosDesde] Error:', e.message);
    if (estricto) throw e;
  }

  return cambios;
}

module.exports = {
  listarCarpeta,
  listarDirectorio,
  listarPatenteGlobal,
  listarEmpleadosGlobal,
  subirArchivo,
  borrarTipo,
  leerArchivo,
  leerRuta,
  escribirRuta,
  borrarRuta,
  moverRuta,
  carpetaEmpleado,
  rutaDocumentoEmpleado,
  mejorNombre,
  esDeTipo,
  cambiosDesde,
  ghApi,
  TIPOS,
  EXT_PRIORIDAD,
  getToken: () => TOKEN
};
