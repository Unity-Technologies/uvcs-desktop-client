import { describe, expect, it } from 'vitest';
import { serverAccount, unityAccount } from '../../testing/userAccounts';
import { homeAccountOf, homeServersOf, sectionAfterSwitch } from './homeAccount';
import { WELCOME } from './homeSection';

const ana = unityAccount('ana@example.com', ['acme@unity', 'codice@cloud'], { wildcard: true });
const bo = unityAccount('bo@example.com', ['games@unity']);
const build = serverAccount('build:8087');
const accounts = [ana, bo, build];

describe('homeAccountOf', () => {
  it('shows the account signing in to every other organization (`*@cloud`) when nothing names one', () => {
    const many = unityAccount('cy@example.com', ['a@unity', 'b@unity', 'c@unity']);
    expect(homeAccountOf([bo, many, ana], {})).toBe(ana);
  });

  it('else shows the one holding the most organizations, the first of them on a tie', () => {
    const many = unityAccount('cy@example.com', ['a@unity', 'b@unity']);
    expect(homeAccountOf([bo, many, build], {})).toBe(many);
    expect(homeAccountOf([bo, unityAccount('dee@example.com', ['d@unity'])], {})).toBe(bo);
    expect(homeAccountOf([build, bo], {})).toBe(bo);
  });

  it('shows none without a Unity account', () => {
    expect(homeAccountOf([build], {})).toBeUndefined();
    expect(homeAccountOf([], { remembered: ana.id })).toBeUndefined();
  });

  it('shows the account last picked', () => {
    expect(homeAccountOf(accounts, { remembered: bo.id })).toBe(bo);
  });

  it('shows the account of the workspace the window left before the one last picked', () => {
    expect(homeAccountOf(accounts, { openedFrom: 'Games@unity', remembered: ana.id })).toBe(bo);
  });

  it('keeps the account last picked when the workspace left is on this computer or a server', () => {
    expect(homeAccountOf(accounts, { openedFrom: 'local', remembered: bo.id })).toBe(bo);
    expect(homeAccountOf(accounts, { openedFrom: 'build:8087', remembered: bo.id })).toBe(bo);
  });

  it('takes a workspace on an organization no account lists for the account signing in to every organization', () => {
    expect(homeAccountOf(accounts, { openedFrom: 'other@cloud', remembered: bo.id })).toBe(ana);
  });

  it('shows the account picked in this window before the workspace it left', () => {
    expect(homeAccountOf(accounts, { picked: ana.id, openedFrom: 'games@unity' })).toBe(ana);
  });

  it('shows the account holding the repositories on screen before any other', () => {
    expect(homeAccountOf(accounts, { shownServer: 'games@unity', picked: ana.id })).toBe(bo);
  });

  it('passes over a server on screen that no Unity account holds, and an account gone since it was picked', () => {
    expect(homeAccountOf(accounts, { shownServer: 'build:8087', picked: bo.id })).toBe(bo);
    expect(homeAccountOf(accounts, { picked: 'cloud:gone@example.com', remembered: bo.id })).toBe(bo);
  });
});

describe('homeServersOf', () => {
  const servers = (shown = homeAccountOf(accounts, {})) => homeServersOf(accounts, shown).map(({ server, user }) => [server, user]);

  it("lists this computer, the shown account's organizations and every server, each with its user", () => {
    expect(servers(ana)).toEqual([
      ['local', ''],
      ['acme@unity', 'ana@example.com'],
      ['codice@cloud', 'ana@example.com'],
      ['build:8087', 'jsmith'],
    ]);
  });

  it("leaves the other accounts' organizations out", () => {
    expect(servers(bo)).toEqual([
      ['local', ''],
      ['games@unity', 'bo@example.com'],
      ['build:8087', 'jsmith'],
    ]);
  });

  it('lists this computer and the servers without a Unity account', () => {
    expect(homeServersOf([build], undefined).map((profile) => profile.server)).toEqual(['local', 'build:8087']);
    expect(homeServersOf([], undefined).map((profile) => profile.server)).toEqual(['local']);
  });
});

describe('sectionAfterSwitch', () => {
  it('leaves the repositories of the account left for the welcome', () => {
    expect(sectionAfterSwitch({ kind: 'server', server: 'acme@unity' }, bo, accounts)).toEqual(WELCOME);
  });

  it('stays on repositories the new account holds, whatever the case a link wrote them in', () => {
    expect(sectionAfterSwitch({ kind: 'server', server: 'Games@Unity' }, bo, accounts)).toEqual({ kind: 'server', server: 'Games@Unity' });
  });

  it('stays on an organization named by its genesis id when the account holds it by name', () => {
    const genesis = { name: '1375488836673@cloud', server: 'tools@unity', user: 'cy@example.com', workingMode: 'SSOWorkingMode' };
    const cy = { ...unityAccount('cy@example.com', ['tools@unity']), profiles: [genesis] };
    const section = { kind: 'server', server: '1375488836673@unity' } as const;

    expect(homeAccountOf([ana, cy], { shownServer: section.server })).toBe(cy);
    expect(sectionAfterSwitch(section, cy, [ana, cy])).toEqual(section);
  });

  it('stays when the shown account is picked again, an organization it reaches through `*@cloud` too', () => {
    expect(sectionAfterSwitch({ kind: 'server', server: 'other@cloud' }, ana, accounts)).toEqual({ kind: 'server', server: 'other@cloud' });
    expect(sectionAfterSwitch({ kind: 'server', server: 'other@cloud' }, bo, accounts)).toEqual(WELCOME);
  });

  it('stays on this computer, a server, the welcome or every workspace', () => {
    expect(sectionAfterSwitch({ kind: 'server', server: 'build:8087' }, bo, accounts)).toEqual({ kind: 'server', server: 'build:8087' });
    expect(sectionAfterSwitch({ kind: 'server', server: 'local' }, bo, accounts)).toEqual({ kind: 'server', server: 'local' });
    expect(sectionAfterSwitch({ kind: 'all' }, bo, accounts)).toEqual({ kind: 'all' });
    expect(sectionAfterSwitch(WELCOME, bo, accounts)).toEqual(WELCOME);
  });
});
