import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CommandLogEntry } from '@shared/events';

import { useCommandLogStore } from './commandLogStore';

const entry = (id: number, exitCode = 0): CommandLogEntry => ({
  id,
  commandLine: `cm status #${id}`,
  cwd: '/ws',
  startedAt: id,
  durationMs: 1,
  exitCode,
  viaShell: true,
  output: '',
});

const log = () => useCommandLogStore.getState();

beforeEach(() => {
  log().clear();
  useCommandLogStore.setState({ open: false, seenUpTo: 0, revealedId: null, handledIds: new Set() });
});

describe('command log', () => {
  it('logs every command main reports, in order', () => {
    fakeApi.emit('commandLogged', entry(1));
    fakeApi.emit('commandLogged', entry(2));

    expect(log().entries.map((logged) => logged.id)).toEqual([1, 2]);
  });

  it('keeps the newest 500 commands, each keeping its number', () => {
    for (let id = 1; id <= 502; id++) log().add(entry(id));

    expect(log().entries).toHaveLength(500);
    expect(log().entries[0]!.id).toBe(3);
    expect(log().firstNumber).toBe(3);
  });

  it('numbers from 1 again once cleared', () => {
    for (let id = 1; id <= 502; id++) log().add(entry(id));
    log().clear();

    expect(log()).toMatchObject({ entries: [], firstNumber: 1 });
  });

  it('counts every command as seen once the log is opened or closed', () => {
    log().add(entry(1, 1));
    log().add(entry(2, 1));
    log().toggle();

    expect(log()).toMatchObject({ open: true, seenUpTo: 2 });
  });

  it('opens on the command revealed, which counts what came before as seen', () => {
    log().add(entry(1, 1));
    log().add(entry(2));
    log().reveal(1);

    expect(log()).toMatchObject({ open: true, revealedId: 1, seenUpTo: 2 });
  });

  it('stops highlighting the revealed command when toggled', () => {
    log().add(entry(1));
    log().reveal(1);
    log().toggle();

    expect(log().revealedId).toBeNull();
  });

  it('remembers the failures an operation dealt with', () => {
    log().markHandled(4);
    log().markHandled(9);

    expect([...log().handledIds]).toEqual([4, 9]);
  });

  it('remembers only its height across sessions, never the commands', () => {
    log().add(entry(1));
    log().setHeight(300);

    expect(JSON.parse(localStorage.getItem('command-log')!).state).toEqual({ height: 300 });
  });
});
