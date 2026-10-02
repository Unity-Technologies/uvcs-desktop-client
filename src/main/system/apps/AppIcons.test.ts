import { describe, expect, it, vi } from 'vitest';
import { AppIcons } from './AppIcons';

const thumbnails = () => vi.fn(async (path: string) => (path.includes('Missing') ? undefined : `data:image/png;base64,${path}`));

describe('AppIcons', () => {
  it("shows a macOS program's bundle icon, read once for every program in it", async () => {
    const thumbnail = thumbnails();
    const icons = new AppIcons('darwin', thumbnail);
    expect(await icons.of('/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code')).toBe('data:image/png;base64,/Applications/Visual Studio Code.app');
    expect(await icons.of('/Applications/Visual Studio Code.app')).toBe('data:image/png;base64,/Applications/Visual Studio Code.app');
    expect(thumbnail).toHaveBeenCalledTimes(1);
  });

  it("shows a Windows program's own icon, and none for a .cmd launcher, which has only a file's", async () => {
    const icons = new AppIcons('win32', thumbnails());
    expect(await icons.of('C:\\Program Files\\KDiff3\\bin\\kdiff3.exe')).toBe('data:image/png;base64,C:\\Program Files\\KDiff3\\bin\\kdiff3.exe');
    expect(await icons.of('C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd')).toBeUndefined();
  });

  it('shows none on Linux, or when the OS has none to give or fails', async () => {
    const thumbnail = thumbnails();
    expect(await new AppIcons('linux', thumbnail).of('/usr/bin/meld')).toBeUndefined();
    expect(thumbnail).not.toHaveBeenCalled();
    expect(await new AppIcons('darwin', thumbnail).of('/Applications/Missing.app')).toBeUndefined();
    expect(await new AppIcons('darwin', vi.fn().mockRejectedValue(new Error('no thumbnail'))).of('/Applications/Zed.app')).toBeUndefined();
  });

  it('adds the icon to an item, or leaves it as it is', async () => {
    const icons = new AppIcons('darwin', thumbnails());
    expect(await icons.withIcon<{ id: string; icon?: string }>({ id: 'zed' }, '/Applications/Zed.app')).toEqual({ id: 'zed', icon: 'data:image/png;base64,/Applications/Zed.app' });
    expect(await icons.withIcon<{ id: string; icon?: string }>({ id: 'gone' }, '/Applications/Missing.app')).toEqual({ id: 'gone' });
  });
});
