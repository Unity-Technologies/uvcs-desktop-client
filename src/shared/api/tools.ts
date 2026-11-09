import type { Place } from '../domain/place';
import type { ToolSubject } from '../domain/tools';

/** The user's tools (`AppSettings.tools`), run only when the user picks one. No `cm` call but a revision's download. */
export interface ToolsApi {
  /**
   * Runs the tool `toolId` on each subject, one process each and in order, in the place's workspace; a revision is
   * saved to a temp file first. Rejects at the first that can't start, the rest not run.
   */
  run(place: Place, toolId: string, subjects: ToolSubject[]): Promise<void>;
}
