import { describe, expect, it } from 'vitest';
import { describeXlink } from './describeXlink';

describe('describeXlink', () => {
  it('names the repository and changeset, then what kind of xlink it is and what it shows', () => {
    expect(describeXlink({ writable: false, path: '/', changeset: 17568, repository: 'thirdparty', server: 'acme@cloud' })).toEqual({
      label: 'Xlink to thirdparty@17568',
      detail: 'Read-only · thirdparty@acme@cloud, changeset 17568',
    });
    expect(describeXlink({ writable: true, path: '/testprograms', changeset: 3, repository: 'lib', server: 'local' }).detail).toBe(
      'Writable: changes under it are checked in to that repository · lib@local, changeset 3 · shows /testprograms',
    );
  });
});
