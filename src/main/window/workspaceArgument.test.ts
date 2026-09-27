import { describe, expect, it } from 'vitest';
import { workspaceArgument } from './workspaceArgument';

describe('workspaceArgument', () => {
  it('takes the folder named after the executable, from where it was run', () => {
    expect(workspaceArgument(['C:\\Apps\\UVCS\\Unity Version Control.exe', 'D:\\Work\\Game'], 'C:\\Users\\ana', 'win32')).toBe('D:\\Work\\Game');
    expect(workspaceArgument(['C:\\Apps\\UVCS\\Unity Version Control.exe', 'Game'], 'D:\\Work', 'win32')).toBe('D:\\Work\\Game');
    expect(workspaceArgument(['/opt/uvcs/uvcs-desktop', '../wk'], '/home/ana/tmp', 'linux')).toBe('/home/ana/wk');
  });

  it("skips the switches Chromium adds to a second launch's arguments", () => {
    const argv = ['C:\\Apps\\uvcs.exe', '\\\\server\\share\\wk', '--allow-file-access-from-files', '--original-process-start-time=1'];
    expect(workspaceArgument(argv, 'C:\\', 'win32')).toBe('\\\\server\\share\\wk');
  });

  it('is nothing when the launch names no folder', () => {
    expect(workspaceArgument(['/opt/uvcs/uvcs-desktop', '--no-sandbox'], '/home/ana', 'linux')).toBeNull();
    expect(workspaceArgument(['C:\\Apps\\uvcs.exe'], 'C:\\', 'win32')).toBeNull();
  });
});
