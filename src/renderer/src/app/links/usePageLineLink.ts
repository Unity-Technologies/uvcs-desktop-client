import { useNavigation } from '../navigation/navigationStore';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { copyPageLink } from './copyPageLink';
import type { LinkTarget } from './linkNavigation';
import { pageLinkTarget } from './shownLink';
import { useShownFile } from './useShownFile';

/**
 * The link to the lines selected in the page in front (`pageLinkTarget`), as ⇧⌘C copies it then: what the line chip
 * and the lines' menu copy (`copyPageLink`). None where the code shown publishes no lines (`publishes`) or the page has
 * no link.
 */
export function usePageLineLink(publishes: boolean): { target: LinkTarget | null; copy: () => void } {
  const workspacePath = useWorkspacePath();
  const page = useNavigation((state) => state.pages.at(-1));
  const shown = useShownFile(publishes ? page : undefined);
  const target = publishes && page ? pageLinkTarget(page, shown) : null;
  return { target, copy: () => void (page && copyPageLink(workspacePath, page)) };
}
