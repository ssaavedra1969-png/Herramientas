process.env.GITHUB_TOKEN = 'test-token';

const assert = require('assert');
const gh = require('../lib/github-docs');

let ok = 0;
let fail = 0;

async function t(nombre, fn) {
  try {
    await fn();
    console.log(`  OK   ${nombre}`);
    ok++;
  } catch (e) {
    console.log(`  FAIL ${nombre} -> ${e.message}`);
    fail++;
  }
}

function respuesta(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

function nombreBase(ruta) {
  return ruta.split('/').pop();
}

const estado = { archivos: new Map(), llamadas: [], fallarVerificacion: false };

const arbol = [
  { type: 'blob', path: 'PATENTE/AB123CD/titulo.pdf' },
  { type: 'blob', path: 'PATENTE/EMPLEADOS/e1/dni.pdf' },
  { type: 'blob', path: 'PATENTE/EMPLEADOS/e1/registro.pdf' }
];

function reiniciar() {
  estado.archivos = new Map();
  estado.archivos.set('PATENTE/AB123CD/dni.pdf', Buffer.from('DNI VIEJO').toString('base64'));
  estado.archivos.set('PATENTE/EMPLEADOS/e1/registro.pdf', Buffer.from('REGISTRO').toString('base64'));
  estado.llamadas = [];
  estado.fallarVerificacion = false;
}

global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const method = opts.method || 'GET';
  estado.llamadas.push({ url: u, method });

  if (u.startsWith('https://fake/raw/')) {
    return { ok: true, status: 200, arrayBuffer: async () => Uint8Array.from(Buffer.from('GRANDE')).buffer };
  }
  if (u.includes('/git/trees/main')) return respuesta(200, { tree: arbol, truncated: false });
  if (u.includes('/commits?path=PATENTE')) {
    return respuesta(200, [{ sha: 'c1', files: [{ filename: 'PATENTE/EMPLEADOS/e1/dni.pdf' }] }]);
  }

  const m = /\/contents\/(.+)$/.exec(u);
  if (!m) return respuesta(404, {});
  const ruta = decodeURIComponent(m[1]);

  if (method === 'GET') {
    if (estado.archivos.has(ruta)) {
      const contenido = estado.archivos.get(ruta);
      if (estado.fallarVerificacion && ruta === 'PATENTE/EMPLEADOS/e1/dni.pdf') return respuesta(404, {});
      if (contenido === '__DOWNLOAD__') {
        return respuesta(200, {
          name: nombreBase(ruta),
          path: ruta,
          sha: `sha-${ruta}`,
          size: 6,
          content: '',
          download_url: 'https://fake/raw/dni.pdf'
        });
      }
      return respuesta(200, {
        name: nombreBase(ruta),
        path: ruta,
        sha: `sha-${ruta}`,
        size: Buffer.from(contenido, 'base64').length,
        content: contenido,
        encoding: 'base64'
      });
    }
    const prefijo = `${ruta}/`;
    const hijos = [...estado.archivos.keys()].filter(k => k.startsWith(prefijo));
    if (hijos.length) {
      return respuesta(200, hijos.map(k => ({
        name: nombreBase(k),
        path: k,
        sha: `sha-${k}`,
        size: Buffer.from(estado.archivos.get(k) === '__DOWNLOAD__' ? 'GRANDE' : estado.archivos.get(k), 'base64').length
      })));
    }
    return respuesta(404, {});
  }

  if (method === 'PUT') {
    estado.archivos.set(ruta, JSON.parse(opts.body).content);
    return respuesta(201, { content: { path: ruta } });
  }
  if (method === 'DELETE') {
    estado.archivos.delete(ruta);
    return respuesta(200, {});
  }
  return respuesta(405, {});
};

