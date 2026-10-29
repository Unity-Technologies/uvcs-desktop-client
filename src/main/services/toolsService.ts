import type { ToolsApi } from '@shared/api/tools';
import { diskFileSystem } from '../system/apps/appFileSystem';
import type { LaunchCommand } from '../system/apps/launchCommand';
import { runTool } from '../tools/runTool';
import { saveRevisionToTemp } from './revisionFiles';
import type { ServiceContext } from './ServiceContext';

export function createToolsService({ cm, workspaceCopies, settings }: Pick<ServiceContext, 'cm' | 'workspaceCopies' | 'settings'>, launch: (command: LaunchCommand) => Promise<void>): ToolsApi {
  const saveRevision: Parameters<typeof runTool>[0]['saveRevision'] = (place, version, fileName) => saveRevisionToTemp(cm, workspaceCopies, place, version, fileName);
  const dependencies = { settings, saveRevision, launch, platform: process.platform, env: process.env, fs: diskFileSystem };
  return {
    run: (place, toolId, subjects) => runTool(dependencies, place, toolId, subjects),
  };
}
