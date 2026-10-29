import { normalize } from 'node:path';
import type { RepositoryVersion } from '@shared/domain/content';
import { workspacePathOf, type Place } from '@shared/domain/place';
import { placeholderValues, toolArgs, type ResolvedSubject } from '@shared/domain/toolArgs';
import type { ToolSubject } from '@shared/domain/tools';
import type { SettingsStore } from '../settings/SettingsStore';
import type { AppFileSystem } from '../system/apps/appFileSystem';
import { appExecutable } from '../system/apps/appExecutable';
import { runProgram, type LaunchCommand } from '../system/apps/launchCommand';
import { expandEnvironment } from './expandEnvironment';

export interface ToolRunDependencies {
  settings: Pick<SettingsStore, 'get'>;
  /** Saves a revision to a temp file named `fileName`: the path saved (`revisionFiles`). */
  saveRevision: (place: Place, version: RepositoryVersion, fileName: string) => Promise<string>;
  launch: (command: LaunchCommand) => Promise<void>;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  fs: AppFileSystem;
}

/**
 * Runs the user's tool on each subject, one process each and in order, as the official client did: started, never
 * waited for, in the workspace's folder. A revision is saved to a temp file first. The first that can't start stops
 * the rest and rejects; a macOS app bundle runs its program, so it gets the arguments.
 */
export async function runTool(dependencies: ToolRunDependencies, place: Place, toolId: string, subjects: readonly ToolSubject[]): Promise<void> {
  const { settings, saveRevision, launch, platform, env, fs } = dependencies;
  const tool = settings.get().tools.find((candidate) => candidate.id === toolId);
  if (!tool) throw new Error("That tool isn't there anymore.");
  const program = appExecutable(expandEnvironment(tool.program, env, platform), fs);
  const workspacePath = workspacePathOf(place);
  const context = { repository: place.kind === 'repository' ? place.repository : undefined, workspacePath };
  for (const subject of subjects) {
    const resolved: ResolvedSubject =
      subject.kind === 'revision'
        ? { kind: 'item', path: await saveRevision(place, subject.version, subject.fileName), ...(subject.repository && { repository: subject.repository }) }
        : subject.kind === 'item'
          ? { ...subject, path: normalize(subject.path) }
          : subject;
    await launch(runProgram(platform, program, toolArgs(tool.args, placeholderValues(resolved, context)), workspacePath ?? undefined));
  }
}
