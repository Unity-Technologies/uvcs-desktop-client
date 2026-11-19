import { describe, expect, it } from 'vitest';
import { aboutCmValue } from './aboutCm';

describe('aboutCmValue', () => {
  it('says which cm runs beside its version', () => {
    expect(aboutCmValue('11.0.16.10659', { kind: 'ready', source: 'managed' })).toBe('11.0.16.10659, included with the app');
    expect(aboutCmValue('11.0.16.9000', { kind: 'ready', source: 'installed' })).toBe('11.0.16.9000, installed');
    expect(aboutCmValue('11.0.16.9000', { kind: 'ready', source: 'environment' })).toBe('11.0.16.9000, UVCS_CM_PATH');
  });

  it('waits for the version', () => {
    expect(aboutCmValue(undefined, { kind: 'ready', source: 'managed' })).toBe('…');
  });
});
