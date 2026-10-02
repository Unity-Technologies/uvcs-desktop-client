import type { AppFileSystem } from '../../system/apps/appFileSystem';
import { findFirst, findOnPath } from '../../system/apps/findProgram';
import type { Whereabouts } from '../../system/apps/whereabouts';
import type { KnownTool } from './knownTools';

export interface DetectedTool {
  tool: KnownTool;
  executable: string;
}

/** The known tools installed here, each at its first location found, then on the PATH. */
export function detectKnownTools(tools: KnownTool[], where: Whereabouts, fs: AppFileSystem): DetectedTool[] {
  return tools.flatMap((tool) => {
    if (tool.requires && !tool.requires(where).some((path) => fs.exists(path))) return [];
    const executable = findFirst(tool.locations(where), where, fs) ?? findOnPath(tool.commands[where.platform] ?? [], where, fs);
    return executable ? [{ tool, executable }] : [];
  });
}
