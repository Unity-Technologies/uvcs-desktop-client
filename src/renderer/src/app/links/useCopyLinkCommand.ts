import { Link } from 'lucide-react';
import { useMemo } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import { copyToClipboard } from '../../ui/copyToClipboard';
import { useCommands, type Command } from '../commands/commandStore';
import { useNavigation } from '../navigation/navigationStore';
import { useWorkspacePath } from '../workspace/useWorkspace';
import type { LinkTarget } from './linkNavigation';
import { workspaceLinkTo } from './linkTo';
import { useSelectedObjectLink } from './selectedObjectLink';
import { pageLinkTarget, viewLinkTarget, type SelectedLines } from './shownLink';

/**
 * "Copy link" (⇧⌘C, the palette): a link to what is in front, as a browser's address bar has one
 * (docs/features/deep-links.md, "Where links are copied"): the page (the file and the lines selected in it), else the
 * object selected in the view, else the view.
 */
export function useCopyLinkCommand(selectedLines: SelectedLines | null = null): void {
  const workspacePath = useWorkspacePath();
  const top = useNavigation((state) => state.pages.at(-1));
  const view = useNavigation((state) => state.view);
  const objectLink = useSelectedObjectLink((state) => state.link);

  useCommands(
    useMemo<Command[]>(() => {
      const target: LinkTarget | null = top ? pageLinkTarget(top, selectedLines) : objectLink ? null : viewLinkTarget(view);
      const link = target ? workspaceLinkTo(workspacePath, target) : objectLink;
      return [
        {
          id: 'workspace.copyLink',
          group: 'Workspace',
          label: 'Copy link',
          icon: Link,
          keywords: ['share', 'url', 'uvcs'],
          shortcut: hotkey('copyLink'),
          disabled: !link,
          run: () => void copyLink(link),
        },
      ];
    }, [workspacePath, top, view, objectLink, selectedLines]),
  );
}

async function copyLink(link: string | (() => Promise<string | undefined>) | null): Promise<void> {
  const text = typeof link === 'function' ? await link() : link;
  if (text) copyToClipboard(text, 'Link');
}
