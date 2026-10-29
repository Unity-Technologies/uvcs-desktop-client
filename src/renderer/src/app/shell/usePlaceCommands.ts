import { FolderLock, FolderOpen, House, ListChecks, Monitor, Moon, PanelRight, RefreshCw, ServerCog, ShieldCheck, Sun, TerminalSquare } from 'lucide-react';
import { useMemo } from 'react';
import { placeId } from '@shared/domain/place';
import type { ThemePreference } from '@shared/domain/settings';
import { toggleDetailsInFront } from '../../components/detailsInFront';
import { openOwnRepositoryPermissions } from '../../features/permissions/openPermissions';
import { setReviewMode } from '../../features/review/reviewModeSetting';
import type { Icon } from '../../lib/actions';
import { hotkey } from '../../lib/shortcutRegistry';
import { useCommands, type Command } from '../commands/commandStore';
import { viewCommands } from '../commands/viewCommands';
import { navigation } from '../navigation/navigationStore';
import { viewsOf } from '../navigation/viewRegistry';
import { invalidatePlace } from '../queryClient';
import { useSettings, useUpdateSettings } from '../settings/useSettings';
import { openWorkspaceFolder } from '../workspace/openWorkspaceFolder';
import { useSession } from '../workspace/sessionStore';
import { useOpenWorkspace } from '../workspace/useOpenWorkspace';
import { usePlace } from '../workspace/useWorkspace';
import { useCommandLogStore } from './commandLogStore';

const THEMES: { theme: ThemePreference; label: string; icon: Icon }[] = [
  { theme: 'system', label: 'Use system theme', icon: Monitor },
  { theme: 'light', label: 'Use light theme', icon: Sun },
  { theme: 'dark', label: 'Use dark theme', icon: Moon },
];

/**
 * Commands available everywhere inside a place, a workspace or a repository explored without one: going to its views,
 * refreshing it, review mode, its repository's permissions, the command log, the theme. A workspace adds its own
 * (`useWorkspaceCommands`), a repository its own (`useRepositoryCommands`).
 */
export function usePlaceCommands(): void {
  const place = usePlace();
  const goHome = useSession((state) => state.goHome);
  const openWorkspace = useOpenWorkspace();
  const { theme, reviewModeWorkspaces } = useSettings();
  const reviewing = reviewModeWorkspaces.includes(placeId(place));
  const updateSettings = useUpdateSettings();
  const commandLogOpen = useCommandLogStore((state) => state.open);

  const commands = useMemo<Command[]>(
    () => [
      ...viewCommands(viewsOf(place), navigation.goToView),
      {
        id: 'workspace.refresh',
        group: 'Workspace',
        label: 'Refresh',
        icon: RefreshCw,
        shortcut: hotkey('refresh'),
        run: () => void invalidatePlace(place),
      },
      {
        id: 'workspace.reviewMode',
        group: 'Workspace',
        label: reviewing ? 'Leave review mode' : 'Enter review mode',
        icon: ListChecks,
        keywords: ['review', 'reviewed', 'mark'],
        run: () => void setReviewMode(place, !reviewing),
      },
      {
        id: 'view.details',
        group: 'App',
        label: 'Hide or show details',
        icon: PanelRight,
        keywords: ['panel', 'inspector', 'collapse', 'expand'],
        shortcut: hotkey('toggleDetails'),
        run: toggleDetailsInFront,
      },
      { id: 'app.home', group: 'Go to', label: 'Home', icon: House, shortcut: hotkey('home'), run: goHome },
      {
        id: 'workspace.open',
        group: 'Workspace',
        label: 'Open another workspace…',
        icon: FolderOpen,
        shortcut: hotkey('openWorkspace'),
        run: () => void openWorkspaceFolder(openWorkspace),
      },
      {
        id: 'workspace.repositoryPermissions',
        group: 'Workspace',
        label: 'Repository permissions…',
        icon: ShieldCheck,
        keywords: ['security', 'acl', 'access', 'users', 'groups'],
        run: () => openOwnRepositoryPermissions(place, 'repository'),
      },
      {
        id: 'workspace.pathPermissions',
        group: 'Workspace',
        label: 'Path permissions…',
        icon: FolderLock,
        keywords: ['security', 'secured path', 'acl', 'access'],
        run: () => openOwnRepositoryPermissions(place, 'paths'),
      },
      {
        id: 'workspace.serverPermissions',
        group: 'Workspace',
        label: 'Server permissions…',
        icon: ServerCog,
        keywords: ['security', 'acl', 'access', 'repository server'],
        run: () => openOwnRepositoryPermissions(place, 'server'),
      },
      {
        id: 'app.commandLog',
        group: 'App',
        label: commandLogOpen ? 'Hide command log' : 'Show command log',
        icon: TerminalSquare,
        shortcut: hotkey('commandLog'),
        run: () => useCommandLogStore.getState().toggle(),
      },
      ...THEMES.map(({ theme: choice, label, icon }) => ({
        id: `app.theme.${choice}`,
        group: 'App',
        label,
        icon,
        keywords: ['theme', 'appearance'],
        // The theme in use is not offered again.
        disabled: choice === theme,
        run: () => updateSettings({ theme: choice }),
      })),
    ],
    [place, goHome, openWorkspace, theme, reviewing, commandLogOpen, updateSettings],
  );

  useCommands(commands);
}
