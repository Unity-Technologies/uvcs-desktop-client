import type { SmartMergeTool } from '@shared/domain/mergeTools';

/**
 * What Settings says about Smart Merge when a Unity Editor is installed: which editor's it uses, and that the merge
 * tool opens only for what Smart Merge can't merge. Nothing to choose: it isn't a setting.
 */
export function smartMergeNote(smartMerge: SmartMergeTool, toolName: string | undefined): string {
  const editor = smartMerge.editorVersion ? `Unity ${smartMerge.editorVersion}` : 'Unity';
  const tool = toolName ?? 'The merge tool';
  return `Smart Merge (${editor}) merges them first, without opening anything. ${tool} opens only for what it can't merge.`;
}
