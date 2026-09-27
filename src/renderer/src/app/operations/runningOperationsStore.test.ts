import { describe, expect, it } from 'vitest';
import { SWEEP } from './progressBar';
import { blockingOperation, type RunningOperation } from './runningOperationsStore';

const running = (id: string, workspacePath: string, kind?: RunningOperation['kind']): RunningOperation => ({
  id,
  workspacePath,
  kind,
  title: id,
  progress: null,
  bar: SWEEP,
});

describe('blockingOperation', () => {
  it('keeps an update or a switch from starting while anything runs on the workspace', () => {
    expect(blockingOperation([running('checkin', '/work/a')], '/work/a', true)?.id).toBe('checkin');
    expect(blockingOperation([running('update', '/work/a', 'update')], '/work/a', true)?.id).toBe('update');
  });

  it('keeps a checkin, a shelve or a merge from starting while an update or a switch rewrites the files', () => {
    expect(blockingOperation([running('switch', '/work/a', 'switch')], '/work/a', false)?.id).toBe('switch');
  });

  it('lets such operations run side by side, and other workspaces be', () => {
    expect(blockingOperation([running('shelve', '/work/a')], '/work/a', false)).toBeUndefined();
    expect(blockingOperation([running('update', '/work/b', 'update')], '/work/a', true)).toBeUndefined();
  });
});
