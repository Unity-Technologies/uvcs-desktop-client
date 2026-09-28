import { describe, expect, it } from 'vitest';
import { loadedChangesetOf, parseWorkspaceStatus, selectorName } from './workspaceStatus';

describe('selectorName', () => {
  it('removes the repository spec even when the name repeats in the server', () => {
    expect(selectorName('/main/scm1008833@codice@codice@cloud', 'codice', 'codice@cloud')).toBe('/main/scm1008833');
  });

  it('removes a local repository spec', () => {
    expect(selectorName('/main@sandbox@local', 'sandbox', 'local')).toBe('/main');
  });

  it('keeps names without a repository suffix', () => {
    expect(selectorName('/main', 'sandbox', 'local')).toBe('/main');
  });
});

describe('parseWorkspaceStatus', () => {
  const header = `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus><Status><RepSpec><Server>codice@cloud</Server><Name>codice</Name></RepSpec><Changeset>278638</Changeset></Status></WorkspaceStatus>
  <WkConfigType>Branch</WkConfigType>
  <WkConfigName>/main/SCM1008897@codice@codice@cloud</WkConfigName>
</StatusOutput>`;

  it('reads the repository, the selector and the loaded changeset', () => {
    expect(parseWorkspaceStatus(header)).toEqual({
      repositoryName: 'codice',
      server: 'codice@cloud',
      selector: { kind: 'branch', name: '/main/SCM1008897' },
      loadedChangeset: 278638,
    });
  });

  // `cm status --header --xml` of a workspace switched to shelve 3 (cm 11.0.16.10371, a local server).
  const onShelve = `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus>
    <Status>
      <RepSpec>
        <Server>local</Server>
        <Name>uvcs-shelvews-sandbox</Name>
      </RepSpec>
      <Changeset>-3</Changeset>
    </Status>
  </WorkspaceStatus>
  <WkConfigType>Shelve</WkConfigType>
  <WkConfigName>3@uvcs-shelvews-sandbox@local</WkConfigName>
</StatusOutput>`;

  it('reads a workspace on a shelve as loading no changeset: cm numbers the shelve as changeset -3', () => {
    expect(parseWorkspaceStatus(onShelve)).toEqual({
      repositoryName: 'uvcs-shelvews-sandbox',
      server: 'local',
      selector: { kind: 'shelve', name: '3' },
      loadedChangeset: null,
    });
  });

  it('fails on a changeset below zero that is not the shelve loaded, rather than query from it', () => {
    expect(() => parseWorkspaceStatus(onShelve.replace('<Changeset>-3', '<Changeset>-2'))).toThrow(/cm status/);
    expect(() => parseWorkspaceStatus(header.replace('278638', '-1'))).toThrow(/cm status/);
    expect(() => parseWorkspaceStatus(header.replace('278638', '-2'))).toThrow(/cm status/);
    expect(() => parseWorkspaceStatus(onShelve.replace('<Changeset>-3', '<Changeset>3'))).toThrow(/cm status/);
  });

  it('fails on output without a status, instead of returning an empty branch and changeset -1', () => {
    expect(() => parseWorkspaceStatus('')).toThrow(/cm status/);
    expect(() => parseWorkspaceStatus('<StatusOutput><WkConfigType>Branch</WkConfigType></StatusOutput>')).toThrow(/cm status/);
    expect(() => parseWorkspaceStatus(header.replace('<Changeset>278638</Changeset>', ''))).toThrow(/cm status/);
  });
});

describe('loadedChangesetOf', () => {
  it("takes a shelve's negated id as no changeset, anything else below zero as unexpected", () => {
    expect(loadedChangesetOf(12, { kind: 'label', name: 'v1' })).toBe(12);
    expect(loadedChangesetOf(0, { kind: 'branch', name: '/main' })).toBe(0);
    expect(loadedChangesetOf(-1, { kind: 'shelve', name: '1' })).toBeNull();
    expect(loadedChangesetOf(-5, { kind: 'changeset', name: '-5' })).toBeUndefined();
    expect(loadedChangesetOf(Number.NaN, { kind: 'shelve', name: '3' })).toBeUndefined();
  });
});
