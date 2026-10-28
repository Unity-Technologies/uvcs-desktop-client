import { describe, expect, it } from 'vitest';
import { createdXlinkMessage } from './createdXlinkMessage';

describe('How creating an xlink ends', () => {
  it('names the changeset it was checked in as, its files loaded', () => {
    expect(createdXlinkMessage('code/lib', { kind: 'loaded', changesetId: 3 })).toEqual({ title: 'Created xlink code/lib', detail: 'Checked in as changeset 3.' });
  });

  it('says where the other changes are when they didn’t come back on their own', () => {
    expect(createdXlinkMessage('code/lib', { kind: 'loaded', changesetId: 3, changesWaitIn: 7 })).toEqual({
      kind: 'info',
      title: 'Created xlink code/lib',
      detail: 'Checked in as changeset 3. Your other changes didn’t come back on their own: Changes offers them back.',
    });
  });

  it('says a step after creating it failed, and what is left to do, never as an error: the xlink exists', () => {
    expect(createdXlinkMessage('lib', { kind: 'notCheckedIn', reason: 'The server is unreachable' })).toEqual({
      kind: 'info',
      title: 'Created xlink lib, not checked in',
      detail: 'The server is unreachable. Check it in from Changes to see its files.',
    });
    expect(createdXlinkMessage('lib', { kind: 'notLoaded', changesetId: 3, reason: 'The server is unreachable' })).toEqual({
      kind: 'info',
      title: 'Created xlink lib',
      detail: 'Checked in as changeset 3, but its files didn’t load: The server is unreachable.',
    });
  });
});
