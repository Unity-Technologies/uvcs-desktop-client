import { Link } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import { copyToClipboard } from '../../ui/copyToClipboard';
import { useCommands, type Command } from '../commands/commandStore';
import { useNavigation } from '../navigation/navigationStore';
import { useWorkspacePath } from '../workspace/useWorkspace';
import type { LinkTarget } from './linkNavigation';
import { workspaceLinkTo } from './linkTo';
import { useSelectedObjectLink, type LinkText } from './selectedObjectLink';
import { pageLinkTarget, viewLinkTarget } from './shownLink';
import { useShownFile } from './useShownFile';

/**
 * "Copy link" (⇧⌘C, the palette): a link to what is in front, as a browser's address bar has one
 * (docs/features/deep-links.md, "Where links are copied"): the page (the file and the lines selected in it), else the
 * object selected in the view, else the view. What it copies is read as it runs, so the command changes only when
 * whether there is a link does.
 */
export function useCopyLinkCommand(): void {
  const workspacePath = useWorkspacePath();
  const top = useNavigation((state) => state.pages.at(-1));
  const view = useNavigation((state) => state.view);
  const objectLink = useSelectedObjectLink((state) => state.source);
  const shownFile = useShownFile(top);

  const pageTarget = top ? pageLinkTarget(top, shownFile) : null;
  const link: LinkText | null = top
    ? pageTarget && workspaceLinkTo(workspacePath, pageTarget)
    : (objectLink?.current ?? viewLink(workspacePath, viewLinkTarget(view)));
  const latest = useRef(link);
  latest.current = link;
  const hasLink = link !== null;

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
          run: () => void copyLink(latest.current),
        },
      ],
      [hasLink],
    ),
  );
}

function viewLink(workspacePath: string, target: LinkTarget | null): LinkText | null {
  return target && workspaceLinkTo(workspacePath, target);
}

async function copyLink(link: LinkText | null): Promise<void> {
  const text = typeof link === 'function' ? await link() : link;
  if (text) copyToClipboard(text, 'Link');
}
