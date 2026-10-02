import { describe, expect, it } from 'vitest';
import type { MergeTool } from '@shared/domain/mergeTools';
import { toolChoiceEntries } from './toolChoices';

const tool = (id: string, name: string, icon?: string): MergeTool => ({ id, name, origin: 'known', executable: id, args: [], defaultArgs: [], canBringToFront: false, ...(icon && { icon }) });
const choices = [
  { tool: tool('vscode', 'Visual Studio Code', 'data:image/png;base64,code'), label: 'Visual Studio Code · 2 conflicts' },
  { tool: tool('cursor', 'Cursor'), label: 'Cursor · 2 conflicts' },
];

describe('toolChoiceEntries', () => {
  it("checks the button's tool, by the labels given, each with its app's icon where the OS gave one", () => {
    const entries = toolChoiceEntries(choices, 'vscode', () => {});

    expect(entries.map(({ label, icon, checked }) => ({ label, hasIcon: icon !== undefined, checked }))).toEqual([
      { label: 'Visual Studio Code · 2 conflicts', hasIcon: true, checked: true },
      { label: 'Cursor · 2 conflicts', hasIcon: false, checked: false },
    ]);
  });

  it('picking another tool only selects it; nothing opens until the button is clicked', () => {
    const selected: string[] = [];
    const entries = toolChoiceEntries(choices, 'vscode', (id) => selected.push(id));

    entries[1]!.run();
    entries[0]!.run();
    expect(selected).toEqual(['cursor']);
  });
});
