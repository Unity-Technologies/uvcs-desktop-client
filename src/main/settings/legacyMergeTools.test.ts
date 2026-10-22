import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import type { LegacyMergeToolEntry } from '../plasticConfig/clientConfMergeTools';
import { legacyMergeToolSettings, type ImportedMergeToolSettings } from './legacyMergeTools';

const fresh: ImportedMergeToolSettings = {
  mergeTool: DEFAULT_SETTINGS.mergeTool,
  mergeToolRules: DEFAULT_SETTINGS.mergeToolRules,
  unityMergeTool: DEFAULT_SETTINGS.unityMergeTool,
  customMergeTools: [],
};

const text = (patterns: string, ...commands: string[]): LegacyMergeToolEntry => ({ fileType: 'text', patterns: patterns.split(';'), commands });
const any = (patterns: string, ...commands: string[]): LegacyMergeToolEntry => ({ fileType: 'any', patterns: patterns.split(';'), commands });
const binary = (patterns: string, ...commands: string[]): LegacyMergeToolEntry => ({ fileType: 'binary', patterns: patterns.split(';'), commands });

// The official client's own command lines, as it writes them on each OS.
const XMERGE_WINDOWS =
  'plastic xmerge -b="@basefile" -bn="@basesymbolic" -s="@sourcefile" -sn="@sourcesymbolic" -d="@destinationfile" -a -r="@output" -t="@filetype" -i="@comparationmethod" -e="@fileencoding" -m="@mergetype" -re="@resultencoding" --progress="@progress" --extrainfofile="@extrainfofile"';
const SEMANTIC_WINDOWS =
  'plastic semanticmerge -b="@basefile" -bn="@basesymbolic" -s="@sourcefile" -sn="@sourcesymbolic" -d="@destinationfile" -dn="@destinationsymbolic" -a -r="@output" -i="@comparationmethod" -e="@fileencoding" --progress="@progress" --extrainfofile="@extrainfofile"';
const BINMERGE_WINDOWS = 'plastic binmerge -b="@basefile" -bn="@basesymbolic" -s="@sourcefile" -sn="@sourcesymbolic" -d="@destinationfile" -a -r="@output" -m="@mergetype"';
const SMART_MERGE_WINDOWS = '"C:\\Program Files\\Unity\\Hub\\Editor\\2022.3.10f1\\Editor\\Data\\Tools\\UnityYAMLMerge.exe" merge -p "@basefile" "@sourcefile" "@destinationfile" "@output"';
const WORD_MERGE_WINDOWS = '"C:\\Program Files\\PlasticSCM5\\client\\diffscripts\\merge-doc.exe" "@destinationfile" "@sourcefile"  "@output"';
const SMART_MERGE_MAC = '"/Applications/Unity/Hub/Editor/6000.0.38f1/Unity.app/Contents/Tools/UnityYAMLMerge" merge -p "@basefile" "@sourcefile" "@destinationfile" "@output"';
const MACMERGETOOL =
  '/usr/local/bin/macmergetool -b="@basefile" -bn="@basesymbolic" -bh="@basehash" -s="@sourcefile" -sn="@sourcesymbolic" -sh="@sourcehash" -d="@destinationfile" -dn="@destinationsymbolic" -dh="@destinationhash" -a -r="@output"';
const BINMERGETOOL = 'binmergetool -b="@basefile" -bn="@basesymbolic" -s="@sourcefile" -sn="@sourcesymbolic" -d="@destinationfile" -a -r="@output" -m="@mergetype"';
const XMERGE_MAC = '"/usr/local/bin/plasticgui" xmerge -b="@basefile" -s="@sourcefile" -d="@destinationfile" -r="@output"';
const GTKMERGETOOL = 'gtkmergetool -b="@basefile" -bn="@basesymbolic" -s="@sourcefile" -sn="@sourcesymbolic" -d="@destinationfile" -a -r="@output"';

