/** Identifies a long-running operation so the renderer can follow its progress or cancel it. */
export interface OperationHandle {
  operationId: string;
}

/**
 * What a command is doing, in order: getting ready, working out what changes, moving data (down or up), writing to the
 * workspace, confirming on the server, wrapping up. `working` is anything else the app reports in its own words.
 */
export type ProgressStage =
  | 'preparing'
  | 'calculating'
  | 'downloading'
  | 'uploading'
  | 'applying'
  | 'confirming'
  | 'finishing'
  | 'working';

/** One command's progress, read from its output. */
export interface CommandProgress {
  stage: ProgressStage;
  /** Stable, human words for the stage ("Downloading"): never a path or a raw `cm` line. */
  stageLabel: string;
  /** Files (or items) done and to do, when the command tells. */
  current?: number;
  total?: number;
  bytesDone?: number;
  bytesTotal?: number;
  /** 0..1, or null while nothing tells how far along it is. */
  fraction: number | null;
  /** The file being worked on, only as a detail. */
  currentItem?: string;
  /** False once stopping the command would leave the workspace halfway (files being written, a checkin confirming). */
  cancellable?: boolean;
}

/** A step of an operation made of several commands, e.g. shelving, undoing, switching, bringing the changes. */
export interface ProgressStep {
  label: string;
  /** 1-based. */
  index: number;
  count: number;
}

export interface OperationProgress extends CommandProgress {
  step?: ProgressStep;
}
