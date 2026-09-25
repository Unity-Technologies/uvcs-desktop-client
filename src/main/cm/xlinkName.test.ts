import { describe, expect, it } from 'vitest';
import { parseXlinkName } from './xlinkName';

describe('parseXlinkName', () => {
  it('reads a writable relative xlink', () => {
    expect(parseXlinkName('02nervathirdparty -> wxlink -> / 17568@nervathirdparty@ [relative] codice@cloud')).toEqual({
      writable: true,
      path: '/',
      changeset: 17568,
      repository: 'nervathirdparty',
      server: 'codice@cloud',
    });
  });

  it('reads a read-only xlink to a subdirectory of a nested repository', () => {
    expect(parseXlinkName('docs -> xlink -> /testprograms 5218@documentation/taskdocumentation@ [relative] codice@cloud')).toEqual({
      writable: false,
      path: '/testprograms',
      changeset: 5218,
      repository: 'documentation/taskdocumentation',
      server: 'codice@cloud',
    });
  });

  it('reads an xlink with the server in its spec', () => {
    expect(parseXlinkName('lib -> xlink -> / 12@lib@localhost:8087')).toMatchObject({ repository: 'lib', server: 'localhost:8087', changeset: 12 });
  });

  it('is undefined for plain names, even with an arrow in them', () => {
    expect(parseXlinkName('01plastic')).toBeUndefined();
    expect(parseXlinkName('a -> b.txt')).toBeUndefined();
  });
});
