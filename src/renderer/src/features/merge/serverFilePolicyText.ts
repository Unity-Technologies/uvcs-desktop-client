import type { ServerFilePolicy } from './mergeResolutions';
import type { ConflictLabels } from './resolve/threeWayMerge';

export interface ServerFilePolicyText {
  title: string;
  explanation: string;
  keep: Record<ServerFilePolicy, string>;
}

/** The words of the one choice a merge into a server branch asks for; "for all" only when there are several files. */
export function serverFilePolicyText(path: string, fileCount: number, labels: ConflictLabels, policy: ServerFilePolicy | undefined): ServerFilePolicyText {
  const several = fileCount > 1;
  const kept = policy && (policy === 'source' ? labels.source : labels.destination);
  return {
    title: kept ? `Keeping ${kept}${several ? ' for every conflicting file' : ''}` : `${path} changed on both sides`,
    explanation: several
      ? `Server merges can't combine files: keep one version for all ${fileCount} conflicting files, or merge in a workspace to combine them.`
      : "Server merges can't combine files: keep one version, or merge in a workspace to combine them.",
    keep: {
      destination: `Keep ${labels.destination}${several ? ' for all' : ''}`,
      source: `Keep ${labels.source}${several ? ' for all' : ''}`,
    },
  };
}
