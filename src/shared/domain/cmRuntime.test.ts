import { describe, expect, it } from 'vitest';
import { compareCmVersions, meetsCmVersion } from './cmRuntime';

describe('compareCmVersions', () => {
  it('compares number by number, not as text', () => {
    expect(compareCmVersions('11.0.16.9876', '11.0.16.10659')).toBeLessThan(0);
    expect(compareCmVersions('11.0.16.10659', '11.0.16.10659')).toBe(0);
    expect(compareCmVersions('12.0.0.1', '11.9.99.99999')).toBeGreaterThan(0);
  });
});

describe('meetsCmVersion', () => {
  it('takes the pinned version and newer ones, as cm version prints them', () => {
    expect(meetsCmVersion('11.0.16.10659', '11.0.16.10659')).toBe(true);
    expect(meetsCmVersion('11.0.16.10700\r\n', '11.0.16.10659')).toBe(true);
    expect(meetsCmVersion('12.0.0.1', '11.0.16.10659')).toBe(true);
  });

  it('refuses an older version, compared number by number', () => {
    expect(meetsCmVersion('11.0.16.9876', '11.0.16.10659')).toBe(false);
    expect(meetsCmVersion('10.0.16.99999', '11.0.16.10659')).toBe(false);
  });

  it('refuses a version it can’t read', () => {
    expect(meetsCmVersion('', '11.0.16.10659')).toBe(false);
    expect(meetsCmVersion('cm: command not found', '11.0.16.10659')).toBe(false);
    expect(meetsCmVersion('11.0.16.x', '11.0.16.10659')).toBe(false);
  });
});
