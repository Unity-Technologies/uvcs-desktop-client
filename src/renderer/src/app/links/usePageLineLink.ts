import type { FocusedLines } from '../navigation/pages';
import { useNavigation } from '../navigation/navigationStore';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { copyLinesLink, copyPageLink } from './copyPageLink';
import type { LinkTarget } from './linkNavigation';
import { pageLinkTarget, placeLinesTarget } from './shownLink';
import { useShownFile } from './useShownFile';

/**
 * The link to the lines selected, as ⇧⌘C copies it then: what the line chip and the lines' menu copy. In a page, the
 * page names them (`pageLinkTarget`, `copyPageLink`); outside any (the Files view), the place names the viewer's own
 * `lines` (`linkOf`, `placeLinesTarget`), never another file's the store may hold. None
 * where the code shown publishes no lines (`publishes`) or no link names them.
 */
export function usePageLineLink(
  publishes: boolean,
  linkOf?: (lines: FocusedLines) => LinkTarget | null,
  lines: FocusedLines | null = null,
): { target: LinkTarget | null; copy: () => void } {
  const workspacePath = useWorkspacePath();
  const page = useNavigation((state) => state.pages.at(-1));
  const shown = useShownFile(publishes && !linkOf ? page : undefined);
  if (linkOf) {
    const target = placeLinesTarget(publishes, linkOf, lines);
    return { target, copy: () => void copyLinesLink(workspacePath, target) };
  }
  const target = publishes && page ? pageLinkTarget(page, shown) : null;
  return { target, copy: () => void (page && copyPageLink(workspacePath, page)) };
}
