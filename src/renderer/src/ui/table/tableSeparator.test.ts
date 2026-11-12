import { describe, expect, it } from 'vitest';
import { placeOfRow, rowAtPlace, separatorIndexOf } from './tableSeparator';

const keys = ['17', '16', '15', '14'];

describe('separatorIndexOf', () => {
  it('is the index of the row the separator goes before', () => {
    expect(separatorIndexOf(keys, '15')).toBe(2);
    expect(separatorIndexOf(keys, '17')).toBe(0);
  });

  it('is none without a separator, or for a row the table no longer shows (a filter hides it)', () => {
    expect(separatorIndexOf(keys, undefined)).toBe(-1);
    expect(separatorIndexOf(keys, '9')).toBe(-1);
  });
});

describe('placeOfRow and rowAtPlace', () => {
  it('put the rows from the separator on one place further down', () => {
    expect([0, 1, 2, 3].map((row) => placeOfRow(row, 2))).toEqual([0, 1, 3, 4]);
    expect([0, 1, 2, 3, 4].map((place) => rowAtPlace(place, 2))).toEqual([0, 1, null, 2, 3]);
  });

  it('leave the rows where they are without a separator', () => {
    expect([0, 1, 2].map((row) => placeOfRow(row, -1))).toEqual([0, 1, 2]);
    expect([0, 1, 2].map((place) => rowAtPlace(place, -1))).toEqual([0, 1, 2]);
  });

  it('take a separator before the first row as the first place', () => {
    expect(rowAtPlace(0, 0)).toBeNull();
    expect(placeOfRow(0, 0)).toBe(1);
  });
});
