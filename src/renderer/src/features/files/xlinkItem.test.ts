import { describe, expect, it } from 'vitest';
import { detailsKindOf, iconTypeOf, xlinkDetailOf } from './xlinkItem';

const xlink = { writable: true, path: '/', changeset: 27649, repository: 'pnunit', server: 'codice@cloud' };

describe('An xlink in Files', () => {
  it('draws as an xlink, though it lists as a directory', () => {
    expect(iconTypeOf({ itemType: 'directory', xlink })).toBe('xlink');
    expect(iconTypeOf({ itemType: 'directory' })).toBe('directory');
    expect(iconTypeOf({ itemType: 'binaryFile' })).toBe('binaryFile');
  });

  it('is headed as a diff names it; other items by what they are', () => {
    expect(detailsKindOf({ itemType: 'directory', xlink })).toEqual({ icon: 'xlink', noun: 'Writable xlink' });
    expect(detailsKindOf({ itemType: 'directory' })).toEqual({ icon: 'directory', noun: 'Folder' });
    expect(detailsKindOf({ itemType: 'symlink' })).toEqual({ icon: 'symlink', noun: 'Link' });
    expect(detailsKindOf({ itemType: 'binaryFile' })).toEqual({ icon: 'file', noun: 'File' });
  });

  it("says where it points from the listing, else as cm fileinfo words it", () => {
    expect(xlinkDetailOf({ xlink }, { xlinkTarget: 'other words' })).toBe('Writable xlink to pnunit@codice@cloud at cs:27649');
    expect(xlinkDetailOf({}, { xlinkTarget: 'wxlink:/@12@lib@local' })).toBe('wxlink:/@12@lib@local');
    expect(xlinkDetailOf({}, undefined)).toBeUndefined();
  });
});
