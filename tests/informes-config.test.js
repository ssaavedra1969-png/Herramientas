'use strict';
/* Config del informe de vencimientos (Admin → Correos) + endpoint del cron.
   Usa el Firestore falso del harness: no toca producción. */
const { fake, makeReporter } = require('./helpers');

process.env.CRON_SECRET = 'test-cron-secret';
process.env.INFORMES_EMAIL_TO = 'grupo@falpat.com.ar, administracion_hormigonera@constructoraalmajo.com.ar, malo';
delete process.env.BREVO_API_KEY;
delete process.env.SMTP_HOST;

const {
  getInformeConfig,
  guardarInformeConfig,
  renderPlantilla,
  varsInforme,
  normalizarDestinatarios,
  normalizarDias,
  ASUNTO_DEFAULT,
  CUERPO_DEFAULT
} = require('../lib/informe-config');

const rep = makeReporter('informes config + cron');
const { check, section, done } = rep;

(async () => {
  section('normalización');

  const norm = normalizarDestinatarios('a@b.com, A@B.COM; malo, c@d.com');
  check('descarta inválidos', norm.length === 2, JSON.stringify(norm));
  check('elimina duplicados sin distinguir mayúsculas', norm[0] === 'a@b.com' && norm[1] === 'c@d.com', JSON.stringify(norm));
  check('acepta array', normalizarDestinatarios(['x@y.com', '  ']).length === 1);
  check('máximo 20', normalizarDestinatarios(Array.from({ length: 30 }, (_, i) => `u${i}@x.com`)).length === 20);

  check('dias: default 90', normalizarDias(undefined) === 90);
  check('dias: clamp 1..365', normalizarDias(0) === 1 && normalizarDias(999) === 365);
  check('dias: respeta valor', normalizarDias('45') === 45);

  section('defaults (sin doc en Firestore)');

  const def = await getInformeConfig();
  check('destinatarios desde env', def.destinatarios.length === 2, JSON.stringify(def.destinatarios));
  check('asunto default', def.asunto === ASUNTO_DEFAULT);
  check('cuerpo default', def.cuerpo === CUERPO_DEFAULT);
  check('activo por defecto', def.activo === true);
  check('dias default 90', def.dias === 90);

  section('guardar / leer');

  let fallo = false;
  try {
    await guardarInformeConfig({ destinatarios: [] }, 'tester');
  } catch (e) {
    fallo = /destinatario/i.test(e.message);
  }
  check('rechaza guardar sin destinatarios', fallo);

  const guardado = await guardarInformeConfig({
    destinatarios: ['grupo@falpat.com.ar', 'administracion_hormigonera@constructoraalmajo.com.ar'],
    asunto: 'Vencen {{total}} docs el {{fecha}}',
    cuerpo: 'Hola\n{{hoy_linea}}\nTotal: {{total}} / {{dias}} dias',
    dias: 30,
    activo: false
  }, 'tester');

  check('normaliza dias al guardar', guardado.dias === 30);
  check('guarda activo=false', guardado.activo === false);
  check('registra autor', guardado.actualizadoPor === 'tester');

  const leido = await getInformeConfig();
  check('lee destinatarios', leido.destinatarios.length === 2, JSON.stringify(leido.destinatarios));
  check('lee asunto', leido.asunto === 'Vencen {{total}} docs el {{fecha}}');
  check('lee cuerpo', leido.cuerpo.includes('{{hoy_linea}}'));
  check('lee activo=false', leido.activo === false);
  check('lee dias', leido.dias === 30);

  section('plantillas');

  const vars = varsInforme({ stats: { total: 7, hoy: 2, flota: 54 }, dias: 30, fecha: '2026-11-11' });
  const asunto = renderPlantilla(leido.asunto, vars);
  check('render asunto', asunto === 'Vencen 7 docs el 2026-11-11', asunto);
  const cuerpo = renderPlantilla(leido.cuerpo, vars);
  check('render cuerpo + hoy_linea', cuerpo.includes('Vence HOY: 2') && cuerpo.includes('Total: 7 / 30 dias'), cuerpo);
  check('placeholder desconocido -> vacío', renderPlantilla('a{{nope}}b', vars) === 'ab');
  check('hoy_linea vacío si hoy=0', renderPlantilla('x{{hoy_linea}}y', varsInforme({ stats: { total: 1, hoy: 0, flota: 1 }, dias: 90 })) === 'xy');

  section('endpoint del cron');

  const express = require(require('path').join(__dirname, '..', 'node_modules', 'express'));
  const app = express();
  app.use('/api/cron', require('../routes/cron.js'));
  const server = app.listen(0);
  const url = (p) => `http://127.0.0.1:${server.address().port}${p}`;

  const en20 = new Date(Date.now() + 20 * 86400000);
  fake.seed('vehicles', 'v-cron-1', {
    patente: 'AA111AA', interno: 'V001', tipo: 'Camion',
    vtv: { fechaVencimiento: en20 }, estadoGeneral: 'En servicio'
  });
  fake.seed('vehicles', 'v-cron-2', {
    patente: 'BB222BB', interno: 'V002', tipo: 'Camion',
    vtv: { fechaVencimiento: en20 }, deshabilitado: true
  });

  async function hit(p, headers) {
    const r = await fetch(url(p), { headers: headers || {} });
    let json = null;
    try { json = await r.json(); } catch (e) { /* sin cuerpo */ }
    return { status: r.status, json };
  }

  const sinToken = await hit('/api/cron/vencimientos?mail=0');
  check('sin token -> 401', sinToken.status === 401);

  const malToken = await hit('/api/cron/vencimientos?mail=0&token=nope');
  check('token inválido -> 401', malToken.status === 401);

  // Config quedó activo=false arriba: el cron debe omitir.
  const omitido = await hit('/api/cron/vencimientos?mail=0&token=test-cron-secret');
  check('activo=false -> omitido', omitido.status === 200 && !!omitido.json.omitido, JSON.stringify(omitido.json));

  const forzado = await hit('/api/cron/vencimientos?mail=0&forzar=1&token=test-cron-secret');
  check('forzar=1 -> genera', forzado.status === 200 && forzado.json.ok === true, JSON.stringify(forzado.json));
  check('incluye solo habilitados', forzado.json.stats.flota === 1, JSON.stringify(forzado.json.stats));
  check('detecta el vencimiento', forzado.json.stats.total === 1, JSON.stringify(forzado.json.stats));
  check('mail omitido con ?mail=0', forzado.json.mail.enviado === false && /mail=0/.test(forzado.json.mail.motivo));

  server.close();
  done();
})().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
