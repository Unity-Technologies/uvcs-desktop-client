import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';
import { installedAndNeededText } from '@shared/domain/cmVersionWords';

export type CmTooOld = Extract<CmRuntimeStatus, { kind: 'installedTooOld' }>;

/** Where the user's last Check Again stands: none yet, reading the version, or it found the same old one. */
export type CmUpdateCheck = 'none' | 'checking' | 'stillTooOld';

/**
 * What the update screen shows when the Unity Version Control installed on the computer is older than the app needs
 * (docs/features/cm-runtime.md "The update screen"). Its words never say `cm`, command line, installer or bundle; the
 * versions show on a line of their own (`cmVersionWords`), the installed one's path under Details. One kind for now:
 * the update itself (its button, its progress) is still to come.
 */
export interface CmUpdateView {
  kind: 'needed';
  title: string;
  body: string;
  /** "Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later". */
  versions: string;
  /** What to do next: changes once a Check Again found the same old version. */
  hint: string;
  checkAgainLabel: string;
  checking: boolean;
  includedLabel: string;
  /** Where the installed one is, folded under Details. */
  detail: string;
}

export function cmUpdateViewOf(status: CmTooOld, check: CmUpdateCheck): CmUpdateView {
  const { installed, requiredVersion } = status;
  return {
    kind: 'needed',
    title: 'Update Unity Version Control',
    body: 'This app needs a newer version of Unity Version Control on this computer.',
    versions: installedAndNeededText(installed.version, requiredVersion),
    hint: check === 'stillTooOld' ? 'It still needs an update. Update it, then check again.' : 'Update it, then come back to this window. You can also keep working with the version included with the app.',
    checkAgainLabel: check === 'checking' ? 'Checking…' : 'Check Again',
    checking: check === 'checking',
    includedLabel: 'Use the included version for now',
    detail: installed.path,
  };
}
