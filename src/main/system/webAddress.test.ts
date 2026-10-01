import { describe, expect, it } from 'vitest';
import { isWebAddress } from './webAddress';

describe('isWebAddress', () => {
  it('accepts the web pages the app links to: docs, issue forms, the Cloud dashboard, an on-premises server', () => {
    expect(isWebAddress('https://docs.unity.com/en-us/unity-version-control')).toBe(true);
    expect(isWebAddress('https://github.com/Unity-Technologies/uvcs-desktop-client/issues/new?template=bug_report.yml')).toBe(true);
    expect(isWebAddress('http://build-server:7178/configuration/lock-rules')).toBe(true);
    expect(isWebAddress('HTTPS://Example.com')).toBe(true);
  });

  it('refuses whatever else the OS would open: files, programs, other apps\' schemes', () => {
    expect(isWebAddress('file:///Applications/Calculator.app')).toBe(false);
    expect(isWebAddress('file://C:/Windows/System32/calc.exe')).toBe(false);
    expect(isWebAddress('smb://attacker/share/payload.exe')).toBe(false);
    expect(isWebAddress('ms-msdt:/id PCWDiagnostic')).toBe(false);
    expect(isWebAddress('javascript:alert(1)')).toBe(false);
    expect(isWebAddress('plastic://acme.cloud/repos/game/changesets/12/diff')).toBe(false);
  });

  it('refuses text that is not an address', () => {
    expect(isWebAddress('')).toBe(false);
    expect(isWebAddress('docs.unity.com')).toBe(false);
    expect(isWebAddress('C:\\Windows\\System32\\calc.exe')).toBe(false);
  });
});
