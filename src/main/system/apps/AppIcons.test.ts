import { describe, expect, it, vi } from 'vitest';
import { AppIcons } from './AppIcons';

const images = () => vi.fn(async (path: string) => (path.includes('Missing') ? undefined : `data:image/png;base64,${path}`));
const readers = (thumbnail = images(), fileIcon = images()) => ({ thumbnail, fileIcon });

describe('AppIcons', () => {
  it("shows a macOS program's bundle icon, read once for every program in it", async () => {
    const read = readers();
    const icons = new AppIcons('darwin', read);
    expect(await icons.of('/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code')).toBe('data:image/png;base64,/Applications/Visual Studio Code.app');
    expect(await icons.of('/Applications/Visual Studio Code.app')).toBe('data:image/png;base64,/Applications/Visual Studio Code.app');
    expect(read.thumbnail).toHaveBeenCalledTimes(1);
    expect(read.fileIcon).not.toHaveBeenCalled();
  });

  it("shows a Windows program's own icon as the shell draws it, which has no thumbnail for programs", async () => {
    const read = readers(vi.fn().mockRejectedValue(new Error('Failed to get thumbnail from local thumbnail cache reference')));
    const icons = new AppIcons('win32', read);
    expect(await icons.of('C:\\Program Files\\KDiff3\\bin\\kdiff3.exe')).toBe('data:image/png;base64,C:\\Program Files\\KDiff3\\bin\\kdiff3.exe');
    expect(read.thumbnail).not.toHaveBeenCalled();
  });

  it("shows none for a Windows .cmd launcher, which has only a file's icon", async () => {
    const icons = new AppIcons('win32', readers());
    expect(await icons.of('C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd')).toBeUndefined();
  });

  it('shows none on Linux, or when the OS has none to give or fails', async () => {
    const read = readers();
    expect(await new AppIcons('linux', read).of('/usr/bin/meld')).toBeUndefined();
    expect(read.thumbnail).not.toHaveBeenCalled();
    expect(read.fileIcon).not.toHaveBeenCalled();
    expect(await new AppIcons('darwin', read).of('/Applications/Missing.app')).toBeUndefined();
    expect(await new AppIcons('darwin', readers(vi.fn().mockRejectedValue(new Error('no thumbnail')))).of('/Applications/Zed.app')).toBeUndefined();
    expect(await new AppIcons('win32', readers(images(), vi.fn().mockRejectedValue(new Error('no icon')))).of('C:\\Tools\\meld.exe')).toBeUndefined();
  });

  it('adds the icon to an item, or leaves it as it is', async () => {
    const icons = new AppIcons('darwin', readers());
    expect(await icons.withIcon<{ id: string; icon?: string }>({ id: 'zed' }, '/Applications/Zed.app')).toEqual({ id: 'zed', icon: 'data:image/png;base64,/Applications/Zed.app' });
    expect(await icons.withIcon<{ id: string; icon?: string }>({ id: 'gone' }, '/Applications/Missing.app')).toEqual({ id: 'gone' });
  });
});
