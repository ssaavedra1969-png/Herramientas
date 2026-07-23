const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname);

console.log('🔄 Sincronizando cambios...');
try {
  execSync('git stash', { cwd: root, stdio: 'ignore' });
  execSync('git pull origin main', { cwd: root, stdio: 'inherit' });
  execSync('git stash pop', { cwd: root, stdio: 'ignore' });
  console.log('✅ Código actualizado\n');
} catch (e) {
  console.log('⚠️  No se pudo sincronizar (¿repo nuevo?) — continuando...\n');
}

require('./server.js');
