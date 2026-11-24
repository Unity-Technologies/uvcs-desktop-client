import { describe, expect, it } from 'vitest';
import type { CommandLogEntry } from '@shared/events';
import { cmFoundText, commandText, logRecord, pageGoneText, processGoneText, startedText } from './logRecords';

const WHEN = new Date(Date.UTC(2026, 10, 17, 11, 40, 36, 123));

function entry(parts: Partial<CommandLogEntry> = {}): CommandLogEntry {
  return { id: 1, commandLine: 'cm status --machinereadable', cwd: 'C:\\wk\\game', startedAt: 0, durationMs: 120, exitCode: 0, viaShell: true, output: '', ...parts };
}

describe('logRecord', () => {
  it('starts with the local time and how far it is from UTC, east and west', () => {
    expect(logRecord(WHEN, -60, 'Started')).toBe('2026-11-17 12:40:36.123 +01:00 Started\n');
    expect(logRecord(WHEN, 330, 'Started')).toBe('2026-11-17 06:10:36.123 -05:30 Started\n');
    expect(logRecord(WHEN, 0, 'Started')).toBe('2026-11-17 11:40:36.123 +00:00 Started\n');
  });

  it('indents every line after the first, whatever its line ends, so each record starts with its time', () => {
    expect(logRecord(WHEN, 0, 'Error: boom\r\n    at a (a.ts:1)\nat b (b.ts:2)\n')).toBe(
      '2026-11-17 11:40:36.123 +00:00 Error: boom\n        at a (a.ts:1)\n    at b (b.ts:2)\n',
    );
  });
});

describe('commandText', () => {
  it('keeps a command that succeeded on one line: where it ran and how long it took', () => {
    expect(commandText(entry())).toBe('cm status --machinereadable · in C:\\wk\\game · 120 ms');
  });

  it('adds how a failed command ended and the output the command log kept of it', () => {
    expect(commandText(entry({ exitCode: 1, output: 'The server could not be reached.' }))).toBe(
      'cm status --machinereadable · in C:\\wk\\game · 120 ms · Exit code 1\nThe server could not be reached.',
    );
    expect(commandText(entry({ exitCode: -1, output: '' }))).toBe('cm status --machinereadable · in C:\\wk\\game · 120 ms · Stopped');
  });

  it('logs an issue tracker’s request by its answer’s status, with no folder', () => {
    const request = entry({ commandLine: 'GET api.github.com/repos/a/b/issues/7', cwd: '', exitCode: 1, source: 'tracker', httpStatus: 404, output: 'Not found' });
    expect(commandText(request)).toBe('GET api.github.com/repos/a/b/issues/7 · 120 ms · HTTP 404\nNot found');
  });
});

describe('launch records', () => {
  it('names the app, the OS, the architecture and Electron', () => {
    expect(startedText({ appVersion: '0.2.9', platform: 'win32', osRelease: '10.0.26100', arch: 'arm64', electronVersion: '44.10.0' })).toBe(
      'Unity Version Control 0.2.9 started · win32 10.0.26100 arm64 · Electron 44.10.0',
    );
    expect(cmFoundText('11.0.16.9412', '/usr/local/bin/cm')).toBe('cm 11.0.16.9412 at /usr/local/bin/cm');
  });
});

describe('ended processes', () => {
  it('logs a page or a process that ended unexpectedly', () => {
    expect(pageGoneText({ reason: 'oom', exitCode: -536870904 })).toBe("A window's page ended: oom, exit code -536870904");
    expect(processGoneText({ type: 'GPU', reason: 'crashed', exitCode: 5 })).toBe('The GPU process ended: crashed, exit code 5');
    expect(processGoneText({ type: 'Utility', name: 'Network Service', reason: 'killed', exitCode: 9 })).toBe('The Utility process (Network Service) ended: killed, exit code 9');
  });

  it('leaves out one that ended as it should', () => {
    expect(pageGoneText({ reason: 'clean-exit', exitCode: 0 })).toBeNull();
    expect(processGoneText({ type: 'Utility', reason: 'clean-exit', exitCode: 0 })).toBeNull();
  });
});
