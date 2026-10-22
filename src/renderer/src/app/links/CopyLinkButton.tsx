import { Link } from 'lucide-react';
import { hotkey } from '../../lib/shortcutRegistry';
import { copyToClipboard } from '../../ui/copyToClipboard';
import { IconButton } from '../../ui/IconButton';
import type { Page } from '../navigation/pages';
import { useSession } from '../workspace/sessionStore';
import { workspaceLinkTo } from './linkTo';
import { copyLinkLabel, pageLinkTarget } from './shownLink';
import { useShownFile } from './useShownFile';

/** Copies a link to what a page shows, its file and selected lines included, as ⇧⌘C does; none for a page no link names. */
export function CopyLinkButton({ page, className }: { page: Page; className?: string }) {
  const workspacePath = useSession((state) => state.workspacePath);
  const target = pageLinkTarget(page, useShownFile(page));
  if (!target || !workspacePath) return null;
  const copy = async (): Promise<void> => copyToClipboard(await workspaceLinkTo(workspacePath, target)(), 'Link');
  return (
    <IconButton className={className} size="small" icon={<Link size={14} />} label={copyLinkLabel(target)} shortcut={hotkey('copyLink')} onClick={() => void copy()} />
  );
}
