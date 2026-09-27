import { describe, expect, it } from 'vitest';
import { serverFilePolicyText } from './serverFilePolicyText';

const labels = { source: '/main/source', destination: '/main/target' };

describe('serverFilePolicyText', () => {
  it('asks for one version for all the conflicting files', () => {
    expect(serverFilePolicyText('docs/a.md', 3, labels, undefined)).toEqual({
      title: 'docs/a.md changed on both sides',
      explanation: "Server merges can't combine files: keep one version for all 3 conflicting files, or merge in a workspace to combine them.",
      keep: { destination: 'Keep /main/target for all', source: 'Keep /main/source for all' },
    });
    expect(serverFilePolicyText('docs/a.md', 3, labels, 'source').title).toBe('Keeping /main/source for every conflicting file');
  });

  it('never says "all 1 conflicting file"', () => {
    expect(serverFilePolicyText('docs/a.md', 1, labels, 'destination')).toEqual({
      title: 'Keeping /main/target',
      explanation: "Server merges can't combine files: keep one version, or merge in a workspace to combine them.",
      keep: { destination: 'Keep /main/target', source: 'Keep /main/source' },
    });
  });
});
