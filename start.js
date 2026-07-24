const { execSync, spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname);

console.log('Sync...');
try {
  execSync('git stash', { cwd: root, stdio: 'ignore', timeout: 10000 });
  execSync('git pull origin main', { cwd: root, stdio: 'ignore', timeout: 15000 });
  execSync('git stash pop', { cwd: root, stdio: 'ignore', timeout: 10000 });
} catch (e) {
  console.log('Sync skipped (no changes or conflict)');
}

const server = spawn('node', [path.join(root, 'server.js')], {
  cwd: root,
  detached: true,
  stdio: 'ignore'
});
server.unref();

console.log('Server → http://localhost:3000');
process.exit(0);
