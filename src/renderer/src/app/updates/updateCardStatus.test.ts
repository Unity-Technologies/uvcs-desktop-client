import { describe, expect, it } from 'vitest';
import { updateCardOf } from './updateCardStatus';

describe('updateCardOf', () => {
  it('shows an update downloading, even one no one asked for', () => {
    const downloading = { state: 'downloading', version: '1.2.0', percent: 30 } as const;
    expect(updateCardOf(downloading, null, false)).toBe(downloading);
  });

  it('shows a downloaded update until that version is put off, and a newer one again', () => {
    const ready = { state: 'ready', version: '1.2.0', install: 'restart' } as const;
    expect(updateCardOf(ready, null, false)).toBe(ready);
    expect(updateCardOf(ready, '1.2.0', false)).toBeNull();
    expect(updateCardOf({ ...ready, version: '1.3.0' }, '1.2.0', false)).toEqual({ ...ready, version: '1.3.0' });
  });

  it('leaves checks and their answers to the About dialog and the toasts', () => {
    expect(updateCardOf({ state: 'checking' }, null, false)).toBeNull();
    expect(updateCardOf({ state: 'upToDate' }, null, false)).toBeNull();
    expect(updateCardOf({ state: 'failed', error: 'x' }, null, false)).toBeNull();
  });

  it('steps aside while a dialog shows the update, and comes back after', () => {
    const ready = { state: 'ready', version: '1.2.0', install: 'restart' } as const;
    expect(updateCardOf(ready, null, true)).toBeNull();
    expect(updateCardOf({ state: 'downloading', version: '1.2.0', percent: 30 }, null, true)).toBeNull();
    expect(updateCardOf(ready, null, false)).toBe(ready);
  });
});
