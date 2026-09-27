import { describe, expect, it } from 'vitest';
import { SWEEP } from './progressBar';
import { blockingOperation, runningOperationOfKind, type RunningOperation } from './runningOperationsStore';

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

describe('runningOperationOfKind', () => {
  it('is the oldest operation on the workspace while it is of that kind', () => {
    const update = running('update', '/work/a', 'update');
    expect(runningOperationOfKind([update, running('checkin', '/work/a')], '/work/a', 'update')).toBe(update);
    expect(runningOperationOfKind([running('checkin', '/work/a'), update], '/work/a', 'update')).toBeUndefined();
  });

  it('stays the same object across reports of another operation, so views showing only that kind stay still', () => {
    const switching = running('switch', '/work/a', 'switch');
    const before = [running('checkin', '/work/b'), switching];
    const after = [{ ...before[0]!, progress: { stage: 'uploading' as const, stageLabel: 'Uploading', fraction: 0.5 } }, switching];
    expect(runningOperationOfKind(after, '/work/a', 'switch')).toBe(runningOperationOfKind(before, '/work/a', 'switch'));
    expect(runningOperationOfKind(after, '/work/a', 'update')).toBeUndefined();
  });
});
