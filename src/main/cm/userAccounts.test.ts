import { describe, expect, it } from 'vitest';
import { readAccount } from './accounts';
import { formatOutput, recordsIn } from './testing/cmOutput';
import { userAccountsOf } from './userAccounts';

/** `cm profile list --format=…` as it prints each profile: its name, server, user and working mode. */
const profilesPrinted = (...profiles: [server: string, user: string, workingMode: string][]) =>
  recordsIn(formatOutput(...profiles.map(([server, user, workingMode]) => [server, server, user, workingMode])), readAccount);

const summary = (accounts: ReturnType<typeof userAccountsOf>) => accounts.map(({ id, user, kind, servers }) => ({ id, user, kind, servers }));

describe('userAccountsOf', () => {
  it('makes one Unity account of each user, holding their organizations of both kinds', () => {
    const profiles = profilesPrinted(
      ['danipen_unity@unity', 'ana@example.com', 'SSOWorkingMode'],
      ['codice@cloud', 'ana@example.com', 'SSOWorkingMode'],
      ['libra4d@cloud', 'bo@example.com', 'LDAPWorkingMode'],
    );

    expect(summary(userAccountsOf(profiles))).toEqual([
      { id: 'cloud:ana@example.com', user: 'ana@example.com', kind: 'cloud', servers: ['danipen_unity@unity', 'codice@cloud'] },
      { id: 'cloud:bo@example.com', user: 'bo@example.com', kind: 'cloud', servers: ['libra4d@cloud'] },
    ]);
  });

  it('takes one email in any case for one user, named as its first profile writes it', () => {
    const profiles = profilesPrinted(['acme@unity', 'Ana@Example.com', 'SSOWorkingMode'], ['codice@cloud', 'ana@example.com', 'SSOWorkingMode']);

    expect(summary(userAccountsOf(profiles))).toEqual([{ id: 'cloud:ana@example.com', user: 'Ana@Example.com', kind: 'cloud', servers: ['acme@unity', 'codice@cloud'] }]);
  });

  it('makes an account of a `*@cloud` profile alone, with no organization listed', () => {
    const accounts = userAccountsOf(profilesPrinted(['*@cloud', 'ana@example.com', 'SSOWorkingMode']));

    expect(summary(accounts)).toEqual([{ id: 'cloud:ana@example.com', user: 'ana@example.com', kind: 'cloud', servers: [] }]);
    expect(accounts[0]!.profiles.map((profile) => profile.server)).toEqual(['*@cloud']);
  });

  it('keeps the `*@cloud` profile among the account’s profiles, never among its organizations', () => {
    const [account] = userAccountsOf(profilesPrinted(['*@cloud', 'ana@example.com', 'SSOWorkingMode'], ['acme@unity', 'ana@example.com', 'SSOWorkingMode']));

    expect(account!.servers).toEqual(['acme@unity']);
    expect(account!.profiles.map((profile) => profile.name)).toEqual(['*@cloud', 'acme@unity']);
  });

  it('makes two accounts of one user on Unity Cloud and on a server', () => {
    const profiles = profilesPrinted(['build.acme.com:8087', 'ana', 'UPWorkingMode'], ['acme@unity', 'ana', 'SSOWorkingMode']);

    expect(summary(userAccountsOf(profiles))).toEqual([
      { id: 'cloud:ana', user: 'ana', kind: 'cloud', servers: ['acme@unity'] },
      { id: 'server:build.acme.com:8087', user: 'ana', kind: 'server', servers: ['build.acme.com:8087'] },
    ]);
  });

  it('makes each server an account of its own, with how it signs in', () => {
    const accounts = userAccountsOf(profilesPrinted(['ssl://build:8088', 'jsmith', 'LDAPWorkingMode'], ['art:8087', 'jsmith', 'UPWorkingMode']));

    expect(accounts.map(({ id, workingMode }) => [id, workingMode])).toEqual([
      ['server:art:8087', 'UPWorkingMode'],
      ['server:ssl://build:8088', 'LDAPWorkingMode'],
    ]);
  });

  it('leaves this computer out of every account', () => {
    expect(userAccountsOf(profilesPrinted(['local', 'ana@example.com', 'SSOWorkingMode']))).toEqual([]);
  });

  it('puts Unity accounts first, each kind by name whatever its case', () => {
    const profiles = profilesPrinted(
      ['zeta:8087', 'z', 'UPWorkingMode'],
      ['acme@unity', 'bo@example.com', 'SSOWorkingMode'],
      ['Alpha:8087', 'a', 'UPWorkingMode'],
      ['acme@cloud', 'Ana@example.com', 'SSOWorkingMode'],
    );

    expect(userAccountsOf(profiles).map((account) => account.id)).toEqual(['cloud:ana@example.com', 'cloud:bo@example.com', 'server:Alpha:8087', 'server:zeta:8087']);
  });

  it('has no account without profiles', () => {
    expect(userAccountsOf([])).toEqual([]);
  });
});
