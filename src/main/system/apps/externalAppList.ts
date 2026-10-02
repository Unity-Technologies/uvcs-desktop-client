import { AUTO_APP, SYSTEM_APP, type CustomEditor, type ExternalApp, type ExternalApps } from '@shared/domain/externalApps';
import type { AppFileSystem } from './appFileSystem';
import { findEditor, KNOWN_EDITORS, type KnownEditor } from './editors';
import type { InstalledApps } from './installedApps';
import { macOpen, runProgram, type LaunchCommand } from './launchCommand';
import { automaticTerminal, KNOWN_TERMINALS, type KnownTerminal } from './terminals';
import type { Whereabouts } from './whereabouts';

export interface ExternalAppSources {
  where: Whereabouts;
  installed: InstalledApps;
  fs: AppFileSystem;
  custom: CustomEditor[];
  /** `auto`, `system` or an editor id. */
  editorPreference: string;
  /** `auto` or a terminal id. */
  terminalPreference: string;
  editors?: KnownEditor[];
  terminals?: KnownTerminal[];
}

/** The apps on offer, and how each one opens a path, by id. */
export interface ExternalAppList {
  apps: ExternalApps;
  launchers: Map<string, (path: string) => LaunchCommand>;
}

/** Every editor and terminal found here, then the user's own editors, with the ones "Open in…" uses. */
export function externalAppList(sources: ExternalAppSources): ExternalAppList {
  const { where, installed, fs } = sources;
  const launchers = new Map<string, (path: string) => LaunchCommand>();
  const app = (id: string, name: string, origin: ExternalApp['origin'], location: string, opensFolders: boolean, launch: (path: string) => LaunchCommand): ExternalApp => {
    launchers.set(id, launch);
    return { id, name, origin, location, opensFolders };
  };

  const known = (sources.editors ?? KNOWN_EDITORS).flatMap((editor) => {
    const found = findEditor(editor, where, installed, fs);
    return found ? [app(editor.id, editor.name, 'known', found.location, editor.opensFolders, found.launch)] : [];
  });
  const custom = sources.custom.map((editor) => app(editor.id, editor.name, 'custom', editor.executable, true, customLauncher(editor.executable, where.platform)));
  const terminals = (sources.terminals ?? KNOWN_TERMINALS)
    .filter((terminal) => terminal.platform === where.platform)
    .flatMap((terminal) => {
      const found = terminal.find(where, installed, fs);
      return found ? [app(terminal.id, terminal.name, 'known', found.location, true, found.launch)] : [];
    });

  const editors = [...known, ...custom];
  const terminalIds = terminals.map((terminal) => terminal.id);
  return {
    apps: {
      editors,
      terminals,
      editorId: sources.editorPreference === SYSTEM_APP ? null : (chosen(sources.editorPreference, editors.map((editor) => editor.id)) ?? known[0]?.id ?? custom[0]?.id ?? null),
      terminalId: chosen(sources.terminalPreference, terminalIds) ?? automaticTerminal(terminalIds, where.platform, where.env),
    },
    launchers,
  };
}

/** The user's pick while it's on offer; a pick that's gone falls back to the automatic one. */
function chosen(preference: string, ids: string[]): string | undefined {
  return preference !== AUTO_APP && ids.includes(preference) ? preference : undefined;
}

/** A macOS app bundle the user picked opens the path as Finder would; any other program gets it as its argument. */
function customLauncher(executable: string, platform: NodeJS.Platform): (path: string) => LaunchCommand {
  if (platform === 'darwin' && /\.app\/?$/.test(executable)) return (path) => macOpen(executable.replace(/\/$/, ''), path);
  return (path) => runProgram(platform, executable, [path]);
}
