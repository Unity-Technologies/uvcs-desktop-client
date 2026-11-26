import { posix, win32 } from 'node:path';
import { describe, expect, it } from 'vitest';
import { officialEditionOf } from './officialEdition';

const existing = (...paths: string[]) => (path: string) => paths.includes(path);

describe('officialEditionOf', () => {
  const WINDOWS_CM = win32.join('C:\\Program Files', 'PlasticSCM5', 'client', 'cm.exe');

  it('reads the edition on Windows from the marker next to cm.exe', () => {
    expect(officialEditionOf(WINDOWS_CM, 'win32', existing(win32.join('C:\\Program Files', 'PlasticSCM5', 'client', 'cloudedition.token')))).toBe('cloud');
    expect(officialEditionOf(WINDOWS_CM, 'win32', existing(win32.join('C:\\Program Files', 'PlasticSCM5', 'client', 'dvcs.token')))).toBe('dvcs');
  });

  it('takes no marker for the enterprise edition, client-only and full alike', () => {
    expect(officialEditionOf(WINDOWS_CM, 'win32', existing())).toBe('enterprise');
  });

  it('looks inside the app bundle on macOS, wherever cm sits in it', () => {
    const app = '/Applications/PlasticSCM.app';
    const cm = posix.join(app, 'Contents/Applications/cm.app/Contents/MacOS/cm');
    expect(officialEditionOf(cm, 'darwin', existing(posix.join(app, 'Contents/Applications/cm.app/Contents/MacOS/cloudedition.token')))).toBe('cloud');
    expect(officialEditionOf(cm, 'darwin', existing(posix.join(app, 'Contents/MonoBundle/cloudedition.token')))).toBe('cloud');
    expect(officialEditionOf(posix.join(app, 'Contents/MacOS/cm'), 'darwin', existing(posix.join(app, 'Contents/Applications/cm.app/Contents/MacOS/dvcs.token')))).toBe('dvcs');
  });

  it('looks next to cm on macOS when it sits in no app bundle', () => {
    expect(officialEditionOf('/opt/uvcs/cm', 'darwin', existing('/opt/uvcs/cloudedition.token'))).toBe('cloud');
  });

  it('takes the Cloud marker first when both are there', () => {
    const folder = '/opt/plasticscm5/client';
    expect(officialEditionOf(`${folder}/cm`, 'linux', existing(`${folder}/dvcs.token`, `${folder}/cloudedition.token`))).toBe('cloud');
  });

  it('keeps spaces and accents in the paths it checks', () => {
    const cm = win32.join('D:\\Programas de José', 'Unity VCS', 'client', 'cm.exe');
    expect(officialEditionOf(cm, 'win32', existing(win32.join('D:\\Programas de José', 'Unity VCS', 'client', 'cloudedition.token')))).toBe('cloud');
  });
});
