import type { PageOf } from '../../app/navigation/pages';
import type { SelectedLines } from '../diff/selectedLinesStore';
import { ancestorsOf } from '../files/fileTreeRows';

/** How Browse repository opens: the item selected, the folders opened to show it, the lines a link names and the view. */
export interface BrowseOpening {
  selected: string | null;
  expand: string[];
  focus: SelectedLines | null;
  /**
   * The page's own "Diff | Annotate", for a file's lines: Annotate shows a file's content whole, where the diff of its
   * last change may fold them away or not have them. None: the choice every file shares.
   */
  fileView: 'annotate' | null;
  /**
   * Shows the page's details again if the user hid them: the lines a link names show only there. An item alone leaves
   * the user's choice as it was, its row selected in the tree.
   */
  showsDetails: boolean;
}

export function browseOpening({ focusPath, focusLines }: Pick<PageOf<'browseRepository'>, 'focusPath' | 'focusLines'>): BrowseOpening {
  if (!focusPath) return { selected: null, expand: [], focus: null, fileView: null, showsDetails: false };
  return {
    selected: focusPath,
    expand: ancestorsOf(focusPath),
    focus: focusLines ? { path: focusPath, lines: focusLines } : null,
    fileView: focusLines ? 'annotate' : null,
    showsDetails: focusLines !== undefined,
  };
}
