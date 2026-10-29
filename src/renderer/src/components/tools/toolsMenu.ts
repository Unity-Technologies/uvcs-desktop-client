import { Settings } from 'lucide-react';
import type { Place } from '@shared/domain/place';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { toolsFor, type Tool, type ToolSubject } from '@shared/domain/tools';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { openSettingsDialogAt } from '../../app/settings/SettingsDialog';
import { SEPARATOR } from '../../lib/actions';
import type { GroupedEntry } from '../../lib/menuGroups';
import { menuSubmenu } from '../menuWords';
import { runToolOn } from './toolOperations';

/**
 * "Tools ▸" with each of the user's tools that applies to every subject, then "Manage tools…"; none when no tool
 * applies, so a user without tools never sees it (docs/features/tools.md).
 */
export function toolsSubmenu(place: Place, subjects: ToolSubject[], tools: readonly Tool[] = currentTools()): GroupedEntry | null {
  const offered = toolsFor(tools, subjects);
  if (offered.length === 0) return null;
  return menuSubmenu('tools', [
    ...offered.map((tool) => ({ id: `tool.${tool.id}`, label: tool.name, run: () => void runToolOn(place, tool, subjects) })),
    SEPARATOR,
    { id: 'tools.manage', label: 'Manage tools…', icon: Settings, run: () => openSettingsDialogAt('tools') },
  ]);
}

/** The tools as last read: building a menu reads nothing. */
function currentTools(): Tool[] {
  return (queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? DEFAULT_SETTINGS).tools;
}
