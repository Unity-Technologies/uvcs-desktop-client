import { describe, expect, it } from 'vitest';
import { isLinkLaunch, linkArgument } from './linkArgument';

const LINK = 'uvcs://acme.unity/repos/game/changesets/12';

describe('linkArgument', () => {
  it("takes the link after the handler's separator, as Windows and the Linux desktop entry run it", () => {
    expect(linkArgument(['C:\\Apps\\Unity Version Control.exe', '--uvcs-link', '--', LINK])).toBe(LINK);
    expect(linkArgument(['/tmp/UnityVersionControl.AppImage', '--uvcs-link', '--', LINK])).toBe(LINK);
  });

  it('takes it among the switches Chromium adds to a second launch, in any case', () => {
    const argv = ['C:\\Apps\\uvcs.exe', '--allow-file-access-from-files', '--uvcs-link', '--original-process-start-time=1', '--', 'UVCS:///C:/wk/game'];
    expect(linkArgument(argv)).toBe('UVCS:///C:/wk/game');
  });

  it('reads nothing after the separator but the link: a switch there is no switch', () => {
    expect(linkArgument(['uvcs.exe', '--uvcs-link', '--', '--inspect=9229'])).toBeNull();
    expect(linkArgument(['uvcs.exe', '--uvcs-link', LINK])).toBeNull();
  });

  it('takes a link given as any argument: a development run', () => {
    expect(linkArgument(['/opt/electron', '.', LINK])).toBe(LINK);
  });

  it('is nothing when the launch names no link', () => {
    expect(linkArgument(['/opt/uvcs/uvcs-desktop', '/home/ana/wk'])).toBeNull();
    expect(linkArgument(['C:\\Apps\\uvcs.exe'])).toBeNull();
  });
});

describe('isLinkLaunch', () => {
  it("is a launch for a link, even one whose link can't be read", () => {
    expect(isLinkLaunch(['uvcs.exe', '--uvcs-link', '--', LINK])).toBe(true);
    expect(isLinkLaunch(['uvcs.exe', '--uvcs-link', '--', 'C:\\wk'])).toBe(true);
    expect(isLinkLaunch(['/opt/electron', '.', LINK])).toBe(true);
    expect(isLinkLaunch(['uvcs.exe', 'C:\\wk'])).toBe(false);
  });
});
