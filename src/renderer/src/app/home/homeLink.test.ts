import { describe, expect, it } from 'vitest';
import { homeLink } from './homeLink';

describe('homeLink', () => {
  it("links to an organization's repositories, and to the project picked in it", () => {
    expect(homeLink({ kind: 'server', server: 'acme@unity' }, null)).toBe('uvcs://acme.unity');
    expect(homeLink({ kind: 'server', server: 'acme@unity' }, 'Cloud Repositories')).toBe('uvcs://acme.unity/projects/Cloud%20Repositories');
    expect(homeLink({ kind: 'server', server: 'local' }, null)).toBe('uvcs://local');
  });

  it('links to nothing only this computer has: the welcome and every workspace', () => {
    expect(homeLink({ kind: 'welcome' }, null)).toBeNull();
    expect(homeLink({ kind: 'all' }, null)).toBeNull();
  });
});
