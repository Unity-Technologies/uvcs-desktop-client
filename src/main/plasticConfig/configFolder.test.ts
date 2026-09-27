import { describe, expect, it } from 'vitest';
import { plasticConfigFolder } from './configFolder';

describe('plasticConfigFolder', () => {
  it("is the user's plastic4 folder: in Local AppData on Windows, hidden in the home folder elsewhere", () => {
    expect(plasticConfigFolder('win32', { LOCALAPPDATA: 'C:\\Users\\ana\\AppData\\Local' }, 'C:\\Users\\ana')).toBe('C:\\Users\\ana\\AppData\\Local\\plastic4');
    expect(plasticConfigFolder('win32', {}, 'C:\\Users\\ana')).toBe('C:\\Users\\ana\\AppData\\Local\\plastic4');
    expect(plasticConfigFolder('darwin', {}, '/Users/ana')).toBe('/Users/ana/.plastic4');
    expect(plasticConfigFolder('linux', {}, '/home/ana')).toBe('/home/ana/.plastic4');
  });

  it('is PLASTIC_HOME when set, as for the official client', () => {
    expect(plasticConfigFolder('linux', { PLASTIC_HOME: '/srv/plastic' }, '/home/ana')).toBe('/srv/plastic');
  });
});
