import { describe, expect, it } from 'vitest';
import { parseStatusHeader } from './workspaceRepositories';

describe('parseStatusHeader', () => {
  it('reads the repository spec', () => {
    expect(parseStatusHeader('STATUS|25076|plasticscm.com|codice@cloud\n')).toBe('plasticscm.com@codice@cloud');
  });

  it('accepts workspaces without a loaded changeset', () => {
    expect(parseStatusHeader('STATUS|-1|ImageDiffTest|local')).toBe('ImageDiffTest@local');
  });

  it('returns null for anything else', () => {
    expect(parseStatusHeader('/tmp is not in a workspace.')).toBeNull();
  });
});
