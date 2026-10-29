import { describe, expect, it } from 'vitest';
import { readLegacyOpenWith } from './openWithConf';

describe('readLegacyOpenWith', () => {
  it('reads each program by its menu name, without its shortcut or arguments', () => {
    const conf = ['[Notepad++|Ctrl+Shift+N] "C:\\Program Files\\Notepad++\\notepad++.exe" @file', '[Sublime] "/Applications/Sublime Text.app" @file'].join('\r\n');
    expect(readLegacyOpenWith(conf)).toEqual([
      { name: 'Notepad++', executable: 'C:\\Program Files\\Notepad++\\notepad++.exe' },
      { name: 'Sublime', executable: '/Applications/Sublime Text.app' },
    ]);
  });

  it('reads a program written without arguments', () => {
    expect(readLegacyOpenWith('[Hex editor] "/usr/bin/ghex"')).toEqual([{ name: 'Hex editor', executable: '/usr/bin/ghex' }]);
  });

  it('reads a name holding brackets', () => {
    expect(readLegacyOpenWith('[Editor [beta]] "/opt/editor" @file')).toEqual([{ name: 'Editor [beta]', executable: '/opt/editor' }]);
  });

  it('skips a line with no name or no program', () => {
    expect(readLegacyOpenWith(['[] "/usr/bin/ghex" @file', '[Name] "" @file', 'garbage', ''].join('\n'))).toEqual([]);
  });
});
