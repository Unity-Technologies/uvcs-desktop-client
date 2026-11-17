import { EventEmitter } from 'node:events';
import type { App } from 'electron';
import { describe, expect, it } from 'vitest';
import { logAppHealth } from './appHealth';

function watchedApp(): { app: EventEmitter; written: string[] } {
  const app = new EventEmitter();
  const written: string[] = [];
  logAppHealth(app as unknown as App, { write: (text) => written.push(text) });
  return { app, written };
}

describe('logAppHealth', () => {
  it('logs a page and a process that ended unexpectedly, and leaves out one that ended as it should', () => {
    const { app, written } = watchedApp();
    app.emit('render-process-gone', {}, {}, { reason: 'crashed', exitCode: 11 });
    app.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed', exitCode: 5 });
    app.emit('child-process-gone', {}, { type: 'Utility', reason: 'clean-exit', exitCode: 0 });

    expect(written).toEqual(["A window's page ended: crashed, exit code 11", 'The GPU process ended: crashed, exit code 5']);
  });

  it('logs a window that stops responding and responds again', () => {
    const { app, written } = watchedApp();
    const window = Object.assign(new EventEmitter(), { id: 3 });
    app.emit('browser-window-created', {}, window);
    window.emit('unresponsive');
    window.emit('responsive');

    expect(written).toEqual(['Window 3 stopped responding', 'Window 3 responds again']);
  });
});
