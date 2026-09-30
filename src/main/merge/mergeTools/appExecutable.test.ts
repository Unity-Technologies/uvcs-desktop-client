import { describe, expect, it } from 'vitest';
import { appExecutable } from './appExecutable';

describe('appExecutable', () => {
  const fs = (files: Record<string, string>) => ({
    exists: (path: string) => path in files,
    list: (folder: string) => Object.keys(files).filter((path) => path.startsWith(`${folder}/`)).map((path) => path.slice(folder.length + 1)),
    read: (path: string) => files[path] ?? null,
  });

  it('runs a macOS app’s declared program', () => {
    const plist = '<plist><dict><key>CFBundleExecutable</key>\n<string>p4merge</string></dict></plist>';
    expect(appExecutable('/Applications/P4.app', fs({ '/Applications/P4.app/Contents/Info.plist': plist, '/Applications/P4.app/Contents/MacOS/p4merge': '' }))).toBe(
      '/Applications/P4.app/Contents/MacOS/p4merge',
    );
  });

  it('falls back to the program named like the app, and takes other programs as they are', () => {
    expect(appExecutable('/Applications/Tool.app/', fs({ '/Applications/Tool.app/Contents/MacOS/Tool': '' }))).toBe('/Applications/Tool.app/Contents/MacOS/Tool');
    expect(appExecutable('/usr/local/bin/tool', fs({}))).toBe('/usr/local/bin/tool');
  });
});
