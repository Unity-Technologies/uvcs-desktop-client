import { describe, expect, it, vi } from 'vitest';
import type { Tool } from '@shared/domain/tools';
import { SEPARATOR, type Action, type MenuEntry } from '../../lib/actions';
import { draftOfTool, NEW_TOOL_DRAFT, toolDraftProblem, toolOfDraft, toolPreview, toolRowMenu, toolRows, withTarget } from './toolSettings';

const POST: Tool = { id: 'tool:1', name: 'Post', program: 'C:\\Tools\\post.exe', args: ['--object', '{object}', 'two words'], targets: ['branch', 'changeset'] };
const UPLOAD: Tool = { id: 'tool:2', name: 'Upload', program: '/opt/upload', args: ['{path}'], targets: ['item'] };

const action = (entries: MenuEntry[], id: string) => entries.find((entry) => entry !== SEPARATOR && entry.id === id) as Action;

describe('toolRows', () => {
  it('names each tool and what it runs on, in the order the app lists targets', () => {
    expect(toolRows([POST, UPLOAD])).toEqual([
      { id: 'tool:1', name: 'Post', runsOn: 'Changesets, branches' },
      { id: 'tool:2', name: 'Upload', runsOn: 'Files and folders' },
    ]);
  });
});

describe('toolRowMenu', () => {
  it('edits, duplicates under the tool, moves within the ends and removes', () => {
    const save = vi.fn();
    const edit = vi.fn();
    const menu = toolRowMenu([POST, UPLOAD], 'tool:1', edit, save, () => 'tool:3');
    expect(menu.map((entry) => (entry === SEPARATOR ? '---' : entry.label))).toEqual(['Edit…', 'Duplicate', '---', 'Move up', 'Move down', '---', 'Remove']);
    expect(action(menu, 'moveUp').disabled).toBe(true);
    expect(action(menu, 'moveDown').disabled).toBe(false);

    action(menu, 'edit').run();
    action(menu, 'duplicate').run();
    action(menu, 'moveDown').run();
    action(menu, 'remove').run();
    expect(edit).toHaveBeenCalledOnce();
    expect(save.mock.calls.map(([tools]) => (tools as Tool[]).map((tool) => `${tool.id} ${tool.name}`))).toEqual([
      ['tool:1 Post', 'tool:3 Post copy', 'tool:2 Upload'],
      ['tool:2 Upload', 'tool:1 Post'],
      ['tool:2 Upload'],
    ]);
  });
});

describe('the edit draft', () => {
  it('reads a tool back as it was saved, its arguments on one line', () => {
    const draft = draftOfTool(POST);
    expect(draft.argsText).toBe('--object {object} "two words"');
    expect(toolOfDraft(draft, POST.id)).toEqual({ ...POST, targets: ['changeset', 'branch'] });
  });

  it("names a tool without a name after its program", () => {
    expect(toolOfDraft({ ...NEW_TOOL_DRAFT, program: ' /Applications/Poster.app ' }, 'tool:9')).toMatchObject({ name: 'Poster', program: '/Applications/Poster.app' });
  });

  it('needs a program and something to run on', () => {
    expect(toolDraftProblem(NEW_TOOL_DRAFT)).toBe('Choose the program it runs.');
    expect(toolDraftProblem({ ...NEW_TOOL_DRAFT, program: '/opt/post', targets: [] })).toBe('Choose what it runs on.');
    expect(toolDraftProblem({ ...NEW_TOOL_DRAFT, program: '/opt/post' })).toBeUndefined();
  });

  it('turns targets on and off, keeping the app order', () => {
    expect(withTarget(['label'], 'changeset', true)).toEqual(['changeset', 'label']);
    expect(withTarget(['changeset', 'label'], 'changeset', false)).toEqual(['label']);
  });
});

describe('toolPreview', () => {
  it('shows the command on an example of the first target, each placeholder filled', () => {
    expect(toolPreview(draftOfTool(POST), 'win32')).toBe('post --object cs:12 "two words"');
    expect(toolPreview({ ...NEW_TOOL_DRAFT, program: '/opt/upload', argsText: '{path} {repository}', targets: ['item'] }, 'linux')).toBe(
      'upload /home/me/wkspaces/game/src/Player.cs game@local',
    );
    expect(toolPreview({ ...NEW_TOOL_DRAFT, program: '/opt/upload', argsText: '{workspace}', targets: ['item'] }, 'darwin')).toBe('upload /Users/me/wkspaces/game');
    expect(toolPreview({ ...NEW_TOOL_DRAFT, program: 'C:\\up.exe', argsText: '{path}', targets: ['item'] }, 'win32')).toBe('up C:\\Users\\me\\wkspaces\\game\\src\\Player.cs');
  });

  it('shows nothing until there is a program and a target', () => {
    expect(toolPreview(NEW_TOOL_DRAFT, 'darwin')).toBeUndefined();
    expect(toolPreview({ ...NEW_TOOL_DRAFT, program: '/opt/post', targets: [] }, 'darwin')).toBeUndefined();
  });
});
