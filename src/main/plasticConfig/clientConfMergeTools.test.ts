import { describe, expect, it } from 'vitest';
import { readLegacyMergeTools } from './clientConfMergeTools';
import { clientConf, mergeToolData, mergeTools } from './testing/clientConf';

describe('readLegacyMergeTools', () => {
  it('reads every entry in order: its file type, its patterns and its chain of commands', () => {
    const xml = clientConf(
      mergeTools(
        mergeToolData(null, '.prefab;.unity', [
          '"C:\\Program Files\\Unity\\Hub\\Editor\\6000.0.38f1\\Editor\\Data\\Tools\\UnityYAMLMerge.exe" merge -p "@basefile" "@sourcefile" "@destinationfile" "@output"',
          'plastic xmerge -b="@basefile" -s="@sourcefile" -d="@destinationfile" -r="@output"',
        ]),
        mergeToolData('enTextFile', '*', ['plastic xmerge -b="@basefile" -r="@output"']),
        mergeToolData('enBinaryFile', '*', ['plastic binmerge -b="@basefile" -r="@output"']),
      ),
      '\r\n',
    );

    expect(readLegacyMergeTools(xml)).toEqual([
      {
        fileType: 'any',
        patterns: ['.prefab', '.unity'],
        commands: [
          '"C:\\Program Files\\Unity\\Hub\\Editor\\6000.0.38f1\\Editor\\Data\\Tools\\UnityYAMLMerge.exe" merge -p "@basefile" "@sourcefile" "@destinationfile" "@output"',
          'plastic xmerge -b="@basefile" -s="@sourcefile" -d="@destinationfile" -r="@output"',
        ],
      },
      { fileType: 'text', patterns: ['*'], commands: ['plastic xmerge -b="@basefile" -r="@output"'] },
      { fileType: 'binary', patterns: ['*'], commands: ['plastic binmerge -b="@basefile" -r="@output"'] },
    ]);
  });

  it('reads the characters XML escapes, and patterns with spaces around them', () => {
    const xml = clientConf(mergeTools(mergeToolData('enTextFile', ' .h ; .cpp ;', ['tool "@basefile" > "@output" & more'])));
    expect(readLegacyMergeTools(xml)).toEqual([{ fileType: 'text', patterns: ['.h', '.cpp'], commands: ['tool "@basefile" > "@output" & more'] }]);
  });

  it('is null without merge tools, so the app keeps its own defaults: no section, an empty file, not its XML', () => {
    expect(readLegacyMergeTools(clientConf(''))).toBeNull();
    expect(readLegacyMergeTools('')).toBeNull();
    expect(readLegacyMergeTools('<ClientConfigData />')).toBeNull();
    expect(readLegacyMergeTools('<Other><MergeTools></MergeTools></Other>')).toBeNull();
  });

  it('reads no command from a file cut short', () => {
    const entries = readLegacyMergeTools('<ClientConfigData><MergeTools><MergeToolData><Tools>') ?? [];
    expect(entries.flatMap((entry) => entry.commands)).toEqual([]);
  });
});
