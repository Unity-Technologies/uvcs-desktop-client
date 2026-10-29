import { describe, expect, it } from 'vitest';
import { expandEnvironment } from './expandEnvironment';

describe('expandEnvironment', () => {
  it('reads %VAR% on every OS, as the official client did', () => {
    expect(expandEnvironment('%TOOLS%/post.sh', { TOOLS: '/opt/tools' }, 'linux')).toBe('/opt/tools/post.sh');
  });

  it("ignores the case of Windows' names, and only there", () => {
    expect(expandEnvironment('%ProgramFiles%\\Tool\\tool.exe', { PROGRAMFILES: 'C:\\Program Files' }, 'win32')).toBe('C:\\Program Files\\Tool\\tool.exe');
    expect(expandEnvironment('%ProgramFiles%/tool', { PROGRAMFILES: '/x' }, 'darwin')).toBe('%ProgramFiles%/tool');
  });

  it('leaves a variable not set as written', () => {
    expect(expandEnvironment('%MISSING%\\tool.exe', {}, 'win32')).toBe('%MISSING%\\tool.exe');
  });
});
