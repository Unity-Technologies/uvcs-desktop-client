import { describe, expect, it } from 'vitest';
import { isDeveloperIdSigned } from './macSignature';

describe('isDeveloperIdSigned', () => {
  it('reads a Developer ID signature from codesign', () => {
    const signed = [
      'Executable=/Applications/Unity Version Control.app/Contents/MacOS/Unity Version Control',
      'Authority=Developer ID Application: Unity Technologies (ABCDE12345)',
      'Authority=Developer ID Certification Authority',
      'Authority=Apple Root CA',
    ].join('\n');
    expect(isDeveloperIdSigned(signed)).toBe(true);
  });

  it('tells an ad-hoc signature, which Squirrel.Mac rejects', () => {
    expect(isDeveloperIdSigned('Identifier=Electron\nCodeDirectory v=20400 flags=0x20002(adhoc,linker-signed)\nSignature=adhoc')).toBe(false);
  });

  it('tells a development signature, which Gatekeeper refuses on other Macs', () => {
    expect(isDeveloperIdSigned('Authority=Apple Development: ana@unity.com (XYZ)')).toBe(false);
  });
});
