import { describe, expect, it } from 'vitest';
import { cmCandidates, findInstalledCm } from './findInstalledCm';

const found = (...paths: string[]) => (path: string) => paths.includes(path);

describe('findInstalledCm', () => {
  it('prefers the PATH, then where the installers put it', () => {
    const env = { PATH: '/usr/bin:/usr/local/bin' };
    expect(findInstalledCm('linux', env, found('/usr/local/bin/cm', '/opt/plasticscm5/client/cm'))).toBe('/usr/local/bin/cm');
    expect(findInstalledCm('linux', { PATH: '/bin' }, found('/opt/plasticscm5/client/cm'))).toBe('/opt/plasticscm5/client/cm');
    expect(findInstalledCm('darwin', { PATH: '/usr/bin:/bin' }, found('/Applications/PlasticSCM.app/Contents/Applications/cm.app/Contents/MacOS/cm'))).toBe(
      '/Applications/PlasticSCM.app/Contents/Applications/cm.app/Contents/MacOS/cm',
    );
  });

  it('finds cm.exe on the Windows Path, quoted folders and all, then in Program Files', () => {
    const env = { Path: 'C:\\Windows;"C:\\Tools;Old";C:\\Program Files\\PlasticSCM5\\client', ProgramFiles: 'C:\\Program Files' };
    expect(findInstalledCm('win32', env, found('C:\\Tools;Old\\cm.exe'))).toBe('C:\\Tools;Old\\cm.exe');
    expect(findInstalledCm('win32', { Path: 'C:\\Windows' }, found('C:\\Program Files (x86)\\PlasticSCM5\\client\\cm.exe'))).toBe(
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

  it('finds none when no cm is installed', () => {
    expect(findInstalledCm('win32', {}, found())).toBeNull();
    expect(findInstalledCm('linux', {}, found())).toBeNull();
  });
});
