import { describe, expect, it } from 'vitest';
import { changesetLink } from './plasticLink';

describe('changesetLink', () => {
  it('links a cloud changeset, the organization joined to cloud with a dot', () => {
    expect(changesetLink('codice', 'codice@cloud', 273075)).toBe('plastic://codice.cloud/repos/codice/changesets/273075/diff');
  });

  it('keeps on-premises and local servers as they are', () => {
    expect(changesetLink('game', 'skull:9095', 4)).toBe('plastic://skull:9095/repos/game/changesets/4/diff');
    expect(changesetLink('game', 'local', 4)).toBe('plastic://local/repos/game/changesets/4/diff');
  });

  it('encodes the repository name, spaces as +', () => {
    expect(changesetLink('My repo+1', 'local', 4)).toBe('plastic://local/repos/My+repo%2B1/changesets/4/diff');
  });

  it('links a range', () => {
    expect(changesetLink('codice', 'codice@cloud', 45, 41)).toBe('plastic://codice.cloud/repos/codice/changesets/41..45/diff');
  });
});
