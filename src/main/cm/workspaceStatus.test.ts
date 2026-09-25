import { describe, expect, it } from 'vitest';
import { parseWorkspaceStatus, selectorName } from './workspaceStatus';

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

  it('fails on output without a status, instead of returning an empty branch and changeset -1', () => {
    expect(() => parseWorkspaceStatus('')).toThrow(/cm status/);
    expect(() => parseWorkspaceStatus('<StatusOutput><WkConfigType>Branch</WkConfigType></StatusOutput>')).toThrow(/cm status/);
  });
});
