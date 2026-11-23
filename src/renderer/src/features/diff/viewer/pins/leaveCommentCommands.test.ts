import { describe, expect, it, vi } from 'vitest';
import { registeredCommands } from '../../../../app/commands/commandStore';
import { hotkey } from '../../../../lib/shortcutRegistry';
import { leaveCommentCommands } from './leaveCommentCommands';

const idle = { commenting: false, commentable: true, opened: false };
const opened = { ...idle, opened: true };

describe('leaveCommentCommands', () => {
  it('is Esc closing the card open, in the diff’s own group', () => {
    const apply = vi.fn();
    const [command, ...rest] = leaveCommentCommands({ shortcut: 'imageCommentLeave', state: opened, shown: true, apply });
    expect(rest).toEqual([]);
    expect(command).toMatchObject({ id: 'diff.imageCommentLeave', group: 'Image diff', label: "Close the comment's card", shortcut: hotkey('imageCommentLeave') });
    expect(command!.disabled).toBeUndefined();
    command!.run();
    expect(apply).toHaveBeenCalledWith('closeCard');
  });

  it('is a model’s too, in its group', () => {
    const [command] = leaveCommentCommands({ shortcut: 'modelCommentLeave', state: { ...opened, commenting: true }, shown: true, apply: vi.fn() });
    expect(command).toMatchObject({ id: 'diff.modelCommentLeave', group: 'Model diff', label: 'Stop commenting' });
  });

  it('claims nothing with nothing to stop or close, nor while the diff is hidden', () => {
    expect(leaveCommentCommands({ shortcut: 'imageCommentLeave', state: idle, shown: true, apply: vi.fn() })).toEqual([]);
    expect(leaveCommentCommands({ shortcut: 'imageCommentLeave', state: opened, shown: false, apply: vi.fn() })).toEqual([]);
  });

  it('an idle viewer mounted later never masks the review’s card closing (one command per id)', () => {
    const review = leaveCommentCommands({ shortcut: 'imageCommentLeave', state: opened, shown: true, apply: vi.fn() });
    const idleViewer = leaveCommentCommands({ shortcut: 'imageCommentLeave', state: idle, shown: true, apply: vi.fn() });
    const commands = registeredCommands(new Map([['review', review], ['history', idleViewer]]));
    expect(commands.filter((command) => command.id === 'diff.imageCommentLeave')).toEqual(review);
  });
});
