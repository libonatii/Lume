import { spawn } from 'node:child_process';
const processes = [
  spawn(process.execPath, ['server.js'], { stdio: 'inherit', env: { ...process.env, PORT: process.env.LUME_API_PORT || '4173' } }),
  spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', ...process.argv.slice(2)], { stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; processes.forEach(child => child.kill()); process.exitCode = code; }
processes.forEach(child => { child.on('error', error => { console.error(error); stop(1); }); child.on('exit', code => stop(code || 0)); });
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
