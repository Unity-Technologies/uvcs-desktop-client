// Loaded into the app's main process by `startup.mjs` (NODE_OPTIONS=--require, so the app itself carries no timing
// code), before the app's own code. It records when the main process reaches each start-up step, every process it
// starts (`cm` and its `cm shell`s) and every API call the page makes, and has the page mark its own steps
// (`startupMarks.cjs`); and writes them to UVCS_STARTUP_PROBE_OUT as the
// app quits. Times are milliseconds since the Unix epoch, like the page's
// `performance.timeOrigin + performance.now()`.
// UVCS_STARTUP_AS_INSTALLED=1 makes the app believe it is installed (`app.isPackaged`), so its first window reopens
// the last workspace used (`openFirst`), as the installed app does.
const childProcess = require('node:child_process');
const { writeFileSync } = require('node:fs');
const Module = require('node:module');
const { resolve } = require('node:path');

const now = () => performance.timeOrigin + performance.now();
const probe = { processStart: performance.timeOrigin, probeLoaded: now(), processes: [], calls: [] };

// The app's main module runs right after this one, in the same turn: the next turn starts once it has.
setImmediate(() => (probe.mainModuleEvaluated = now()));

// Electron's own `electron` module exists only once the app's code runs: hook it as the app first asks for it.
const requireModule = Module.prototype.require;
Module.prototype.require = function requireHooked(request) {
  const loaded = requireModule.call(this, request);
  if (request === 'electron' && loaded?.app) {
    Module.prototype.require = requireModule;
    hookElectron(loaded);
  }
  return loaded;
};

function hookElectron({ app, ipcMain, session }) {
  if (process.env.UVCS_STARTUP_AS_INSTALLED === '1') {
    Object.defineProperty(app, 'isPackaged', { get: () => true });
    // The installed app isn't started with the app's folder (`electron <folder>`), which it would take as a folder to open.
    process.argv = process.argv.filter((arg) => resolve(arg) !== resolve(app.getAppPath()));
  }
  probe.appCodeStarted = now();
  // Runs before the app's own `whenReady` callbacks, so before its first window.
  app.whenReady().then(() => {
    probe.appReady = now();
    session.defaultSession.registerPreloadScript({ type: 'frame', filePath: require.resolve('./startupMarks.cjs') });
  });
  app.on('browser-window-created', (_event, window) => {
    if (probe.windowCreated) return;
    probe.windowCreated = now();
    window.once('ready-to-show', () => (probe.readyToShow = now()));
    window.once('show', () => (probe.windowShown = now()));
  });

  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, listener) =>
    handle(channel, async (event, request, ...rest) => {
      const call = { method: request?.method, started: now() };
      probe.calls.push(call);
      try {
        return await listener(event, request, ...rest);
      } finally {
        call.ended = now();
      }
    });

  // `startup.mjs` ends each run with SIGTERM, which Electron takes as a quit.
  app.once('will-quit', () => writeFileSync(process.env.UVCS_STARTUP_PROBE_OUT, JSON.stringify(probe)));
}

const spawn = childProcess.spawn;
childProcess.spawn = function spawnRecorded(command, args, options) {
  const record = { command, args: Array.isArray(args) ? args.slice(0, 6) : [], started: now() };
  probe.processes.push(record);
  const child = spawn.call(this, command, args, options);
  // A `cm shell` answers its first command once warm: the first output it prints.
  child.stdout?.once('data', () => (record.firstOutput = now()));
  child.once('exit', () => (record.exited = now()));
  return child;
};
