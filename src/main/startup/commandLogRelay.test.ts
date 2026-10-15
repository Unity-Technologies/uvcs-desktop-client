import { describe, expect, it } from 'vitest';
import type { CommandLogEntry } from '@shared/events';
import { CommandLogRelay } from './commandLogRelay';

function entry(id: number): CommandLogEntry {
  return { id, commandLine: 'cm status', cwd: '/wk', startedAt: id, durationMs: 1, exitCode: 0, viaShell: false, output: '' };
}

describe('CommandLogRelay', () => {
  it('keeps what is logged before the first windows open, and sends it to them in order once they do', () => {
    const sent: number[] = [];
    const relay = new CommandLogRelay((logged) => sent.push(logged.id));
    relay.logged(entry(1));
    relay.logged(entry(2));
    expect(sent).toEqual([]);

    relay.windowsOpened();
    expect(sent).toEqual([1, 2]);
  });

  it('sends what is logged once the windows are open as it comes', () => {
    const sent: number[] = [];
    const relay = new CommandLogRelay((logged) => sent.push(logged.id));
    relay.windowsOpened();
    relay.logged(entry(3));
    relay.windowsOpened();
    expect(sent).toEqual([3]);
  });
});
