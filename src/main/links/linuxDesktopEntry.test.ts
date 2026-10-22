import { describe, expect, it } from 'vitest';
import { linuxDesktopEntry, mayWriteDesktopEntry } from './linuxDesktopEntry';

describe('linuxDesktopEntry', () => {
  it('runs the AppImage as the handler of uvcs:// links, hidden from the menus', () => {
    expect(linuxDesktopEntry('/home/ana/Apps/UnityVersionControl.AppImage', 'Unity Version Control')).toBe(
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Unity Version Control',
        'Exec="/home/ana/Apps/UnityVersionControl.AppImage" --uvcs-link -- %u',
        'MimeType=x-scheme-handler/uvcs;',
        'NoDisplay=true',
        'Terminal=false',
        'X-UVCS-Desktop-Managed=true',
        '',
      ].join('\n'),
    );
  });

  it('quotes a path holding spaces and the characters the Exec key escapes', () => {
    const entry = linuxDesktopEntry('/home/ana/My "Apps"/$HOME/100%/a\\b`c.AppImage', 'Unity Version Control');
    expect(entry).toContain('Exec="/home/ana/My \\"Apps\\"/\\$HOME/100%%/a\\\\b\\`c.AppImage" --uvcs-link -- %u');
  });
});

describe('mayWriteDesktopEntry', () => {
  it("writes one where there is none, or rewrites the app's own", () => {
    expect(mayWriteDesktopEntry(null)).toBe(true);
    expect(mayWriteDesktopEntry(linuxDesktopEntry('/old/place.AppImage', 'Unity Version Control'))).toBe(true);
    expect(mayWriteDesktopEntry('[Desktop Entry]\r\nName=x\r\nX-UVCS-Desktop-Managed=true\r\n')).toBe(true);
  });

  it("never touches a package's or another tool's entry", () => {
    expect(mayWriteDesktopEntry('[Desktop Entry]\nName=Unity Version Control\nExec=/opt/uvcs/uvcs-desktop %U\n')).toBe(false);
  });
});
