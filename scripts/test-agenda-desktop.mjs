// Verificação local real: Electron minimizado, API isolada e notificação nativa.
// Requer build e `npm.cmd ci --prefix companion`; não usa contas ou configuração pessoais.
import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createInitialState } from '../public/domain.js';
import { createAppointment } from '../public/agenda-domain.js';
import { libraryActions } from '../public/library-actions.js';

const root = resolve('.');
const tempRoot = join(tmpdir(), 'opencode');
await mkdir(tempRoot, { recursive: true });
const temp = await mkdtemp(join(tempRoot, 'lume-agenda-desktop-'));
await mkdir(join(temp, 'appdata'), { recursive: true });
const origin = 'http://127.0.0.1:4199';
const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: '4199', LUME_DATA_DIR: join(temp, 'data'), BCRYPT_ROUNDS: '6' }, stdio: ['ignore', 'pipe', 'pipe'] });
let desktop;
try {
  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor não iniciou.')), 20000);
    server.stdout.on('data', (data) => { if (String(data).includes('disponível')) { clearTimeout(timeout); resolveReady(); } });
    server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Servidor encerrou: ${code}`)); });
  });
  const env = { ...process.env, APPDATA: join(temp, 'appdata'), LUME_API_URL: origin };
  delete env.ELECTRON_RUN_AS_NODE;
  const require = createRequire(new URL('../companion/package.json', import.meta.url));
  desktop = await electron.launch({ executablePath: require('electron'), args: [join(root, 'companion'), `--user-data-dir=${join(temp, 'profile')}`], env, timeout: 30000 });
  const page = await desktop.firstWindow();
  await page.waitForURL(`${origin}/**`);
  const headers = { origin };
  const register = await page.request.post(`${origin}/api/register`, { headers, data: { name: 'Agenda desktop', email: `desktop-${crypto.randomUUID()}@example.test`, password: 'senha-apenas-de-teste' } });
  assert.equal(register.status(), 201);
  let current = await (await page.request.get(`${origin}/api/library`, { headers })).json();
  const onboarded = { ...createInitialState(), onboarded: true };
  const setup = await page.request.post(`${origin}/api/library/actions`, { headers, data: { id: crypto.randomUUID(), revision: current.revision, actions: libraryActions(current.state, onboarded) } });
  assert.equal(setup.status(), 200);
  current = await setup.json();
  // O contexto HTTP do Playwright/Electron não compartilha o cookie jar nativo.
  const cookie = register.headers()['set-cookie'].match(/lume_session=([^;]+)/)[1];
  await desktop.evaluate(async ({ session }, { origin, cookie }) => session.defaultSession.cookies.set({ url: origin, name: 'lume_session', value: cookie, httpOnly: true, sameSite: 'lax' }), { origin, cookie });
  await page.goto(`${origin}/#agenda`);
  await page.reload();
  await page.getByRole('heading', { name: 'Agenda', exact: true }).waitFor();
  await page.evaluate(() => {
    const Native = window.Notification;
    window.nativeAgendaNotifications = { created: 0, shown: 0, errors: 0 };
    function Observed(...args) {
      const notification = new Native(...args);
      window.nativeAgendaNotifications.created++;
      notification.addEventListener('show', () => window.nativeAgendaNotifications.shown++);
      notification.addEventListener('error', () => window.nativeAgendaNotifications.errors++);
      return notification;
    }
    Object.defineProperty(Observed, 'permission', { get: () => Native.permission });
    Observed.requestPermission = () => Native.requestPermission();
    window.Notification = Observed;
  });
  const now = new Date(), end = new Date(now.getTime() + 3600000);
  const next = createAppointment(current.state, { title: 'Teste de lembrete do Lume', category: 'study', date: now.toISOString().slice(0, 10), start: now.toISOString().slice(11, 16), end: end.toISOString().slice(11, 16), endDate: end.toISOString().slice(0, 10), timeZone: 'UTC', reminder: 0 });
  const saved = await page.request.post(`${origin}/api/library/actions`, { headers, data: { id: crypto.randomUUID(), revision: current.revision, actions: libraryActions(current.state, next) } });
  assert.equal(saved.status(), 200);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
  try {
    await page.waitForFunction(() => window.nativeAgendaNotifications?.shown === 1, null, { timeout: 30000 });
  } catch (error) {
    console.log(JSON.stringify(await page.evaluate(() => ({ permission: Notification.permission, ...window.nativeAgendaNotifications, title: document.title, internal: document.querySelector('.agenda-reminders')?.textContent, error: document.querySelector('[role="alert"]')?.textContent })), null, 2));
    throw error;
  }
  const result = await page.evaluate(() => ({ permission: Notification.permission, ...window.nativeAgendaNotifications }));
  result.minimized = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized());
  result.internal = await page.getByLabel('Lembretes da Agenda').innerText();
  assert.equal(result.minimized, true);
  assert.equal(result.created, 1);
  assert.equal(result.shown, 1);
  assert.equal(result.errors, 0);
  assert.match(result.internal, /Teste de lembrete/);
  assert.deepEqual((await (await page.request.post(`${origin}/api/agenda/reminders`, { headers })).json()).reminders, []);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} finally {
  if (desktop) await desktop.close();
  server.kill();
}
