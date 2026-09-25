import { describe, expect, it } from 'vitest';
import { readClientConfMergeTools } from './clientConfMergeTools';

const conf = (entries: string): string =>
  `\uFEFF<?xml version="1.0" encoding="utf-8"?><ClientConfigData><Language>en</Language><MergeTools>${entries}</MergeTools></ClientConfigData>`;

const entry = (tools: string[], extensions = '*', fileType?: string): string =>
  `<MergeToolData>${fileType ? `<FileType>${fileType}</FileType>` : ''}<FileExtensions>${extensions}</FileExtensions><Tools>${tools
    .map((tool) => `<string>${tool.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}</string>`)
    .join('')}</Tools></MergeToolData>`;

describe('readClientConfMergeTools', () => {
  it('reads third-party text tools with their placeholders converted, and their extensions', () => {
    const tools = readClientConfMergeTools(
      conf(
        entry(['"/Applications/Unity/Hub/Editor/6000.0.38f1/Unity.app/Contents/Tools/UnityYAMLMerge" merge -p "@basefile" "@sourcefile" "@destinationfile" "@output"'], '.unity;.prefab') +
          entry(['kdiff3 "@basefile" "@destinationfile" "@sourcefile" -o "@output" --L1 "@basesymbolic"'], '*', 'enTextFile'),
      ),
    );
    expect(tools).toEqual([
      {
        executable: '/Applications/Unity/Hub/Editor/6000.0.38f1/Unity.app/Contents/Tools/UnityYAMLMerge',
        args: ['merge', '-p', '{base}', '{incoming}', '{yours}', '{result}'],
        extensions: ['.unity', '.prefab'],
      },
      { executable: 'kdiff3', args: ['{base}', '{yours}', '{incoming}', '-o', '{result}', '--L1', '{baseName}'], extensions: null },
    ]);
  });

  it('leaves out the UVCS merge tool’s own entries and binary tools', () => {
    const tools = readClientConfMergeTools(
      conf(
        entry(['/usr/local/bin/macmergetool -b="@basefile" -bn="@basesymbolic" -s="@sourcefile" -d="@destinationfile" -a -r="@output" -t="@filetype"'], '*', 'enTextFile') +
          entry(['"C:\\Program Files\\PlasticSCM5\\client\\plastic.exe" xmerge -b="@basefile"'], '*', 'enTextFile') +
          entry(['/opt/bin/imagemerge "@basefile" "@output"'], '*', 'enBinaryFile'),
      ),
    );
    expect(tools).toEqual([]);
  });

  it('takes the last tool of a chain, the one that asks the user', () => {
    expect(readClientConfMergeTools(conf(entry(['premerge "@basefile"', 'meld "@destinationfile" "@basefile" "@sourcefile" --output="@output"'])))[0]).toMatchObject({
      executable: 'meld',
      args: ['{yours}', '{base}', '{incoming}', '--output={result}'],
    });
  });

  it('reads nothing from a conf without merge tools', () => {
    expect(readClientConfMergeTools('<ClientConfigData><Language>en</Language></ClientConfigData>')).toEqual([]);
    expect(readClientConfMergeTools('')).toEqual([]);
  });
});

