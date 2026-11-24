import { describe, expect, it } from 'vitest';
import { authenticodeVerdict, pkgutilVerdict } from './installerSignature';

/** What `authenticodeCheck`'s script prints for the Windows installer downloaded from the site (11.0.16.10694). */
const UNITY_SIGNED = [
  'Status=Valid',
  'Subject=CN=Unity Technologies SF, O=Unity Technologies SF, L=San Francisco, S=California, C=US, SERIALNUMBER=3183233, OID.2.5.4.15=Private Organization, OID.1.3.6.1.4.1.311.60.2.1.2=California, OID.1.3.6.1.4.1.311.60.2.1.3=US',
  '',
].join('\r\n');

/** `pkgutil --check-signature` on the macOS installer downloaded from the site (11.0.16.10694, Apple silicon). */
const PKGUTIL_TRUSTED = `Package "unity-vcs-osx-arm64-11.0.16.10694.pkg":
   Status: signed by a developer certificate issued by Apple for distribution
   Notarization: trusted by the Apple notary service
   Signed with a trusted timestamp on: 2026-11-17 23:57:41 +0000
   Certificate Chain:
    1. Developer ID Installer: Codice Software (BQ7R3Y4J72)
       Expires: 2027-02-01 22:12:15 +0000
       SHA256 Fingerprint:
           37 97 97 E1 AA 40 F4 30 4A D7 94 73 B9 05 DE 36 80 64 EE 8E 0F 1D 
           A0 5E D4 99 A6 C2 28 75 80 FC
       ------------------------------------------------------------------------
    2. Developer ID Certification Authority
       Expires: 2027-02-01 22:12:15 +0000
       SHA256 Fingerprint:
           7A FC 9D 01 A6 2F 03 A2 DE 96 37 93 6D 4A FE 68 09 0D 2D E1 8D 03 
           F2 9C 88 CF B0 B1 BA 63 58 7F
       ------------------------------------------------------------------------
    3. Apple Root CA
       Expires: 2035-02-09 21:40:36 +0000
`;

describe('authenticodeVerdict', () => {
  it("trusts an installer Windows finds validly signed by Unity's certificate", () => {
    expect(authenticodeVerdict(UNITY_SIGNED)).toEqual({ trusted: true });
  });

  it("refuses one whose signature Windows doesn't find valid", () => {
    for (const status of ['NotSigned', 'HashMismatch', 'NotTrusted', 'UnknownError']) {
      expect(authenticodeVerdict(UNITY_SIGNED.replace('Status=Valid', `Status=${status}`))).toEqual({ trusted: false, why: `Its signature is ${status}` });
    }
  });

  it('refuses one validly signed by anyone else, even under a name that starts the same', () => {
    expect(authenticodeVerdict('Status=Valid\r\nSubject=CN=Someone Else, O=Someone Else\r\n')).toEqual({ trusted: false, why: 'It is signed by CN=Someone Else, O=Someone Else' });
    expect(authenticodeVerdict('Status=Valid\r\nSubject=CN=Unity Technologies SF Imitations, O=Unity Technologies SF\r\n').trusted).toBe(false);
    expect(authenticodeVerdict('Status=Valid\r\nSubject=CN=Unity Technologies SF, O=Someone Else\r\n').trusted).toBe(false);
  });

  it('refuses an answer it cannot read', () => {
    expect(authenticodeVerdict('')).toEqual({ trusted: false, why: 'Its signature is unknown' });
  });
});

describe('pkgutilVerdict', () => {
  it("trusts a package signed for distribution with Unity's Developer ID and notarized", () => {
    expect(pkgutilVerdict(PKGUTIL_TRUSTED)).toEqual({ trusted: true });
  });

  it("refuses one Apple hasn't notarized", () => {
    const verdict = pkgutilVerdict(PKGUTIL_TRUSTED.replace(/ {3}Notarization:.*\n/, ''));
    expect(verdict).toEqual({ trusted: false, why: 'It is not notarized by Apple' });
  });

  it('refuses one signed by any other developer, or not for distribution', () => {
    expect(pkgutilVerdict(PKGUTIL_TRUSTED.replace('Codice Software (BQ7R3Y4J72)', 'Codice Software (ABCDE12345)'))).toEqual({
      trusted: false,
      why: 'It is signed by Developer ID Installer: Codice Software (ABCDE12345)',
    });
    expect(pkgutilVerdict(PKGUTIL_TRUSTED.replace('issued by Apple for distribution', 'issued by Apple (Development)')).trusted).toBe(false);
  });

  it('refuses an unsigned package, as pkgutil prints it', () => {
    expect(pkgutilVerdict('Package "x.pkg":\n   Status: no signature\n')).toEqual({ trusted: false, why: 'Its signature is no signature' });
  });
});
