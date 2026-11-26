import { describe, expect, it } from 'vitest';
import { parseOrganizationId, type OrganizationId } from '@shared/domain/stableIds';
import { organizationsFollowed, organizationsToIdentify, type OrganizationsKept } from './organizationsKept';

const ACME = parseOrganizationId('1375943370549')!;
const ARCADE = parseOrganizationId('1375488836673')!;

function kept({ favorites = [], servers = {} }: { favorites?: string[]; servers?: OrganizationsKept['serverSettings'] }): OrganizationsKept {
  return { favoriteOrganizations: favorites, serverSettings: servers };
}

const ids = (entries: Record<string, OrganizationId>): ReadonlyMap<string, OrganizationId> => new Map(Object.entries(entries));

describe('organizationsToIdentify', () => {
  it('reads nothing while no organization keeps anything', () => {
    expect(organizationsToIdentify(kept({}), ['acme@unity', 'arcade@unity'])).toEqual([]);
  });

  it('reads the id of an organization that keeps something and has none recorded, as a favorite or a setting', () => {
    const state = kept({ favorites: ['Acme@unity'], servers: { 'arcade@unity': { homeProject: 'Racing' } } });
    expect(organizationsToIdentify(state, ['Acme@unity', 'arcade@unity', 'kart@unity'])).toEqual(['Acme@unity', 'arcade@unity']);
  });

  it('once one recorded its id, reads those that keep nothing: one may be a renamed organization', () => {
    const state = kept({ servers: { 'acme@unity': { homeProject: 'Racing', organizationId: ACME } } });
    expect(organizationsToIdentify(state, ['acme@unity', 'acme-studio@unity'])).toEqual(['acme-studio@unity']);
  });

  it('reads no server that is no Unity organization', () => {
    const state = kept({ favorites: ['games@cloud', 'host:8087'], servers: { 'acme@unity': { organizationId: ACME } } });
    expect(organizationsToIdentify(state, ['games@cloud', 'host:8087', 'local'])).toEqual([]);
  });
});

describe('organizationsFollowed', () => {
  it("records the id of an organization that keeps something, under the name it's kept by", () => {
    const state = kept({ favorites: ['Acme@unity'], servers: { 'arcade@unity': { homeProject: 'Racing' } } });

    expect(organizationsFollowed(state, ids({ 'Acme@unity': ACME, 'arcade@unity': ARCADE }))).toEqual({
      favoriteOrganizations: ['Acme@unity'],
      serverSettings: { 'acme@unity': { organizationId: ACME }, 'arcade@unity': { homeProject: 'Racing', organizationId: ARCADE } },
    });
  });

  it('moves what a renamed organization kept, its favorite too, to its new name', () => {
    const state = kept({ favorites: ['Acme@unity', 'arcade@unity'], servers: { 'acme@unity': { homeProject: 'Racing', organizationId: ACME } } });

    expect(organizationsFollowed(state, ids({ 'AcmeStudio@unity': ACME }))).toEqual({
      favoriteOrganizations: ['arcade@unity', 'AcmeStudio@unity'],
      serverSettings: { 'acmestudio@unity': { homeProject: 'Racing', organizationId: ACME } },
    });
  });

  it('keeps what the new name kept already over what the former one did', () => {
    const state = kept({ servers: { 'acme@unity': { homeProject: 'Racing', organizationId: ACME }, 'acmestudio@unity': { homeProject: 'Kart' } } });

    expect(organizationsFollowed(state, ids({ 'acmestudio@unity': ACME }))?.serverSettings).toEqual({ 'acmestudio@unity': { homeProject: 'Kart', organizationId: ACME } });
  });

  it('changes nothing for an organization with its id recorded, or one that keeps nothing and was never renamed', () => {
    const state = kept({ servers: { 'acme@unity': { homeProject: 'Racing', organizationId: ACME } } });

    expect(organizationsFollowed(state, ids({ 'acme@unity': ACME, 'arcade@unity': ARCADE }))).toBeNull();
    expect(organizationsFollowed(state, ids({}))).toBeNull();
  });
});
