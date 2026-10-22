import { describe, expect, it } from 'vitest';
import type { MergeTool } from '@shared/domain/mergeTools';
import { toolChoiceEntries } from './toolChoices';

const tool = (id: string, name: string, icon?: string): MergeTool => ({ id, name, origin: 'known', executable: id, args: [], defaultArgs: [], canBringToFront: false, ...(icon && { icon }) });
const choices = [
  { tool: tool('vscode', 'Visual Studio Code', 'data:image/png;base64,code'), label: 'Visual Studio Code' },
  { tool: tool('cursor', 'Cursor'), label: 'All in Cursor · 2 conflicts' },
];

describe('toolChoiceEntries', () => {
  it("lists the tools by the labels given, each with its app's icon where the OS gave one, none checked", () => {
    const entries = toolChoiceEntries(choices, () => {});

    expect(entries.map(({ label, icon, checked }) => ({ label, hasIcon: icon !== undefined, checked }))).toEqual([
      { label: 'Visual Studio Code', hasIcon: true, checked: undefined },
      { label: 'All in Cursor · 2 conflicts', hasIcon: false, checked: undefined },
    ]);
  });

  it('opens in the tool picked at once, this once', () => {
    const opened: string[] = [];
    toolChoiceEntries(choices, (picked) => opened.push(picked.id))[1]!.run();
    expect(opened).toEqual(['cursor']);
  });
});
