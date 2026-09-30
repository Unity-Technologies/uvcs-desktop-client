import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { api } from '../../api/client';
import { useCommands, type Command } from '../../app/commands/commandStore';
import type { LockRulesPage } from './lockRulesPage';

/** Opens the server's lock rules page in the browser: no `cm` command reads or edits the rules. */
export const openLockRules = (page: LockRulesPage): void => void api.system.openExternal(page.url);

/** "Configure lock rules" in the palette while the Locks view shows, where the server has a page for them. */
export function useLockRulesCommand(page: LockRulesPage | null): void {
  useCommands(
    useMemo<Command[]>(
      () =>
        page
          ? [{ id: 'locks.configureRules', group: 'Locks', label: 'Configure lock rules', icon: ExternalLink, keywords: ['exclusive checkout'], run: () => openLockRules(page) }]
          : [],
      [page],
    ),
  );
}
