import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';

/**
 * About's `cm` line: its version and which one it is, the app's own or the one installed (docs/features/cm-runtime.md);
 * the version alone while the app's own is still set up, and "…" until `cm version` answers.
 */
export function aboutCmValue(version: string | undefined, status: CmRuntimeStatus): string {
  if (version === undefined) return '…';
  if (status.kind !== 'ready') return version;
  const which = { managed: 'included with the app', installed: 'installed', environment: 'UVCS_CM_PATH' }[status.source];
  return `${version}, ${which}`;
}
