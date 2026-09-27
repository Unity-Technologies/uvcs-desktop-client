import { describe, expect, it } from 'vitest';
import { fillArgs, writesResult, type MergeToolFiles } from './commandLine';
import { KNOWN_TOOLS } from './knownTools';

const FILES: MergeToolFiles = {
  base: '/t/a.BASE.ts',
  yours: '/t/a.YOURS.ts',
  incoming: '/t/a.INCOMING.ts',
  result: '/t/a.ts',
  baseName: 'Base',
  yoursName: 'Yours (/main/task)',
  incomingName: 'Incoming (/main)',
  fileName: 'a.ts',
};

const commandOf = (id: string): string[] => fillArgs(KNOWN_TOOLS.find((known) => known.id === id)!.args, FILES);

describe('fillArgs', () => {
  it('replaces placeholders inside arguments and keeps each one whole, spaces and all', () => {
    expect(fillArgs(['-dn={yoursName}', '{result}', '{unknown}'], FILES)).toEqual(['-dn=Yours (/main/task)', '/t/a.ts', '{unknown}']);
  });

  it('knows whether a template saves a result', () => {
    expect(writesResult(['{base}', '-o', '{result}'])).toBe(true);
    expect(writesResult(['{base}', '{yours}'])).toBe(false);
  });
});

describe('known tools', () => {
  it('give every tool somewhere to save', () => {
    expect(KNOWN_TOOLS.filter((tool) => !writesResult(tool.args)).map((tool) => tool.id)).toEqual([]);
  });

  it('open the UVCS merge tool with incoming as source and yours as destination, never automatic', () => {
    expect(commandOf('uvcs')).toEqual([
      'xmerge',
      '-b=/t/a.BASE.ts',
      '-bn=Base',
      '-s=/t/a.INCOMING.ts',
      '-sn=Incoming (/main)',
      '-d=/t/a.YOURS.ts',
      '-dn=Yours (/main/task)',
      '-r=/t/a.ts',
    ]);
    expect(commandOf('uvcs')).not.toContain('-a');
  });

  it('follow each tool’s documented argument order', () => {
    expect(commandOf('vscode')).toEqual(['--wait', '--merge', '/t/a.INCOMING.ts', '/t/a.YOURS.ts', '/t/a.BASE.ts', '/t/a.ts']);
    expect(commandOf('rider')).toEqual(['merge', '/t/a.YOURS.ts', '/t/a.INCOMING.ts', '/t/a.BASE.ts', '/t/a.ts']);
    expect(commandOf('smerge')).toEqual(['mergetool', '/t/a.BASE.ts', '/t/a.YOURS.ts', '/t/a.INCOMING.ts', '-o', '/t/a.ts']);
    expect(commandOf('kdiff3').slice(0, 5)).toEqual(['/t/a.BASE.ts', '/t/a.YOURS.ts', '/t/a.INCOMING.ts', '-o', '/t/a.ts']);
    expect(commandOf('bcompare')).toEqual(['/t/a.YOURS.ts', '/t/a.INCOMING.ts', '/t/a.BASE.ts', '/t/a.ts']);
    expect(commandOf('meld')).toEqual(['--output=/t/a.ts', '/t/a.YOURS.ts', '/t/a.BASE.ts', '/t/a.INCOMING.ts']);
    expect(commandOf('p4merge')).toEqual(['/t/a.BASE.ts', '/t/a.INCOMING.ts', '/t/a.YOURS.ts', '/t/a.ts']);
    expect(commandOf('araxis')).toEqual(['-wait', '-merge', '-3', '-a1', '/t/a.BASE.ts', '/t/a.YOURS.ts', '/t/a.INCOMING.ts', '/t/a.ts']);
    expect(commandOf('opendiff')).toEqual(['/t/a.YOURS.ts', '/t/a.INCOMING.ts', '-ancestor', '/t/a.BASE.ts', '-merge', '/t/a.ts']);
  });
});
