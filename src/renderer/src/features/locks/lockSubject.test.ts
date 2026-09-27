import { describe, expect, it } from 'vitest';
import { lockSubject } from './lockSubject';

describe('lockSubject', () => {
  it('names the lock, not the file', () => {
    expect(lockSubject([{ path: '/art/hero.psd' }])).toBe('the lock on hero.psd');
  });

  it('counts several locks', () => {
    expect(lockSubject([{ path: '/a.psd' }, { path: '/b.psd' }])).toBe('2 locks');
  });
});