describe('legacyMergeToolSettings', () => {
  it("takes the official client's Windows defaults: Unity assets after Smart Merge, C#/VB/Java in Semantic Merge, the rest in the UVCS merge tool, leaving out its Word script", () => {
    const entries = [
      any('.doc;.docx', WORD_MERGE_WINDOWS),
      any('.prefab;.unity', SMART_MERGE_WINDOWS, XMERGE_WINDOWS),
      text('.meta', XMERGE_WINDOWS),
      text('.cs;.vb;.java', SEMANTIC_WINDOWS),
      text('*', XMERGE_WINDOWS),
      binary('*', BINMERGE_WINDOWS),
    ];

    expect(legacyMergeToolSettings(entries, fresh)).toEqual({
      mergeTool: 'auto',
      mergeToolRules: [{ id: 'imported:2', patterns: ['.cs', '.vb', '.java'], toolId: 'semantic' }],
      unityMergeTool: 'others',
      customMergeTools: [],
    });
  });

  it('takes a macOS setup with a Unity entry and the old standalone tools, adding the Semantic Merge the client used for C#, VB and Java', () => {
    const entries = [any('.unity', SMART_MERGE_MAC), text('*', MACMERGETOOL), binary('*', BINMERGETOOL)];

    expect(legacyMergeToolSettings(entries, fresh)).toEqual({
      mergeTool: 'auto',
      mergeToolRules: [{ id: 'imported:semantic', patterns: ['.cs', '.vb', '.java'], toolId: 'semantic' }],
      unityMergeTool: 'others',
      customMergeTools: [],
    });
  });

  it('takes a Linux setup with gtkmergetool as the UVCS merge tool', () => {
    expect(legacyMergeToolSettings([text('*', GTKMERGETOOL), binary('*', BINMERGETOOL)], fresh).mergeTool).toBe('auto');
  });

  it('reads the Desktop GUI by any of its program names, and its semanticmerge as Semantic Merge', () => {
    const entries = [text('.java', '"/usr/local/bin/plasticgui" semanticmerge -r="@output"'), text('.swift', XMERGE_MAC), text('.go', '/opt/plasticscm5/client/linplasticx xmerge -r="@output"'), text('*', 'kdiff3 "@output"')];
    expect(legacyMergeToolSettings(entries, fresh).mergeToolRules).toEqual([
      { id: 'imported:1', patterns: ['.java'], toolId: 'semantic' },
      { id: 'imported:2', patterns: ['.swift'], toolId: 'uvcs' },
      { id: 'imported:3', patterns: ['.go'], toolId: 'uvcs' },
    ]);
  });

  it('opens Unity assets Smart Merge cannot merge in the tool chained after it, when that is not every other file’s', () => {
    const entries = [any('.prefab;.unity', SMART_MERGE_WINDOWS, '"C:\\Program Files\\KDiff3\\bin\\kdiff3.exe" "@basefile" "@output"'), text('*', XMERGE_WINDOWS)];
    expect(legacyMergeToolSettings(entries, fresh).unityMergeTool).toBe('kdiff3');
  });

  it('makes a known program the app’s own entry for it, whatever its arguments were', () => {
    const entries = [
      text('.ts', '"C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd" --wait --merge "@sourcefile" "@destinationfile" "@basefile" "@output"'),
      text('.py', '/Applications/PyCharm.app/Contents/MacOS/pycharm merge "@destinationfile" "@sourcefile" "@basefile" "@output"'),
      text('.c', '"C:\\Program Files\\JetBrains\\CLion 2026.1\\bin\\clion64.exe" merge a b c d'),
      text('.rb', '/Applications/Xcode.app/Contents/Applications/FileMerge.app/Contents/MacOS/FileMerge -ancestor "@basefile" -merge "@output"'),
      text('*', 'p4merge "@basefile" "@sourcefile" "@destinationfile" "@output"'),
    ];
    const imported = legacyMergeToolSettings(entries, fresh);
    expect(imported.mergeToolRules.map((rule) => rule.toolId)).toEqual(['vscode', 'pycharm', 'clion', 'opendiff']);
    expect(imported.mergeTool).toBe('p4merge');
    expect(imported.customMergeTools).toEqual([]);
  });

  it('adds any other program as the user’s, with its variables as the app’s placeholders, dropping the options the app has no value for', () => {
    const entries = [
      text(
        '*',
        '"/opt/My Tools/mergeit" --base="@basefile" --theirs "@sourcefile" --mine "@destinationfile" --out "@output" --titles "@basesymbolic|@sourcesymbolic|@destinationsymbolic" -e="@fileencoding" --hash=@basehash',
      ),
    ];
    expect(legacyMergeToolSettings(entries, fresh)).toMatchObject({
      mergeTool: 'custom:imported:1',
      customMergeTools: [
        {
          id: 'custom:imported:1',
          name: 'mergeit',
          executable: '/opt/My Tools/mergeit',
          args: ['--base={base}', '--theirs', '{incoming}', '--mine', '{yours}', '--out', '{result}', '--titles', '{baseName}|{incomingName}|{yoursName}'],
        },
      ],
    });
  });

  it('adds one tool of the user’s for one program set up the same way for several file types, next to the ones they had', () => {
    const own = { id: 'custom:1', name: 'Mine', executable: '/opt/mine', args: ['{result}'] };
    const entries = [text('.a', '/opt/tool "@output"'), text('.b', '/opt/tool "@output"'), text('.c', '/opt/mine "@output"')];
    const imported = legacyMergeToolSettings(entries, { ...fresh, customMergeTools: [own] });
    expect(imported.customMergeTools).toEqual([own, { id: 'custom:imported:2', name: 'tool', executable: '/opt/tool', args: ['{result}'] }]);
    expect(imported.mergeToolRules.map((rule) => rule.toolId)).toEqual(['custom:imported:2', 'custom:imported:2', 'custom:1', 'semantic']);
  });

  it('leaves out what the app never opens a tool for: binary entries, binary merges, and commands that save nowhere', () => {
    const entries = [binary('.psd', 'photoshopmerge "@output"'), text('.png', BINMERGE_WINDOWS), text('.txt', 'notepad "@basefile"'), text('.md'), text('*', XMERGE_WINDOWS)];
    expect(legacyMergeToolSettings(entries, fresh).mergeToolRules).toEqual([{ id: 'imported:semantic', patterns: ['.cs', '.vb', '.java'], toolId: 'semantic' }]);
  });

  it('leaves out regular expressions, keeping the patterns beside them', () => {
    const entries = [text('^Assets/.*\\.json$;.yaml;a|b', 'meld "@output"'), text('^only$', 'meld "@output"'), text('*', XMERGE_WINDOWS)];
    expect(legacyMergeToolSettings(entries, fresh).mergeToolRules[0]).toEqual({ id: 'imported:1', patterns: ['.yaml'], toolId: 'meld' });
  });

  it('stops at the entry for every text file, as the client never goes past it', () => {
    const entries = [text('*', 'meld "@output"'), text('.cs', 'kdiff3 "@output"')];
    expect(legacyMergeToolSettings(entries, fresh)).toMatchObject({ mergeTool: 'meld', mergeToolRules: [] });
  });

  it('keeps the user’s own pick for every other file over the client’s', () => {
    const imported = legacyMergeToolSettings([text('*', 'meld "@output"')], { ...fresh, mergeTool: 'vscode' });
    expect(imported.mergeTool).toBe('vscode');
  });

  it('adds Semantic Merge only for the languages no rule sends elsewhere, and only while the client’s own tool takes every other file', () => {
    expect(legacyMergeToolSettings([text('.cs', 'rider "@output"'), text('*', XMERGE_WINDOWS)], fresh).mergeToolRules).toEqual([
      { id: 'imported:1', patterns: ['.cs'], toolId: 'rider' },
      { id: 'imported:semantic', patterns: ['.vb', '.java'], toolId: 'semantic' },
    ]);
    expect(legacyMergeToolSettings([text('*', 'meld "@output"')], fresh).mergeToolRules).toEqual([]);
  });

  it('drops a rule that sends files where every other file goes anyway, unless a later rule could take them', () => {
    const entries = [text('*.txt', XMERGE_WINDOWS), text('.meta', XMERGE_WINDOWS), text('.gz', XMERGE_WINDOWS), text('.tar.gz', 'meld "@output"'), text('.json', 'meld "@output"'), text('*', XMERGE_WINDOWS)];
    expect(legacyMergeToolSettings(entries, fresh).mergeToolRules.map((rule) => rule.patterns)).toEqual([['*.txt'], ['.gz'], ['.tar.gz'], ['.json'], ['.cs', '.vb', '.java']]);
  });

  it('runs a command after the official client’s /nowindow word as any other', () => {
    expect(legacyMergeToolSettings([text('.cs', '/nowindow kdiff3 "@output"'), text('*', XMERGE_WINDOWS)], fresh).mergeToolRules[0]!.toolId).toBe('kdiff3');
  });
});
