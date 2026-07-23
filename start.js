const { execSync, exec } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname);

console.log('Sync...');
try {
  execSync('git stash', { cwd: root, stdio: 'ignore' });
  execSync('git pull origin main', { cwd: root, stdio: 'ignore' });
  execSync('git stash pop', { cwd: root, stdio: 'ignore' });
} catch (e) {}

exec(`start "" /B node "${path.join(root, 'server.js')}"`, { cwd: root });
console.log('Server → http://localhost:3000');
process.exit(0);
