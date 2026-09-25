import { describe, expect, it } from 'vitest';
import { attributeTone, attributeValueKind, defaultValuesIn, suggestedValues } from './attributeValues';

describe('attributeValueKind', () => {
  it('shows short enumerable values as pills', () => {
    expect(attributeValueKind('RESOLVED')).toBe('pill');
    expect(attributeValueKind('in progress')).toBe('pill');
  });

  it('recognizes links, long texts and plain sentences', () => {
    expect(attributeValueKind('https://ci.example.com/build/42')).toBe('url');
    expect(attributeValueKind('## Fixes\n- Crash on start')).toBe('long');
    expect(attributeValueKind('x'.repeat(91))).toBe('long');
    expect(attributeValueKind('Waiting for the art team')).toBe('text');
    expect(attributeValueKind('  ')).toBe('empty');
  });
});

describe('attributeTone', () => {
  it('colors values by what they mean, whatever their case or separators', () => {
    expect(attributeTone('RESOLVED')).toBe('success');
    expect(attributeTone('ready')).toBe('success');
    expect(attributeTone('FAILED')).toBe('danger');
    expect(attributeTone('in_progress')).toBe('warning');
    expect(attributeTone('v2.1')).toBe('neutral');
  });
});

describe('defaultValuesIn', () => {
  it('reads the values listed on a default: line, quoted or not', () => {
    expect(defaultValuesIn('Task status\ndefault: open, resolved, "won\'t fix"')).toEqual(['open', 'resolved', "won't fix"]);
  });

  it('is empty without a default: line', () => {
    expect(defaultValuesIn('Build status of the branch')).toEqual([]);
  });
});

describe('suggestedValues', () => {
  it('puts the defaults first, then the most used short values, once each', () => {
    expect(suggestedValues(['open'], ['READY', 'FAILED', 'READY', 'open', 'line one\nline two', ' READY '])).toEqual(['open', 'READY', 'FAILED']);
  });
});
