const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

// Clear terminal and print starting message
console.clear();
console.log("\x1b[1;36mStarting LUMEN services...\x1b[0m\n");

const backendPath = path.resolve(__dirname, '../../../LUMEN/Lumen-app/backend');

// Spawn processes
const frontend = spawn('npx', ['vite'], {
  cwd: __dirname,
  shell: true,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: 'true' }
});

const backend = spawn('npm', ['run', 'start:dev'], {
  cwd: backendPath,
  shell: true,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: 'true' }
});

function setupStream(proc, name, color) {
  const rl = readline.createInterface({
    input: proc,
    terminal: false
  });

  rl.on('line', (line) => {
    // Attempt to parse and beautify NestJS/Pino JSON logs
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.level && parsed.msg) {
          const levelMap = { 10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL' };
          const levelName = levelMap[parsed.level] || 'LOG';
          const levelColor = parsed.level >= 50 ? '\x1b[31m' : (parsed.level >= 40 ? '\x1b[33m' : '\x1b[32m');
          const time = parsed.time ? new Date(parsed.time).toLocaleTimeString() : new Date().toLocaleTimeString();
          const context = parsed.context ? ` \x1b[36m[${parsed.context}]\x1b[0m` : '';
          
          process.stdout.write(`${color}[${name}]\x1b[0m ${time} ${levelColor}${levelName}\x1b[0m${context} ${parsed.msg}\n`);
          
          // Print ready message when backend has started
          if (parsed.msg.includes('Nest application successfully started')) {
            printReadyMessage();
          }
          return;
        }
      } catch (e) {
        // Fallback to printing raw line if JSON parsing fails
      }
    }

    // Print raw log line
    process.stdout.write(`${color}[${name}]\x1b[0m ${line}\n`);

    // In case the backend outputs start message in raw format
    if (line.includes('Nest application successfully started')) {
      printReadyMessage();
    }
  });
}

function printReadyMessage() {
  setTimeout(() => {
    console.log("\n\x1b[1;32m======================================================================\x1b[0m");
    console.log("\x1b[1;32m  LUMEN SERVICES RUNNING SUCCESSFULLY! \x1b[0m");
    console.log("\x1b[1;32m======================================================================\x1b[0m");
    console.log("\x1b[1;36m  ➜  Front-End (Web Interface):  \x1b[1;32mhttp://localhost:5173/\x1b[0m");
    console.log("\x1b[1;35m  ➜  Back-End (NestJS API):      \x1b[1;32mhttp://localhost:3000/\x1b[0m");
    console.log("\x1b[1;30m----------------------------------------------------------------------\x1b[0m");
    console.log("\x1b[1;33m  Press Ctrl+C to terminate both servers cleanly.\x1b[0m");
    console.log("\x1b[1;32m======================================================================\x1b[0m\n");
  }, 100);
}

setupStream(frontend.stdout, 'frontend', '\x1b[36m');
setupStream(frontend.stderr, 'frontend-err', '\x1b[31m');
setupStream(backend.stdout, 'backend', '\x1b[35m');
setupStream(backend.stderr, 'backend-err', '\x1b[31m');

// Cleanup on exit
let isCleaningUp = false;
function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;
  
  console.log('\n\x1b[1;33mStopping both processes...\x1b[0m\n');
  
  frontend.kill();
  backend.kill();
  
  setTimeout(() => {
    process.exit();
  }, 500);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
