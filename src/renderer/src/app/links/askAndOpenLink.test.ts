import '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { answerPrompts, askedDialogs } from '../../testing/fakeDialogs';
import { askAndOpenLink } from './askAndOpenLink';
import { openLink } from './openLink';

vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));
vi.mock('./openLink', () => ({ openLink: vi.fn() }));

beforeEach(() => vi.mocked(openLink).mockReset());

describe('askAndOpenLink', () => {
  it('opens what the user pastes as the link it holds, the web page around one too', async () => {
    answerPrompts('https://cloud.unity.com/public/plastic-scm/desktop?url=plastic://acme.cloud/repos/game/changesets/12/diff');

    await askAndOpenLink();

    expect(openLink).toHaveBeenCalledWith('plastic://acme.cloud/repos/game/changesets/12/diff');
  });

  it('refuses a text holding no link, and opens nothing when cancelled', async () => {
    answerPrompts(undefined);

    await askAndOpenLink();

    expect(askedDialogs()[0]!.validate?.('Player.cs')).toBe("This isn't a link.");
    expect(askedDialogs()[0]!.validate?.('uvcs://acme.unity/repos/game')).toBeUndefined();
    expect(openLink).not.toHaveBeenCalled();
  });
});
