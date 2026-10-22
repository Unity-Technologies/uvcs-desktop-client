import { describe, expect, it } from 'vitest';
import type { MergeTool } from '@shared/domain/mergeTools';
import type { Merger } from './mergeToolFor';
import { mergerChoices, mergerIcon, toolChoiceEntries } from './toolChoices';

const tool = (id: string, name: string, icon?: string): MergeTool => ({ id, name, origin: 'known', executable: id, args: [], defaultArgs: [], canBringToFront: false, ...(icon && { icon }) });
const vscode: Merger = { kind: 'tool', tool: tool('vscode', 'Visual Studio Code', 'data:image/png;base64,code') };
const cursor: Merger = { kind: 'tool', tool: tool('cursor', 'Cursor') };
const unity: Merger = { kind: 'unityYamlMerge', merge: { id: 'unityyamlmerge:6000.3.19f1', executable: 'u', editorVersion: '6000.3.19f1' }, fallback: undefined };

describe('toolChoiceEntries', () => {
  it("lists the choices by the labels given, each with its app's icon where the OS gave one, none checked", () => {
    const entries = toolChoiceEntries(
      [
        { merger: vscode, label: 'Visual Studio Code' },
        { merger: cursor, label: 'All in Cursor · 2 conflicts' },
      ],
      () => {},
    );
    expect(entries.map(({ label, icon, checked }) => ({ label, hasIcon: icon !== undefined, checked }))).toEqual([
      { label: 'Visual Studio Code', hasIcon: true, checked: undefined },
      { label: 'All in Cursor · 2 conflicts', hasIcon: false, checked: undefined },
    ]);
  });

  it('opens in the one picked at once, this once', () => {
    const opened: Merger[] = [];
    toolChoiceEntries(mergerChoices([vscode, unity]), (picked) => opened.push(picked))[1]!.run();
    expect(opened).toEqual([unity]);
  });
});

describe('mergerChoices', () => {
  it('names each by its tool, and UnityYAMLMerge as Unity does, with an icon of its own', () => {
    expect(mergerChoices([cursor, unity]).map((choice) => choice.label)).toEqual(['Cursor', 'UnityYAMLMerge']);
    expect(mergerIcon(unity)).toBeDefined();
  });
});
