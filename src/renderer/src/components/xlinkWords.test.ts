import { describe, expect, it } from 'vitest';
import { xlinkKind, xlinkRepository, xlinkSummary } from './xlinkWords';

const readOnly = { writable: false, path: '/', changeset: 17568, repository: 'thirdparty', server: 'acme@cloud' };

describe('How an xlink is named', () => {
  it('says whether it takes changes', () => {
    expect(xlinkKind(readOnly)).toBe('Read-only xlink');
    expect(xlinkKind({ writable: true })).toBe('Writable xlink');
  });

  it('names its repository with the server, and the folder it shows when not the root', () => {
    expect(xlinkRepository(readOnly)).toBe('thirdparty@acme@cloud');
    expect(xlinkRepository({ ...readOnly, path: '/testprograms' })).toBe('thirdparty@acme@cloud /testprograms');
    expect(xlinkRepository({ ...readOnly, server: '' })).toBe('thirdparty');
  });

  it('sums it up in one line for a details pane', () => {
    expect(xlinkSummary({ ...readOnly, writable: true })).toBe('Writable xlink to thirdparty@acme@cloud at cs:17568');
  });
});
