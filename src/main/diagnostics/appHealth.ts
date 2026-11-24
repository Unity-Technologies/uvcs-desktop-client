import type { App } from 'electron';
import type { DiagnosticWriter } from './DiagnosticLog';
import { pageGoneText, processGoneText } from './logRecords';

/**
 * Logs what goes wrong below the app's own code: a window's page or another of Electron's processes (the GPU, a
 * utility) that ended unexpectedly, and a window that stops responding, then responds again. Nothing else records
 * these, so the log is the only trace a bug report can carry of them.
 */
export function logAppHealth(app: App, log: DiagnosticWriter): void {
  const logIf = (text: string | null): void => {
    if (text) log.write(text);
  };
  app.on('render-process-gone', (_event, _contents, details) => logIf(pageGoneText(details)));
  app.on('child-process-gone', (_event, details) => logIf(processGoneText(details)));
  app.on('browser-window-created', (_event, window) => {
    const id = window.id;
    window.on('unresponsive', () => log.write(`Window ${id} stopped responding`));
    window.on('responsive', () => log.write(`Window ${id} responds again`));
  });
}
