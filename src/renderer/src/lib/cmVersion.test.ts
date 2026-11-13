import { describe, expect, it } from 'vitest';
import { isCmVersionAtLeast } from './cmVersion';

const FIRST = [11, 0, 16, 10512] as const;

describe('isCmVersionAtLeast', () => {
  it.each(['11.0.16.10512', '11.0.16.10513', '11.0.17.1', '11.1.0.0', '12.0.0.0', '11.0.16.10512\r\n'])('takes cm %j as that version or later', (version) => {
    expect(isCmVersionAtLeast(version, FIRST)).toBe(true);
  });

  it.each(['11.0.16.10511', '11.0.16.9999', '11.0.15.20000', '10.9.99.99999', '1.0.0.0'])('takes cm %j as older', (version) => {
    expect(isCmVersionAtLeast(version, FIRST)).toBe(false);
  });

  it.each([undefined, '', 'unknown', '11.0.16', '11.0.16.10512.1', '11.0.16.10512-beta'])('answers no for a version it cannot read: %j', (version) => {
    expect(isCmVersionAtLeast(version, FIRST)).toBe(false);
  });
});
