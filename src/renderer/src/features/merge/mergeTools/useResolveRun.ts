import { useCallback, useEffect, useRef, useState } from 'react';
import type { MergeTool, MergeToolOutcome } from '@shared/domain/mergeTools';
import { api } from '../../../api/client';
import { useSettings } from '../../../app/settings/useSettings';
import { toast } from '../../../ui/toast/toastStore';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { waitsForTool } from './mergeToolOutcome';
import { resolveOneByOne, runEndMessage, stopRun, type RunControl, type RunEnd } from './resolveOneByOne';
import { planRun, type RunPlan, type RunProgress } from './resolveRun';

interface ResolveRunOptions {
  states: FileConflictState[];
  resolveInTool: (key: string, tool: MergeTool, quiet: boolean) => Promise<MergeToolOutcome | null>;
  /** A file opens in the tool: `previousKey` is the one before it, if any, to follow the run with the selection. */
  onOpen: (key: string, previousKey: string | undefined) => void;
  /** The run ended, and the user was told how it went. */
  onEnd: () => void;
}

/** What the page can do with the run. */
export interface ResolveRun {
  progress: RunProgress | null;
  start: (tool: MergeTool) => void;
  /** Closes the tool on the file open (what it saved so far counts) and opens the next. */
  skip: () => void;
  /** Goes on with the next file after one was closed unsaved. */
  proceed: () => void;
  stop: () => void;
}

type Ended = { plan: RunPlan; end: RunEnd };

/**
 * Resolves every file waiting for the user in one merge tool, one after the other: the next opens once the user saves
 * and closes the one before. Never more than one tool open; files decided meanwhile are skipped; a file closed unsaved
 * asks whether to go on (or goes on, as the settings say); a tool that fails to open stops the run.
 */
export function useResolveRun({ states, resolveInTool, onOpen, onEnd }: ResolveRunOptions): ResolveRun {
  const { askWhenMergeToolClosesUnsaved } = useSettings();
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [ended, setEnded] = useState<Ended>();
  const control = useRef<RunControl | null>(null);
  const latest = useRef({ states, askWhenMergeToolClosesUnsaved, onOpen, resolveInTool });
  latest.current = { states, askWhenMergeToolClosesUnsaved, onOpen, resolveInTool };

  const start = useCallback(async (tool: MergeTool): Promise<void> => {
    if (control.current || latest.current.states.some((state) => state.openTool)) return;
    const plan = planRun(latest.current.states, tool);
    if (plan.keys.length === 0) return;
    const run: RunControl = { stopped: false };
    control.current = run;
    const end = await resolveOneByOne(plan, run, {
      stillWaits: (key) => {
        const state = latest.current.states.find((candidate) => candidate.file.key === key);
        return Boolean(state && waitsForTool(state));
      },
      show: setProgress,
      open: (key, previousKey) => latest.current.onOpen(key, previousKey),
      resolve: (key) => latest.current.resolveInTool(key, tool, true),
      asksWhenClosedUnsaved: () => latest.current.askWhenMergeToolClosesUnsaved,
    });
    if (control.current !== run) return; // Left the page meanwhile.
    control.current = null;
    setProgress(null);
    setEnded({ plan, end });
  }, []);

  // Told once the last decision shows in the states, so the count is right.
  useEffect(() => {
    if (!ended) return;
    setEnded(undefined);
    const message = runEndMessage(ended.plan, ended.end, states);
    toast[message.kind](message.title, message.detail);
    onEnd();
  }, [ended, states, onEnd]);

  // Leaving the page ends the run; useFileConflicts stops waiting for the tool still open.
  useEffect(
    () => () => {
      const run = control.current;
      control.current = null;
      if (run) stopRun(run);
    },
    [],
  );

  const openSession = (): string | undefined => {
    const key = control.current && progress?.currentKey;
    return latest.current.states.find((state) => state.file.key === key)?.openTool?.sessionId;
  };

  const skip = (): void => {
    const session = openSession();
    if (session) void api.mergeTools.stopWaiting(session);
  };

  const proceed = (): void => control.current?.answer?.(true);

  const stop = (): void => {
    const run = control.current;
    if (!run) return;
    const session = openSession();
    if (session) void api.mergeTools.stopWaiting(session);
    stopRun(run);
  };

  return { progress, start: (tool) => void start(tool), skip, proceed, stop };
}
