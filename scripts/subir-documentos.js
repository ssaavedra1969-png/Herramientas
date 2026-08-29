require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PATENTE_DIR = 'PATENTE';

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    stdio: opts.silent ? 'pipe' : 'pipe',
    encoding: 'utf8',
    ...opts
  });
}

function info(msg) {
  console.log('\n\x1b[36m[subir-documentos]\x1b[0m ' + msg);
}

function ok(msg) {
  console.log('\x1b[32m  ✓\x1b[0m ' + msg);
}

function error(msg) {
  console.error('\x1b[31m  ✗\x1b[0m ' + msg);
}

function main() {
  info('Iniciando subida de documentos de la carpeta ' + PATENTE_DIR + '/ ...\n');

  const rama = run('git rev-parse --abbrev-ref HEAD').trim();
  if (rama !== 'main') {
    error('Debés estar en la rama main (actual: ' + rama + ').');
    process.exit(1);
  }

  info('Sincronizando con el repo remoto (git pull)...');
  try {
    run('git pull origin main --ff-only');
    ok('Pull OK');
  } catch (e) {
    error('No se pudo hacer git pull. Revisá conflictos o la conexión.');
    process.exit(1);
  }

  let status = '';
  try {
    status = run('git status --porcelain -- ' + PATENTE_DIR).trim();
  } catch (e) {
    error('No se pudo leer el estado de la carpeta ' + PATENTE_DIR + '.');
    process.exit(1);
  }

  if (!status) {
    info('No hay cambios en ' + PATENTE_DIR + '/. Nada que subir.\n');
    process.exit(0);
  }

  const patentes = [];
  status.split('\n').forEach(line => {
    const p = line.replace(/^.. /, '').replace(/^"|"$/g, '').replace(/ -> .*$/, '');
    const partes = p.split('/');
    if (partes.length >= 2 && partes[0] === PATENTE_DIR) {
      const pat = partes[1];
      if (!patentes.includes(pat)) patentes.push(pat);
    }
  });

  info('Cambios detectados en ' + patentes.length + ' vehículo(s):');
  patentes.forEach(p => console.log('   · ' + p));

  const etiqueta = patentes.length === 1 ? 'Vehículo ' + patentes[0] : patentes.length + ' vehículos';

  info('Agregando y commiteando los documentos...');
  try {
    run('git add ' + PATENTE_DIR);
    const mensaje = 'Docs: ' + etiqueta;
    run('git commit -m "' + mensaje + '"');
    ok('Commit creado: ' + mensaje);
  } catch (e) {
    error('Falló el commit. Revisá git status.');
    process.exit(1);
  }

  info('Subiendo a producción (git push origin main)...');
  try {
    run('git push origin main');
    ok('Push OK. Vercel está desplegando (~1-2 min).');
  } catch (e) {
    error('Falló el push. Ejecutá git pull origin main y volvé a correr el script.');
    process.exit(1);
  }

  info('Listo. En unos minutos los documentos estarán visibles en producción.\n');
}

main();
