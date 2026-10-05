import { describe, expect, it } from 'vitest';
import { spawnCommand } from './spawnCommand';

describe('spawnCommand', () => {
  it('runs programs directly, and Windows .cmd launchers through cmd.exe with every argument quoted', () => {
    expect(spawnCommand('darwin', '/bin/tool', ['a b'])).toEqual({ command: '/bin/tool', commandArgs: ['a b'], verbatim: false });
    expect(spawnCommand('win32', 'C:\\VS Code\\bin\\code.cmd', ['--wait', 'C:\\Users\\R&D\\a^b "x".ts', 'Yours (%PATH%!)', 'C:\\t\\'])).toEqual({
      command: 'cmd.exe',
      commandArgs: ['/d', '/s', '/c', '""C:\\VS Code\\bin\\code.cmd" "--wait" "C:\\Users\\R&D\\a^b x.ts" "Yours (PATH)" "C:\\t\\\\""'],
      verbatim: true,
    });
  });
});
