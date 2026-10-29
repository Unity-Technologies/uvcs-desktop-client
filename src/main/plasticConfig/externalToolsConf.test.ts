import { describe, expect, it } from 'vitest';
import { readLegacyTools, splitCommandLine } from './externalToolsConf';

describe('readLegacyTools', () => {
  it('reads each tool with its targets, program and arguments, the placeholders as the app writes them', () => {
    const conf = [
      '# Tools for the team',
      '',
      'Changeset:Branch|Post to tracker|C:\\Tools\\post.exe|--object "@object" --repo @repository --wk "@wkpath"',
      'item|Upload|/usr/local/bin/upload|@object',
    ].join('\r\n');
    expect(readLegacyTools(conf)).toEqual([
      { name: 'Post to tracker', program: 'C:\\Tools\\post.exe', args: ['--object', '{object}', '--repo', '{repository}', '--wk', '{workspace}'], targets: ['changeset', 'branch'] },
      { name: 'Upload', program: '/usr/local/bin/upload', args: ['{object}'], targets: ['item'] },
    ]);
  });

  it('reads a placeholder inside an argument, and a tool with no arguments', () => {
    expect(readLegacyTools('Label|Release notes|%TOOLS%\\notes.cmd|--label=@object\nBranch|Open|/bin/tool|')).toEqual([
      { name: 'Release notes', program: '%TOOLS%\\notes.cmd', args: ['--label={object}'], targets: ['label'] },
      { name: 'Open', program: '/bin/tool', args: [], targets: ['branch'] },
    ]);
  });

  it('skips the lines the official client skips: not four fields, an unknown target, a | in the arguments', () => {
    const conf = ['Branch|Two fields', 'Shelve|Unknown|/bin/tool|@object', 'Branch|Pipe|/bin/sh|-c "a | b"', 'Branch||/bin/tool|x', 'Branch:|Empty target|/bin/tool|x'].join('\n');
    expect(readLegacyTools(conf)).toEqual([]);
  });

  it('names each target once, whatever its case', () => {
    expect(readLegacyTools('BRANCH:branch:Item|Tool|/bin/tool|')[0]?.targets).toEqual(['branch', 'item']);
  });
});

describe('splitCommandLine', () => {
  it('splits on spaces, keeping quoted spaces', () => {
    expect(splitCommandLine('  a "b c"  d')).toEqual(['a', 'b c', 'd']);
  });

  it('keeps an empty quoted argument', () => {
    expect(splitCommandLine('a "" b')).toEqual(['a', '', 'b']);
  });

  it('reads backslashes as Windows programs do', () => {
    expect(splitCommandLine('C:\\a\\b "C:\\c d\\\\" \\"x\\" "y""z"')).toEqual(['C:\\a\\b', 'C:\\c d\\', '"x"', 'y"z']);
  });

  it('joins quoted and plain text in one argument', () => {
    expect(splitCommandLine('--path="@object"')).toEqual(['--path=@object']);
  });
});
