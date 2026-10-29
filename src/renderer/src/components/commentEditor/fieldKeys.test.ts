import { describe, expect, it } from 'vitest';
import { enterAction, modEnterAction } from './fieldKeys';

describe('modEnterAction', () => {
  it('runs the field’s own handler, else submits its dialog, else leaves the key to the window', () => {
    expect(modEnterAction({ singleLine: false, hasHandler: true, inForm: true })).toBe('owner');
    expect(modEnterAction({ singleLine: false, hasHandler: false, inForm: true })).toBe('form');
    expect(modEnterAction({ singleLine: true, hasHandler: false, inForm: false })).toBe('window');
  });
});

describe('enterAction', () => {
  it('writes a line end in a field of many lines', () => {
    expect(enterAction({ singleLine: false, hasHandler: true, inForm: true })).toBe('newLine');
  });

  it('on one line runs the field’s handler (a summary goes on to its description), else submits its dialog', () => {
    expect(enterAction({ singleLine: true, hasHandler: true, inForm: true })).toBe('owner');
    expect(enterAction({ singleLine: true, hasHandler: false, inForm: true })).toBe('form');
    expect(enterAction({ singleLine: true, hasHandler: false, inForm: false })).toBe('nothing');
  });
});
