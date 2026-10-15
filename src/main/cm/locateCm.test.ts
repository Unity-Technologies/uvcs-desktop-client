import { describe, expect, it } from 'vitest';
import { cmCandidates, locateCm } from './locateCm';

const found = (...paths: string[]) => (path: string) => paths.includes(path);

describe('locateCm', () => {
  it('takes UVCS_CM_PATH as it is', () => {
    expect(locateCm('win32', { UVCS_CM_PATH: 'D:\\tools\\cm.exe' }, found())).toBe('D:\\tools\\cm.exe');
  });

  it('prefers the PATH, then where the installers put it', () => {
    const env = { PATH: '/usr/bin:/usr/local/bin' };
    expect(locateCm('linux', env, found('/usr/local/bin/cm', '/opt/plasticscm5/client/cm'))).toBe('/usr/local/bin/cm');
    expect(locateCm('linux', { PATH: '/bin' }, found('/opt/plasticscm5/client/cm'))).toBe('/opt/plasticscm5/client/cm');
    expect(locateCm('darwin', { PATH: '/usr/bin:/bin' }, found('/Applications/PlasticSCM.app/Contents/Applications/cm.app/Contents/MacOS/cm'))).toBe(
      '/Applications/PlasticSCM.app/Contents/Applications/cm.app/Contents/MacOS/cm',
    );
  });

  it('finds cm.exe on the Windows Path, quoted folders and all, then in Program Files', () => {
    const env = { Path: 'C:\\Windows;"C:\\Tools;Old";C:\\Program Files\\PlasticSCM5\\client', ProgramFiles: 'C:\\Program Files' };
    expect(locateCm('win32', env, found('C:\\Tools;Old\\cm.exe'))).toBe('C:\\Tools;Old\\cm.exe');
    expect(locateCm('win32', { Path: 'C:\\Windows' }, found('C:\\Program Files (x86)\\PlasticSCM5\\client\\cm.exe'))).toBe(
      'C:\\Program Files (x86)\\PlasticSCM5\\client\\cm.exe',
    );
    expect(cmCandidates('win32', { Path: '', ProgramFiles: 'D:\\Apps', LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' })).toEqual([
      'D:\\Apps\\PlasticSCM5\\client\\cm.exe',
      'D:\\Apps\\Unity VCS\\client\\cm.exe',
      'C:\\Program Files (x86)\\PlasticSCM5\\client\\cm.exe',
      'C:\\Program Files (x86)\\Unity VCS\\client\\cm.exe',
      'C:\\Users\\me\\AppData\\Local\\Programs\\PlasticSCM5\\client\\cm.exe',
      'C:\\Users\\me\\AppData\\Local\\Programs\\Unity VCS\\client\\cm.exe',
    ]);
  });

  it('falls back to the bare name, so starting it says it was not found', () => {
    expect(locateCm('win32', {}, found())).toBe('cm.exe');
    expect(locateCm('linux', {}, found())).toBe('cm');
  });
});
