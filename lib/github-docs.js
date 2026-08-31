const path = require('path');

const GITHUB_API = 'https://api.github.com/repos';
const REPO = process.env.GITHUB_REPO || 'ssaavedra1969-png/Herramientas';
const TOKEN = process.env.GITHUB_TOKEN || '';
const TIPOS = ['titulo', 'cedula', 'seguro', 'registro', 'vtv', 'dni'];
const EXT_PRIORIDAD = ['pdf', 'jpg', 'jpeg', 'png'];

function carpetaDe(patente) {
  return `PATENTE/${String(patente).toUpperCase()}`;
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

async function listarCarpeta(patente) {
  const resp = await ghRequest(carpetaDe(patente));
  if (resp.status === 404) return [];
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`GitHub listar ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (!Array.isArray(data)) return [];
  return data.map(a => ({ nombre: a.name, path: a.path, sha: a.sha, size: a.size }));
}

function esDeTipo(nombre, tipo) {
  const base = path.parse(nombre).name.toLowerCase();
  const ext = path.parse(nombre).ext.toLowerCase().replace('.', '');
  if (!EXT_PRIORIDAD.includes(ext)) return false;
  return base === tipo || (base.startsWith(tipo) && /^\d*$/.test(base.slice(tipo.length)));
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

async function leerArchivo(patente, tipo) {
  const carpeta = carpetaDe(patente);
  const archivos = await listarCarpeta(patente);
  const mejor = mejorNombre(archivos, tipo);
  if (!mejor) return null;
  const resp = await ghRequest(`${carpeta}/${mejor.nombre}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  return {
    nombre: mejor.nombre,
    encoding: data.encoding,
    content: data.content,
    size: mejor.size
  };
}

module.exports = {
  listarCarpeta,
  subirArchivo,
  borrarTipo,
  leerArchivo,
  mejorNombre,
  TIPOS,
  EXT_PRIORIDAD,
  getToken: () => TOKEN
};
