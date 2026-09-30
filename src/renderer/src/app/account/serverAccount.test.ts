import { describe, expect, it } from 'vitest';
import type { Account } from '@shared/domain/account';
import { accountForServer, cloudDashboardUrl, lockRulesUrl, organizationName, signInMethod } from './serverAccount';

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

describe('lockRulesUrl', () => {
  const DASHBOARD = 'https://cloud.unity.com/home/organizations';

  it('opens the organization’s lock rules in the dashboard, under its genesis id when known', () => {
    expect(lockRulesUrl('acme@unity', genesis)).toBe(`${DASHBOARD}/1375488836673/projects/default/plastic-scm/organizations/1375488836673/lock-rules`);
    expect(lockRulesUrl('1375488836673@cloud')).toBe(`${DASHBOARD}/1375488836673/projects/default/plastic-scm/organizations/1375488836673/lock-rules`);
  });

  it('names an organization without a genesis id, escaped, and lets the dashboard find it', () => {
    expect(lockRulesUrl('libra4d@cloud', legacy)).toBe(`${DASHBOARD}/default/plastic-scm/organizations/libra4d/lock-rules`);
    expect(lockRulesUrl('my org@cloud')).toBe(`${DASHBOARD}/default/plastic-scm/organizations/my%20org/lock-rules`);
  });

  it('opens an on-premises server’s web admin on its host, whatever its protocol and port', () => {
    expect(lockRulesUrl('ssl://host:8088', onPremises)).toBe('http://host:7178/configuration/lock-rules');
    expect(lockRulesUrl('tcp://build.acme.lan:8087')).toBe('http://build.acme.lan:7178/configuration/lock-rules');
    expect(lockRulesUrl('localhost:8087')).toBe('http://localhost:7178/configuration/lock-rules');
    expect(lockRulesUrl('host')).toBe('http://host:7178/configuration/lock-rules');
    expect(lockRulesUrl('[::1]:8087')).toBe('http://[::1]:7178/configuration/lock-rules');
  });

  it('has no page for the local server, or for no organization in particular', () => {
    expect(lockRulesUrl('local')).toBeNull();
    expect(lockRulesUrl('*@cloud', wildcard)).toBeNull();
  });
});

describe('signInMethod', () => {
  it('names known working modes and trims unknown ones', () => {
    expect(signInMethod('LDAPWorkingMode')).toBe('LDAP');
    expect(signInMethod('OIDCWorkingMode')).toBe('OIDC');
  });
});
