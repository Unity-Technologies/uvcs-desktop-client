import type { ToolsApi } from '@shared/api/tools';
import { diskFileSystem } from '../system/apps/appFileSystem';
import type { LaunchCommand } from '../system/apps/launchCommand';
import { runTool } from '../tools/runTool';
import { revisionFiles } from './revisionFiles';
import type { ServiceContext } from './ServiceContext';

export function createToolsService({ cm, workspaceCopies, settings }: ServiceContext, launch: (command: LaunchCommand) => Promise<void>): ToolsApi {
  const revisions = revisionFiles(cm, workspaceCopies, () => Promise.reject(new Error('Tools open no editor.')));
  const dependencies = { settings, saveRevision: revisions.saveToTemp, launch, platform: process.platform, env: process.env, fs: diskFileSystem };
  return {
    run: (place, toolId, subjects) => runTool(dependencies, place, toolId, subjects),
  };
}
