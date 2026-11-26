import { describe, expect, it } from 'vitest';
import { parseOrganizationId, type OrganizationId } from '@shared/domain/stableIds';
import { organizationsFollowed, organizationsToIdentify, organizationsToSearch, type OrganizationsKept } from './organizationsKept';

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

  it('reads again the id of each name that recorded one, listed or not, and none of the organizations that keep nothing', () => {
    const state = kept({ servers: { 'acme@unity': { homeProject: 'Racing', organizationId: ACME }, 'arcade@unity': { organizationId: ARCADE } } });
    expect(organizationsToIdentify(state, ['acme@unity', 'kart@unity', 'racers@unity'])).toEqual(['acme@unity', 'arcade@unity']);
  });

  it('reads no server that is no Unity organization', () => {
    const state = kept({ favorites: ['games@cloud', 'host:8087'] });
    expect(organizationsToIdentify(state, ['games@cloud', 'host:8087', 'local'])).toEqual([]);
  });

  it("doesn't count a recorded id as something kept", () => {
    expect(organizationsToIdentify(kept({ servers: { 'acme@unity': { organizationId: ACME } } }), ['kart@unity'])).toEqual(['acme@unity']);
  });
});

describe('organizationsToSearch', () => {
  const state = kept({ servers: { 'acme@unity': { homeProject: 'Racing', organizationId: ACME } }, favorites: ['arcade@unity'] });
  const listed = ['acme@unity', 'arcade@unity', 'acmestudio@unity', 'kart@unity', 'games@cloud'];

  it('reads nothing more while every recorded name answers its id', () => {
    expect(organizationsToSearch(state, listed, new Map([['acme@unity', ACME], ['arcade@unity', ARCADE]]))).toEqual([]);
  });

  it("reads the listed organizations not read yet with no id recorded once a recorded name doesn't answer it (cm forgot the old name)", () => {
    expect(organizationsToSearch(state, listed, new Map([['acme@unity', undefined], ['arcade@unity', ARCADE]]))).toEqual(['acmestudio@unity', 'kart@unity']);
  });

  it('reads them too when a recorded name answers another id', () => {
    expect(organizationsToSearch(state, listed, new Map([['ACME@unity', ARCADE]]))).toEqual(['arcade@unity', 'acmestudio@unity', 'kart@unity']);
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
