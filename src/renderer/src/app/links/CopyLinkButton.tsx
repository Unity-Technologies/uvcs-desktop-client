import { Link } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import type { Page } from '../navigation/pages';
import { useSession } from '../workspace/sessionStore';
import { copyPageObjectLink } from './copyPageLink';
import { objectLinkLabel, pageObjectTarget } from './shownLink';
import { useShownFile } from './useShownFile';

/**
 * Copies a link to what a page is about (`pageObjectTarget`): its changeset, branch, shelve, review, a history's item, a
 * browsed changeset. Never the file or lines it shows: the line chip and the lines' menu copy those. None for a page no
 * link names.
 */
export function CopyLinkButton({ page, className }: { page: Page; className?: string }) {
  const workspacePath = useSession((state) => state.workspacePath);
  const target = pageObjectTarget(page, useShownFile(page));
  if (!target || !workspacePath) return null;
  return <IconButton className={className} size="small" icon={<Link size={14} />} label={objectLinkLabel(target)} onClick={() => void copyPageObjectLink(workspacePath, page)} />;
}
