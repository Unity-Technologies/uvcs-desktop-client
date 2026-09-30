import { describe, expect, it } from 'vitest';
import { change } from './testing/cmOutput';
import { parseWorkspaceGlance } from './workspaceGlance';

const status = (changes: string) => `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus><Status><RepSpec><Server>codice@cloud</Server><Name>codice</Name></RepSpec><Changeset>42</Changeset></Status></WorkspaceStatus>
  <WkConfigType>Branch</WkConfigType>
  <WkConfigName>/main/task-12@codice@codice@cloud</WkConfigName>
  <Changes>${changes}</Changes>
</StatusOutput>`;

describe('parseWorkspaceGlance', () => {
  it('reads the repository, the branch and how many files are pending', () => {
    expect(parseWorkspaceGlance(status(change('CH', 'a.txt') + change('PR', 'new.txt')))).toEqual({
      repository: 'codice@codice@cloud',
      selector: { kind: 'branch', name: '/main/task-12' },
      pendingCount: 2,
    });
  });

  it('counts a moved and changed file once', () => {
    expect(parseWorkspaceGlance(status(change('MV', 'b.txt') + change('CH', 'b.txt'))).pendingCount).toBe(1);
  });

  it('reads a clean workspace', () => {
    expect(parseWorkspaceGlance(status('')).pendingCount).toBe(0);
  });
});
