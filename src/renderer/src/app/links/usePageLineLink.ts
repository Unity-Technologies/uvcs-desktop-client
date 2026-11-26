import type { FocusedLines } from '../navigation/pages';
import { useNavigation } from '../navigation/navigationStore';
import { usePlace } from '../workspace/useWorkspace';
import { copyLinesLink, copyPageLink, pageLinesTarget } from './copyPageLink';
import type { LinkTarget } from './linkNavigation';
import { pageLinkTarget, placeLinesTarget } from './shownLink';
import { useShownFile } from './useShownFile';

/** Links to a viewer's lines (`usePageLineLink`). */
export interface PageLineLink {
  /** The link to the lines selected, as ⇧⌘C copies it then: the line chip's. */
  target: LinkTarget | null;
  /** Copies it, the toast teaching ⇧⌘C. */
  copy: () => void;
  /** The link to other lines of the file `path`, those a right-click's menu acts on; none where no link names them. */
  linkToLines: (path: string, lines: FocusedLines) => LinkTarget | null;
  /** Copies a link to lines that aren't selected, which ⇧⌘C wouldn't copy: its toast doesn't teach it. */
  copyLink: (target: LinkTarget) => void;
}

/**
 * Links to a viewer's lines. In a page, the page names them (`pageLinkTarget`, `copyPageLink`, `pageLinesTarget`);
 * outside any (the Files view), the place names the viewer's own lines (`linkOf`, `placeLinesTarget`), never another
 * file's the store may hold. None where the code shown publishes no lines (`publishes`) or no link names them.
 */
export function usePageLineLink(publishes: boolean, linkOf?: (lines: FocusedLines) => LinkTarget | null, lines: FocusedLines | null = null): PageLineLink {
  const place = usePlace();
  const page = useNavigation((state) => state.pages.at(-1));
  const shown = useShownFile(publishes && !linkOf ? page : undefined);
  const copyLink = (target: LinkTarget): void => void copyLinesLink(place, target, false);
  if (linkOf) {
    const target = placeLinesTarget(publishes, linkOf, lines);
    // The Files view's path is the viewer's own, which `linkOf` already names.
    const linkToLines = (_path: string, picked: FocusedLines): LinkTarget | null => placeLinesTarget(publishes, linkOf, picked);
    return { target, copy: () => void copyLinesLink(place, target), linkToLines, copyLink };
  }
  const target = publishes && page ? pageLinkTarget(page, shown) : null;
  const linkToLines = (path: string, picked: FocusedLines): LinkTarget | null => (publishes && page ? pageLinesTarget(page, path, picked) : null);
  return { target, copy: () => void (page && copyPageLink(place, page)), linkToLines, copyLink };
}