(async () => {
  console.log('\n########## GITHUB: EMPLEADOS Y MOVERRUTA ##########');

  await t('carpetaEmpleado conserva mayusculas y guiones', () => {
    assert.strictEqual(gh.carpetaEmpleado('AbC-12'), 'PATENTE/EMPLEADOS/AbC-12');
  });

  await t('carpetaEmpleado rechaza id invalido', () => {
    assert.throws(() => gh.carpetaEmpleado('!!!'), /ID de empleado inválido/);
  });

  await t('rutaDocumentoEmpleado usa tipo en minusculas', () => {
    assert.strictEqual(gh.rutaDocumentoEmpleado('e1', 'DNI'), 'PATENTE/EMPLEADOS/e1/dni.pdf');
  });

  await t('listarPatenteGlobal ignora la carpeta EMPLEADOS', async () => {
    reiniciar();
    const arbolPatentes = await gh.listarPatenteGlobal();
    assert.ok(arbolPatentes.has('AB123CD'));
    assert.strictEqual(arbolPatentes.has('EMPLEADOS'), false);
  });

  await t('listarEmpleadosGlobal devuelve los tipos por id', async () => {
    reiniciar();
    const arbolEmpleados = await gh.listarEmpleadosGlobal();
    assert.ok(arbolEmpleados.has('e1'));
    assert.deepStrictEqual(arbolEmpleados.get('e1').sort(), ['dni.pdf', 'registro.pdf']);
  });

  await t('moverRuta escribe, verifica y solo despues borra el origen', async () => {
    reiniciar();
    const res = await gh.moverRuta(
      'PATENTE/AB123CD/dni.pdf',
      'PATENTE/EMPLEADOS/e1/dni.pdf',
      { tipoOrigen: 'dni', tipoDestino: 'dni' }
    );
    assert.strictEqual(res.ok, true);
    assert.strictEqual(estado.archivos.has('PATENTE/EMPLEADOS/e1/dni.pdf'), true);
    assert.strictEqual(estado.archivos.has('PATENTE/AB123CD/dni.pdf'), false);
    const put = estado.llamadas.findIndex(x => x.method === 'PUT' && x.url.includes('/EMPLEADOS/e1/dni.pdf'));
    const verif = estado.llamadas.findIndex((x, i) => i > put && x.method === 'GET' && x.url.includes('/EMPLEADOS/e1/dni.pdf'));
    const del = estado.llamadas.findIndex(x => x.method === 'DELETE' && x.url.includes('/AB123CD/dni.pdf'));
    assert.ok(put >= 0);
    assert.ok(verif > put);
    assert.ok(del > verif);
  });

  await t('moverRuta NO borra el origen si falla la verificacion', async () => {
    reiniciar();
    estado.archivos.set('PATENTE/ZZ999ZZ/dni.pdf', Buffer.from('OTRO').toString('base64'));
    estado.fallarVerificacion = true;
    await assert.rejects(
      () => gh.moverRuta('PATENTE/ZZ999ZZ/dni.pdf', 'PATENTE/EMPLEADOS/e1/dni.pdf', { tipoOrigen: 'dni' }),
      /NO fue borrado/
    );
    assert.strictEqual(estado.archivos.has('PATENTE/ZZ999ZZ/dni.pdf'), true);
  });

  await t('moverRuta soporta archivos grandes por download_url', async () => {
    reiniciar();
    estado.archivos.set('PATENTE/GRANDE1/dni.pdf', '__DOWNLOAD__');
    const res = await gh.moverRuta(
      'PATENTE/GRANDE1/dni.pdf',
      'PATENTE/EMPLEADOS/e1/dni.pdf',
      { tipoOrigen: 'dni' }
    );
    assert.strictEqual(res.ok, true);
    assert.strictEqual(
      estado.archivos.get('PATENTE/EMPLEADOS/e1/dni.pdf'),
      Buffer.from('GRANDE').toString('base64')
    );
    assert.strictEqual(estado.archivos.has('PATENTE/GRANDE1/dni.pdf'), false);
  });

  await t('cambiosDesde no emite EMPLEADOS como patente', async () => {
    reiniciar();
    const cambios = await gh.cambiosDesde('2026-01-01', { estricto: true });
    assert.deepStrictEqual(Object.keys(cambios), []);
  });

  console.log('\n================================');
  console.log(`  github-empleados  ->  OK: ${ok}   FAIL: ${fail}`);
  console.log('================================');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('ERROR FATAL:', e.message);
  process.exit(1);
});
