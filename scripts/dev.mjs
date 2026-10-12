import { spawn } from 'node:child_process';
import { watch } from 'chokidar';
let building = false, pending = false, debounce, server;
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}
async function build() {
  if (building) { pending = true; return; }
  building = true;
  try { await run('npm', ['run', 'build']); }
  catch (error) { console.error(error.message); }
  finally { building = false; if (pending) { pending = false; await build(); } }
}
await run('npm', ['run', 'build']);
server = spawn('npm', ['run', 'preview'], { stdio: 'inherit' });
const watcher = watch(['resources/saola', 'sao.config.json', 'public'], { ignoreInitial: true });
watcher.on('all', () => { clearTimeout(debounce); debounce = setTimeout(build, 250); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  clearTimeout(debounce); await watcher.close(); server.kill(signal); process.exit(0);
});
