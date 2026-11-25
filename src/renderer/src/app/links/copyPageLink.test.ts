import '../../testing/fakeWindow';
import { afterEach, describe, expect, it } from 'vitest';
import { useShownBrowseItem } from '../../features/browseRepository/shownBrowseItem';
import { useShownDiffFile } from '../../features/diff/shownDiffFile';
import { useSelectedLines } from '../../features/diff/selectedLinesStore';
import { pageLinesTarget } from './copyPageLink';

const DIFF = { kind: 'diff', title: 'Changeset 12', target: { kind: 'changeset', changesetId: 12 } } as const;
const RIGHT_CLICKED = { side: 'new', first: 60, last: 60 } as const;

afterEach(() => {
  useShownDiffFile.setState({ shown: null });
  useSelectedLines.setState({ selected: null });
  useShownBrowseItem.setState({ shown: null });
});

describe('pageLinesTarget: the link the lines menu copies, a right-click selecting nothing', () => {
  it('names the lines right-clicked, not those selected', () => {
    useShownDiffFile.setState({ shown: { target: DIFF.target, path: 'src/Player.cs' } });
    useSelectedLines.setState({ selected: { path: 'src/Player.cs', lines: { side: 'new', first: 40, last: 52 } } });

    expect(pageLinesTarget(DIFF, 'src/Player.cs', RIGHT_CLICKED)).toEqual({
      object: { kind: 'changeset', id: 12 },
      page: { kind: 'diffFile', path: '/src/Player.cs' },
      lines: RIGHT_CLICKED,
    });
  });

  it('names them with no lines selected', () => {
    useShownDiffFile.setState({ shown: { target: DIFF.target, path: 'src/Player.cs' } });

    expect(pageLinesTarget(DIFF, 'src/Player.cs', RIGHT_CLICKED)?.lines).toEqual(RIGHT_CLICKED);
  });

  it("follows the page's own rules: a browsed file's older side has no lines in a link", () => {
    useShownBrowseItem.setState({ shown: { changesetId: 7, path: 'src/Player.cs' } });
    const browse = { kind: 'browseRepository', changesetId: 7 } as const;

    expect(pageLinesTarget(browse, 'src/Player.cs', { side: 'old', first: 3, last: 3 })?.lines).toBeUndefined();
    expect(pageLinesTarget(browse, 'src/Player.cs', RIGHT_CLICKED)?.lines).toEqual(RIGHT_CLICKED);
  });
});
