import { programInInstall } from '../../system/apps/appIdentity';
import type { AppFileSystem } from '../../system/apps/appFileSystem';
import { findFirst, findOnPath } from '../../system/apps/findProgram';
import { NO_INSTALLED_APPS, type InstalledApps } from '../../system/apps/installedApps';
import type { Whereabouts } from '../../system/apps/whereabouts';
import type { KnownTool } from './knownTools';

export interface DetectedTool {
  tool: KnownTool;
  executable: string;
}

/**
 * The known tools installed here: inside their app wherever the OS says it's installed (`programInInstall`), else at
 * their first usual location found, then on the PATH.
 */
export function detectKnownTools(tools: KnownTool[], where: Whereabouts, fs: AppFileSystem, installed: InstalledApps = NO_INSTALLED_APPS): DetectedTool[] {
  return tools.flatMap((tool) => {
    if (tool.requires && !tool.requires(where).some((path) => fs.exists(path))) return [];
    const inApp = tool.identity && programInInstall(tool.identity, tool.inInstall?.[where.platform as 'darwin' | 'win32'] ?? [], where, installed, fs);
    const executable = inApp || (findFirst(tool.locations(where), where, fs) ?? findOnPath(tool.commands[where.platform] ?? [], where, fs));
    return executable ? [{ tool, executable }] : [];
  });
}
