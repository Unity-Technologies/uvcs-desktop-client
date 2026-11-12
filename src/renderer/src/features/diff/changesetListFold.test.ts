import { describe, expect, it } from 'vitest';
import { askedOpen, changesetFoldLabel, listIsOpen, toggledFold } from './changesetListFold';

describe('listIsOpen', () => {
  it('is folded unless the user left it open or the page asked for changesets', () => {
    expect(listIsOpen({ remembered: false, asked: false })).toBe(false);
    expect(listIsOpen({ remembered: true, asked: false })).toBe(true);
    expect(listIsOpen({ remembered: false, asked: true })).toBe(true);
  });
});

describe('askedOpen', () => {
  it('opens for a changeset or a span asked for, never for all the changes', () => {
    expect(askedOpen({ kind: 'all' })).toBe(false);
    expect(askedOpen({ kind: 'changeset', changesetId: 5 })).toBe(true);
    expect(askedOpen({ kind: 'span', span: { oldest: 5, newest: 9 } })).toBe(true);
  });
});

describe('toggledFold', () => {
  it('opens and remembers it', () => {
    expect(toggledFold({ remembered: false, asked: false })).toEqual({ fold: { remembered: true, asked: false }, showsAll: false });
  });

  it('folds, remembered, and goes back to all the changes: nothing hidden stays selected', () => {
    expect(toggledFold({ remembered: false, asked: true })).toEqual({ fold: { remembered: false, asked: false }, showsAll: true });
    expect(toggledFold({ remembered: true, asked: false })).toEqual({ fold: { remembered: false, asked: false }, showsAll: true });
  });
});

describe('changesetFoldLabel', () => {
  it('names the changesets, and counts them once read', () => {
    expect(changesetFoldLabel(undefined)).toBe('Changesets');
    expect(changesetFoldLabel(13)).toBe('13 changesets');
    expect(changesetFoldLabel(1)).toBe('1 changeset');
  });
});

describe('changesetFoldLabel, at the limit', () => {
  it('says there are more when the read was cut at its limit', () => {
    expect(changesetFoldLabel(4, 4)).toBe('4+ changesets');
  });
});
