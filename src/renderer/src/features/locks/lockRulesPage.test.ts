import { describe, expect, it } from 'vitest';
import { lockRulesPage } from './lockRulesPage';

describe('lockRulesPage', () => {
  it('says the rules open in the dashboard for a cloud organization', () => {
    expect(lockRulesPage('acme@cloud')).toEqual({
      url: 'https://cloud.unity.com/home/organizations/default/plastic-scm/organizations/acme/lock-rules',
      tip: 'Choose which files lock when someone checks them out, in the Unity Cloud dashboard',
    });
  });

  it("says the rules open in the web admin for an on-premises server", () => {
    expect(lockRulesPage('ssl://host:8088')).toEqual({
      url: 'http://host:7178/configuration/lock-rules',
      tip: "Choose which files lock when someone checks them out, in the server's web admin",
    });
  });

  it('offers nothing for the local server', () => {
    expect(lockRulesPage('local')).toBeNull();
  });
});
