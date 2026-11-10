import { describe, expect, it } from 'vitest';
import { attributeEditorFor, attributeTone, attributeValueKind, chipHover, chipText, defaultValuesIn, outgrowsQuickField, suggestedValues, valueCounts } from './attributeValues';

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

describe('chipText', () => {
  it('says what a chip shows: empty, a long text folded to a line, a link without its scheme, else the value', () => {
    expect(chipText('  ')).toBe('empty');
    expect(chipText('## Fixes\n- Crash on start')).toBe('Fixes — Crash on start');
    expect(chipText('https://ci.example.com/build/42')).toBe('ci.example.com/build/42');
    expect(chipText(' resolved ')).toBe('resolved');
  });

  it('reads a short value as Markdown does, its marks left out', () => {
    expect(chipText('**Blocked** by `cm` 1.2')).toBe('Blocked by cm 1.2');
    expect(chipText('*done*')).toBe('done');
  });
});

describe('chipHover', () => {
  it('shows a short value as it reads, after its name', () => {
    expect(chipHover({ name: 'status', value: ' resolved ' }, false)).toEqual({ kind: 'tip', text: 'status: resolved' });
    expect(chipHover({ name: 'note', value: 'Waiting for **art**' }, false)).toEqual({ kind: 'tip', text: 'note: Waiting for art' });
    expect(chipHover({ name: 'status', value: '' }, false)).toEqual({ kind: 'tip', text: 'status: empty' });
  });

  it('shows a link whole', () => {
    expect(chipHover({ name: 'build', value: 'https://ci.example.com/build/42' }, false)).toEqual({ kind: 'tip', text: 'https://ci.example.com/build/42' });
  });

  it('shows a long text whole in a card, as Markdown, unless it is already open under the chips', () => {
    const releaseNotes = { name: 'releasenotes', value: '### New\n\n#### Restore deleted repositories\n\n```text\ncm repository undelete old\n```\n' };
    expect(chipHover(releaseNotes, false)).toEqual({ kind: 'card', markdown: '### New\n\n#### Restore deleted repositories\n\n```text\ncm repository undelete old\n```' });
    expect(chipHover(releaseNotes, true)).toEqual({ kind: 'none' });
  });
});

describe('attributeEditorFor', () => {
  it('opens a long text, Markdown most often, in the comment editor', () => {
    expect(attributeEditorFor('### New\r\n\r\n#### All platforms')).toBe('text');
    expect(attributeEditorFor('x'.repeat(91))).toBe('text');
  });

  it('opens a short value, an empty one or a link in the quick field, which offers the values used elsewhere', () => {
    expect(attributeEditorFor('resolved')).toBe('value');
    expect(attributeEditorFor('')).toBe('value');
    expect(attributeEditorFor('Waiting for the art team')).toBe('value');
    expect(attributeEditorFor('https://ci.example.com/build/42')).toBe('value');
  });
});

describe('outgrowsQuickField', () => {
  it('hands a draft to the comment editor once it holds a second line, typed with Shift+Enter or pasted', () => {
    expect(outgrowsQuickField('resolved\n')).toBe(true);
    expect(outgrowsQuickField('### New\r\n- Undelete')).toBe(true);
    expect(outgrowsQuickField('x'.repeat(200))).toBe(false);
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

describe('valueCounts', () => {
  it('counts each short value once, most used first, leaving long texts out', () => {
    expect(valueCounts(['READY', 'FAILED', ' READY ', 'line one\nline two', '', 'READY'])).toEqual([
      { value: 'READY', count: 3 },
      { value: 'FAILED', count: 1 },
    ]);
  });
});
