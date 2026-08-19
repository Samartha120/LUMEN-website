const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.clear();
console.log('\x1b[1;36mStarting LUMEN services...\x1b[0m\n');

const backendPath = path.resolve(__dirname, '../backend');

async function startFrontend() {
  try {
    const { createServer } = require('vite');
    const server = await createServer({
      root: __dirname,
      server: { port: 5173, open: false }
    });
    await server.listen();
    const info = server.config.server || {};
    console.log('\x1b[36m[frontend]\x1b[0m Vite dev server ready at http://localhost:5173/');
    console.log('\x1b[35m[backend]\x1b[0m Expected API endpoint: http://localhost:4000/api/ping');

    return server;
  } catch (err) {
    console.error('\x1b[31m[frontend-err]\x1b[0m Failed to start Vite:', err && err.stack ? err.stack : err);
    throw err;
  }
}

function startBackendIfExists() {
  if (!fs.existsSync(backendPath)) {
    console.log('\x1b[33m[backend]\x1b[0m Backend folder not found at', backendPath);
    return null;
  }

  const pkg = path.join(backendPath, 'package.json');
  if (!fs.existsSync(pkg)) {
    console.log('\x1b[33m[backend]\x1b[0m No package.json in backend folder, skipping backend start.');
    return null;
  }

  const npmCmd = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const npmArgs = process.platform === 'win32'
    ? ['/c', 'npm', 'run', 'start:dev']
    : ['run', 'start:dev'];
  try {
    const proc = spawn(npmCmd, npmArgs, {
      cwd: backendPath,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: 'true' },
      shell: false
    });

    proc.stdout.on('data', (b) => process.stdout.write('\x1b[35m[backend]\x1b[0m ' + b.toString()));
    proc.stderr.on('data', (b) => process.stderr.write('\x1b[31m[backend-err]\x1b[0m ' + b.toString()));

    proc.on('exit', (code) => console.log(`\x1b[35m[backend]\x1b[0m Backend exited with code ${code}`));

    return proc;
  } catch (e) {
    console.error('\x1b[31m[backend-err]\x1b[0m Failed to spawn backend:', e && e.stack ? e.stack : e);
    return null;
  }
}

let viteServer = null;
let backendProc = null;

(async () => {
  try {
    viteServer = await startFrontend();
  } catch (e) {
    // If Vite couldn't start, exit after printing error
    process.exit(1);
  }

  backendProc = startBackendIfExists();

  // Print combined ready message when frontend is up (backend optional)
  setTimeout(() => {
    console.log('\n\x1b[1;32m======================================================================\x1b[0m');
    console.log('\x1b[1;32m  LUMEN SERVICES RUNNING (frontend started) \x1b[0m');
    console.log('\x1b[1;32m======================================================================\x1b[0m');
    console.log('\x1b[1;36m  ➜  Front-End (Web Interface):  \x1b[1;32mhttp://localhost:5173/\x1b[0m');
    if (backendProc) {
      console.log('\x1b[1;35m  ➜  Back-End (Express API):      \x1b[1;32mhttp://localhost:4000/\x1b[0m');
    } else {
      console.log('\x1b[33m  ➜  Back-End: not started (missing or no package.json)\x1b[0m');
    }
    console.log('\x1b[1;30m----------------------------------------------------------------------\x1b[0m');
    console.log('\x1b[1;33m  Press Ctrl+C to terminate.\x1b[0m');
    console.log('\x1b[1;32m======================================================================\x1b[0m\n');
  }, 100);
})();

function cleanup() {
  console.log('\n\x1b[1;33mStopping services...\x1b[0m\n');
  if (backendProc && !backendProc.killed) {
    backendProc.kill();
  }
  if (viteServer && typeof viteServer.close === 'function') {
    viteServer.close();
  }
  setTimeout(() => process.exit(), 300);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
