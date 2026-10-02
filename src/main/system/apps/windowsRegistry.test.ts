import { describe, expect, it } from 'vitest';
import { appPaths, expandVariables, parseRegistryExport, uninstallEntries } from './windowsRegistry';

/** `C:\Windows` as REG_EXPAND_SZ bytes: `%SystemRoot%\x.exe` in UTF-16, null-terminated. */
const expandHex = [...Buffer.from('%SystemRoot%\\x.exe\0', 'utf16le')].map((byte) => byte.toString(16).padStart(2, '0'));

const EXPORT = [
  '\uFEFFWindows Registry Editor Version 5.00',
  '',
  '[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{771FD6B0-FA20-440A-A002-3B3BAC16DC50}_is1]',
  '"DisplayName"="Microsoft Visual Studio Code (User)"',
  '"Publisher"="Microsoft Corporation"',
  '"InstallLocation"="C:\\\\Users\\\\Jösé\\\\AppData\\\\Local\\\\Programs\\\\Microsoft VS Code\\\\"',
  '"DisplayIcon"="C:\\\\Users\\\\Jösé\\\\AppData\\\\Local\\\\Programs\\\\Microsoft VS Code\\\\Code.exe"',
  '"EstimatedSize"=dword:00058c3e',
  '',
  '[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Notepad++]',
  '"DisplayName"="Notepad++ (64-bit x64)"',
  '"Publisher"="Notepad++ Team"',
  '"DisplayIcon"="\\"C:\\\\Program Files\\\\Notepad++\\\\notepad++.exe\\",0"',
  `"UninstallString"=hex(2):${expandHex.slice(0, 12).join(',')},\\`,
  `  ${expandHex.slice(12).join(',')}`,
  '',
  '[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Updates]',
  '"ParentKeyName"="OperatingSystem"',
  '',
].join('\r\n');

describe('parseRegistryExport', () => {
  const keys = parseRegistryExport(EXPORT, { SystemRoot: 'C:\\Windows' });

  it('reads each key with its text values, unescaped, non-ASCII names intact', () => {
    expect(keys.map((key) => key.name.split('\\').pop())).toEqual(['{771FD6B0-FA20-440A-A002-3B3BAC16DC50}_is1', 'Notepad++', 'Updates']);
    expect(keys[0]!.values).toEqual({
      DisplayName: 'Microsoft Visual Studio Code (User)',
      Publisher: 'Microsoft Corporation',
      InstallLocation: 'C:\\Users\\Jösé\\AppData\\Local\\Programs\\Microsoft VS Code\\',
      DisplayIcon: 'C:\\Users\\Jösé\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    });
  });

  it('decodes expandable strings written as UTF-16 bytes over several lines, and expands their variables', () => {
    expect(keys[1]!.values.UninstallString).toBe('C:\\Windows\\x.exe');
  });

  it('reads the default value of a key', () => {
    const [key] = parseRegistryExport('[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\pwsh.exe]\n@="C:\\\\Program Files\\\\PowerShell\\\\7\\\\pwsh.exe"\n', {});
    expect(key!.values).toEqual({ '@': 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' });
  });
});

describe('uninstallEntries', () => {
  it('lists the apps people see, their icon without its index or quotes', () => {
    expect(uninstallEntries(parseRegistryExport(EXPORT, {}))).toEqual([
      {
        displayName: 'Microsoft Visual Studio Code (User)',
        publisher: 'Microsoft Corporation',
        installLocation: 'C:\\Users\\Jösé\\AppData\\Local\\Programs\\Microsoft VS Code\\',
        displayIcon: 'C:\\Users\\Jösé\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
      },
      { displayName: 'Notepad++ (64-bit x64)', publisher: 'Notepad++ Team', installLocation: '', displayIcon: 'C:\\Program Files\\Notepad++\\notepad++.exe' },
    ]);
  });
});

describe('appPaths', () => {
  it('maps each registered program name, lowercased, to its path', () => {
    const keys = parseRegistryExport(
      [
        '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\PowerShell.exe]',
        '@="C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe"',
        '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\NoDefault.exe]',
        '"Path"="C:\\\\x"',
      ].join('\n'),
      {},
    );
    expect(appPaths(keys)).toEqual(new Map([['powershell.exe', 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe']]));
  });
});

describe('expandVariables', () => {
  it('expands variables whatever their case, and leaves unknown ones as written', () => {
    expect(expandVariables('%systemroot%\\a;%NOPE%', { SystemRoot: 'C:\\Windows' })).toBe('C:\\Windows\\a;%NOPE%');
  });
});
