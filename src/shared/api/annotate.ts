import type { Annotation } from '../domain/annotate';

export interface AnnotateApi {
  /**
   * Who last changed each line of a workspace-relative file.
   * `revisionSpec` (e.g. `src/app.ts#cs:12`) annotates a past revision instead of the loaded one.
   */
  file(workspacePath: string, path: string, revisionSpec?: string): Promise<Annotation>;
}
