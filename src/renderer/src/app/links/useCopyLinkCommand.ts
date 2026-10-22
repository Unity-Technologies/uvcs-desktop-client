import { Link } from 'lucide-react';
import { useMemo } from 'react';
import { useShownRevision } from '../../features/history/shownRevision';
import { hotkey } from '../../lib/shortcutRegistry';
import { copyToClipboard } from '../../ui/copyToClipboard';
import { useCommands, type Command } from '../commands/commandStore';
import { useNavigation } from '../navigation/navigationStore';
import type { Page } from '../navigation/pages';
import type { ViewId } from '../navigation/views';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { workspaceLinkTo } from './linkTo';
import { useSelectedObjectLink } from './selectedObjectLink';
import { hasLinkToCopy, linkToCopy } from './shownLink';
import { shownFileNow } from './useShownFile';

/**
 * "Copy link" (⇧⌘C, the palette): a link to what is in front, as a browser's address bar has one
 * (docs/features/deep-links.md, "Where links are copied"): the lines selected in the page, else the page's own object,
 * else the object selected in the view, else the view (`linkToCopy`). What it copies is decided as it runs: the shell renders
 * again only when whether there is a link changes, never as a selection moves.
 */
export function useCopyLinkCommand(): void {
  const workspacePath = useWorkspacePath();
  const top = useNavigation((state) => state.pages.at(-1));
  const view = useNavigation((state) => state.view);
  const hasSelectedObject = useSelectedObjectLink((state) => state.source !== null);
  const shownOfOtherRepository = useShownRevision((state) => state.shown?.otherRepository === true);
  const hasLink = hasLinkToCopy({ top, hasSelectedObject, view, shownOfOtherRepository });

  useCommands(
    useMemo<Command[]>(
      () => [
        {
          id: 'workspace.copyLink',
          group: 'Workspace',
          label: 'Copy link',
          icon: Link,
          keywords: ['share', 'url', 'uvcs'],
          shortcut: hotkey('copyLink'),
          disabled: !hasLink,
          run: () => void copyLinkNow(workspacePath, top, view),
        },
      ],
      [hasLink, workspacePath, top, view],
    ),
  );
}

/** Copies the link to what is in front now: the stores read as the command runs. */
async function copyLinkNow(workspacePath: string, top: Page | undefined, view: ViewId): Promise<void> {
  const source = useSelectedObjectLink.getState().source?.current ?? null;
  const toCopy = linkToCopy({ top, shown: shownFileNow(top), hasSelectedObject: source !== null, view });
  if (!toCopy) return;
  const link = toCopy.kind === 'selectedObject' ? source : workspaceLinkTo(workspacePath, toCopy.target);
  const text = typeof link === 'function' ? await link() : link;
  if (text) copyToClipboard(text, 'Link');
}
