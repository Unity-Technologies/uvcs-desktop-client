import { beforeEach, describe, expect, it } from 'vitest';
import { askDialog, openDialog, useDialogStore } from './dialogStore';

const dialogs = () => useDialogStore.getState().dialogs;

/** Draws the dialog on top, as the dialog host does, handing it what closes it. */
function renderTopDialog(): void {
  const top = dialogs().at(-1)!;
  top.render(() => useDialogStore.getState().close(top.id));
}

beforeEach(() => useDialogStore.setState({ dialogs: [] }));

describe('openDialog', () => {
  it('stacks dialogs opened from anywhere, and closing one leaves the one above it open', () => {
    openDialog(() => 'confirm');
    openDialog(() => 'error details');

    useDialogStore.getState().close(dialogs()[0]!.id);

    expect(dialogs().map((dialog) => dialog.render(() => {}))).toEqual(['error details']);
  });
});

describe('askDialog', () => {
  it('resolves with the answer the dialog finishes with, and closes it', async () => {
    const answer = askDialog<'save' | 'discard'>((finish) => void finish('save'));

    renderTopDialog();

    await expect(answer).resolves.toBe('save');
    expect(dialogs()).toEqual([]);
  });

  it('resolves undefined when the dialog is dismissed', async () => {
    const answer = askDialog<string>((finish) => void finish(undefined));

    renderTopDialog();

    await expect(answer).resolves.toBeUndefined();
    expect(dialogs()).toEqual([]);
  });
});
