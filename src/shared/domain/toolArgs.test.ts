import { describe, expect, it } from 'vitest';
import { placeholderValues, toolArgs, type ToolContext } from './toolArgs';

const context: ToolContext = { repository: 'game@local', workspacePath: '/work/game' };

describe('placeholderValues', () => {
  it('names a file by its path, as the object too', () => {
    expect(placeholderValues({ kind: 'item', path: '/work/game/a b.txt' }, context)).toEqual({
      '{object}': '/work/game/a b.txt',
      '{path}': '/work/game/a b.txt',
      '{changeset}': '',
      '{branch}': '',
      '{label}': '',
      '{shelve}': '',
      '{repository}': 'game@local',
      '{workspace}': '/work/game',
    });
  });

  it("names a changeset by its spec, its number and its branch", () => {
    expect(placeholderValues({ kind: 'changeset', id: 12, branch: '/main/task' }, context)).toMatchObject({
      '{object}': 'cs:12',
      '{changeset}': '12',
      '{branch}': '/main/task',
      '{path}': '',
    });
  });

  it('names a branch and a label by their specs and names', () => {
    expect(placeholderValues({ kind: 'branch', name: '/main/task' }, context)).toMatchObject({ '{object}': 'br:/main/task', '{branch}': '/main/task', '{label}': '' });
    expect(placeholderValues({ kind: 'label', name: 'v1.0' }, context)).toMatchObject({ '{object}': 'lb:v1.0', '{label}': 'v1.0', '{branch}': '' });
  });

  it('names a shelve by its spec and number', () => {
    expect(placeholderValues({ kind: 'shelve', id: 4 }, context)).toMatchObject({ '{object}': 'sh:4', '{shelve}': '4', '{changeset}': '', '{branch}': '' });
  });

  it("takes the object's own repository over the window's (an xlinked one)", () => {
    expect(placeholderValues({ kind: 'branch', name: '/main', repository: 'art@remote:8087' }, context)['{repository}']).toBe('art@remote:8087');
  });

  it('leaves the workspace and the repository empty when the window has none', () => {
    expect(placeholderValues({ kind: 'label', name: 'v1' }, { repository: undefined, workspacePath: null })).toMatchObject({ '{repository}': '', '{workspace}': '' });
  });
});

describe('toolArgs', () => {
  const values = placeholderValues({ kind: 'label', name: '{path} & "v1"' }, context);

  it('fills placeholders inside an argument, keeping each one argument', () => {
    expect(toolArgs(['--label={label}', '{repository}', 'plain'], values)).toEqual(['--label={path} & "v1"', 'game@local', 'plain']);
  });

  it('keeps unknown words in braces as typed, and what an object inherits stays a word', () => {
    expect(toolArgs(['{unknown}', '{}', '{toString}', '{constructor}'], values)).toEqual(['{unknown}', '{}', '{toString}', '{constructor}']);
  });

  it('fills an empty value as an empty argument', () => {
    expect(toolArgs(['{path}'], values)).toEqual(['']);
  });
});
