import { describe, expect, it } from 'vitest';
import { repositoryPillText } from './repositoryPillText';

describe('repositoryPillText', () => {
  it('names a repository of this computer as the home screen does', () => {
    expect(repositoryPillText('workspace-kinds@local')).toEqual({
      name: 'workspace-kinds',
      where: 'This computer',
      tip: 'workspace-kinds · This computer',
    });
  });

  it('names a cloud repository by its organization', () => {
    expect(repositoryPillText('game@acme@cloud')).toEqual({ name: 'game', where: 'acme', tip: 'game · acme' });
  });

  it('names an on-premises repository by its server', () => {
    expect(repositoryPillText('game@host:8087')).toEqual({ name: 'game', where: 'host:8087', tip: 'game · host:8087' });
  });
});
