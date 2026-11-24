import { describe, expect, it } from 'vitest';
import { noOrganizationMatches, sidebarFilter, typedFilterFor } from './sidebarFilter';
import { serverGroups } from './serverGroups';

const profile = (server: string) => ({ server, user: 'ana', workingMode: 'SSOWorkingMode' });
const many = Array.from({ length: 10 }, (_, index) => profile(`org${index}@cloud`));
const typed = { account: 'ana', text: 'core' };

describe('sidebarFilter', () => {
  it('shows with ten organizations or more, filtering by what was typed for the shown account', () => {
    expect(sidebarFilter({ servers: many, reading: false, rail: false, account: 'ana', typed })).toEqual({ shows: true, text: 'core' });
  });

  it('shows none, and filters nothing, under ten organizations, while reading them, or folded', () => {
    const hidden = { shows: false, text: '' };
    expect(sidebarFilter({ servers: many.slice(1), reading: false, rail: false, account: 'ana', typed })).toEqual(hidden);
    expect(sidebarFilter({ servers: many, reading: true, rail: false, account: 'ana', typed })).toEqual(hidden);
    expect(sidebarFilter({ servers: many, reading: false, rail: true, account: 'ana', typed })).toEqual(hidden);
  });

  it("doesn't apply text typed for another account", () => {
    expect(sidebarFilter({ servers: many, reading: false, rail: false, account: 'zoe', typed }).text).toBe('');
  });
});

describe('typedFilterFor', () => {
  it('keeps the text while the account stays', () => {
    expect(typedFilterFor(typed, 'ana')).toBe(typed);
  });

  it('empties it for another account, so going back finds it empty too', () => {
    const other = typedFilterFor(typed, 'zoe');
    expect(other).toEqual({ account: 'zoe', text: '' });
    expect(typedFilterFor(other, 'ana')).toEqual({ account: 'ana', text: '' });
  });
});

describe('noOrganizationMatches', () => {
  it('says so when the filter leaves no organization, even with this computer still listed', () => {
    const servers = [profile('local'), profile('acme@unity')];
    expect(noOrganizationMatches(serverGroups(servers, { filter: 'zzz' }))).toBe(true);
    expect(noOrganizationMatches(serverGroups(servers, { filter: 'ac' }))).toBe(false);
  });
});
