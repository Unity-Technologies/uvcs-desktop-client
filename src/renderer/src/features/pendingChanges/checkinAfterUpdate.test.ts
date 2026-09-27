import { describe, expect, it } from 'vitest';
import { checkinAfterUpdateMessage } from './checkinAfterUpdate';

const rejected = { branch: '/main/t1', loadedChangeset: 41 };

describe('checkinAfterUpdateMessage', () => {
  it('offers to check in once the workspace updated past the rejection', () => {
    expect(checkinAfterUpdateMessage(rejected, { branch: '/main/t1', loadedChangeset: 43 }, 4)).toBe('Updated to cs:43 · Check in your 4 changes now?');
  });

  it('waits while the workspace has not updated', () => {
    expect(checkinAfterUpdateMessage(rejected, { branch: '/main/t1', loadedChangeset: 41 }, 4)).toBeNull();
  });

  it('stays quiet on another branch, with nothing to check in, or without a rejection', () => {
    expect(checkinAfterUpdateMessage(rejected, { branch: '/main', loadedChangeset: 50 }, 4)).toBeNull();
    expect(checkinAfterUpdateMessage(rejected, { branch: '/main/t1', loadedChangeset: 43 }, 0)).toBeNull();
    expect(checkinAfterUpdateMessage(undefined, { branch: '/main/t1', loadedChangeset: 43 }, 4)).toBeNull();
  });
});
