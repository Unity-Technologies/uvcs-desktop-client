import { describe, expect, it } from 'vitest';
import { serverAccount, unityAccount } from '../../testing/userAccounts';
import { accountRowsOf } from './accountRows';

const ana = unityAccount('ana@example.com', ['codice@cloud', 'Acme@unity'], { wildcard: true });
const bo = unityAccount('bo@example.com', ['games@unity']);
const build = serverAccount('build:8087');
const accounts = [ana, bo, build];

describe('accountRowsOf', () => {
  it('has one row per account, saying what it is and how many organizations a Unity account holds', () => {
    expect(accountRowsOf(accounts, undefined).map((row) => [row.account.user, row.detail, row.inUse])).toEqual([
      ['ana@example.com', 'Unity · 2 organizations', false],
      ['bo@example.com', 'Unity · 1 organization', false],
      ['jsmith', 'build:8087 · User and password', false],
    ]);
  });

  it('says only Unity for an account known by its `*@cloud` profile alone', () => {
    expect(accountRowsOf([unityAccount('cy@example.com', [], { wildcard: true })], undefined)[0]!.detail).toBe('Unity');
  });

  it("puts the account signing in to the window's place first, marked", () => {
    expect(accountRowsOf(accounts, 'games@unity').map((row) => [row.account.user, row.inUse])).toEqual([
      ['bo@example.com', true],
      ['ana@example.com', false],
      ['jsmith', false],
    ]);
    expect(accountRowsOf(accounts, 'build:8087')[0]!.account).toBe(build);
  });

  it('marks none for a place no account signs in to', () => {
    expect(accountRowsOf(accounts, 'local').some((row) => row.inUse)).toBe(false);
  });

  it("lists an account's organizations by name, whatever the case, then the profile for every other organization", () => {
    expect(accountRowsOf(accounts, undefined)[0]!.servers.map(({ label, profile }) => [label, profile.name])).toEqual([
      ['Acme', 'Acme@unity'],
      ['codice', 'codice@cloud'],
      ['Any cloud organization', '*@cloud'],
    ]);
  });

  it('names an organization by its readable name, never its genesis id, and finds its account by either', () => {
    const genesis = { name: 'tools@unity', server: '1375488836673@cloud', user: 'cy@example.com', workingMode: 'SSOWorkingMode' };
    const cy = { ...unityAccount('cy@example.com', ['1375488836673@cloud']), profiles: [genesis] };

    const [row] = accountRowsOf([ana, cy], 'tools@unity');
    expect(row!.account).toBe(cy);
    expect(row!.servers.map(({ label }) => label)).toEqual(['tools']);
  });

  it("opens a Unity account's row to its organizations, and lets a server's row stand for its one server", () => {
    const [anaRow, , buildRow] = accountRowsOf(accounts, undefined);

    expect(anaRow!.expands).toBe(true);
    expect(buildRow!.expands).toBe(false);
    expect(buildRow!.servers.map(({ label, profile }) => [label, profile.name])).toEqual([['build:8087', 'build:8087']]);
  });
});
