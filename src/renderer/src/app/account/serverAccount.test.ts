import { describe, expect, it } from 'vitest';
import type { Account } from '@shared/domain/account';
import { accountForServer, cloudDashboardUrl, organizationName, signInMethod } from './serverAccount';

const account = (name: string, server = name, user = 'me@acme.com'): Account => ({ name, server, user, workingMode: 'SSOWorkingMode' });

const wildcard = account('*@cloud', '*@cloud', 'wildcard@acme.com');
const genesis = account('1375488836673@cloud', 'acme@unity');
const legacy = account('libra4d@cloud');
const onPremises = account('ssl://host:8088', 'ssl://host:8088', 'dev');
const accounts = [wildcard, genesis, legacy, onPremises];

describe('accountForServer', () => {
  it('uses the server’s own profile, whatever case it is written in', () => {
    expect(accountForServer(accounts, 'LIBRA4D@cloud')).toBe(legacy);
    expect(accountForServer(accounts, 'ssl://host:8088')).toBe(onPremises);
  });

  it('matches a cloud organization by its name or its genesis id', () => {
    expect(accountForServer(accounts, 'acme@cloud')).toBe(genesis);
    expect(accountForServer(accounts, '1375488836673@unity')).toBe(genesis);
  });

  it('falls back to *@cloud for other cloud organizations, and to nothing on premises', () => {
    expect(accountForServer(accounts, 'other@cloud')).toBe(wildcard);
    expect(accountForServer(accounts, 'other:8087')).toBeUndefined();
  });
});

describe('organizationName', () => {
  it('prefers the readable name over the genesis id', () => {
    expect(organizationName('1375488836673@cloud', genesis)).toBe('acme');
    expect(organizationName('other@cloud', wildcard)).toBe('other');
    expect(organizationName('ssl://host:8088', onPremises)).toBeNull();
  });
});

describe('cloudDashboardUrl', () => {
  it('opens the organization when its genesis id is known, else lets the dashboard pick it', () => {
    expect(cloudDashboardUrl('acme@unity', genesis)).toBe(
      'https://cloud.unity.com/home/organizations/1375488836673/projects/default/plastic-scm/organizations',
    );
    expect(cloudDashboardUrl('libra4d@cloud', legacy)).toBe('https://cloud.unity.com/home/organizations/default/plastic-scm/organizations');
  });
});

describe('signInMethod', () => {
  it('names known working modes and trims unknown ones', () => {
    expect(signInMethod('LDAPWorkingMode')).toBe('LDAP');
    expect(signInMethod('OIDCWorkingMode')).toBe('OIDC');
  });
});
