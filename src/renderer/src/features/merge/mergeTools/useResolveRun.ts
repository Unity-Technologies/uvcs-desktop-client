import { useCallback, useEffect, useRef, useState } from 'react';
import type { MergeTool, MergeToolOutcome } from '@shared/domain/mergeTools';
import { api } from '../../../api/client';
import { useSettings } from '../../../app/settings/useSettings';
import { fileNameOf } from '../../../lib/text';
import { toast } from '../../../ui/toast/toastStore';
import type { MergeLabels } from '../mergeDescription';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { toolOutcomeMessage, waitsForTool } from './mergeToolOutcome';
import { planRun, runSummary, type RunPlan, type RunProgress } from './resolveRun';

interface ResolveRunOptions {
  states: FileConflictState[];
  labels: MergeLabels;
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

interface RunControl {
  stopped: boolean;
  /** While paused on a file closed unsaved: settles with whether to go on. */
  answer?: (goOn: boolean) => void;
}

type Ended = { plan: RunPlan; stopped: boolean; failure?: { outcome: MergeToolOutcome; path: string } };

/**
 * Resolves every file waiting for the user in one merge tool, one after the other: the next opens once the user saves
 * and closes the one before. Never more than one tool open; files decided meanwhile are skipped; a file closed unsaved
 * asks whether to go on (or goes on, as the settings say); a tool that fails to open stops the run.
 */
export function useResolveRun({ states, labels, resolveInTool, onOpen, onEnd }: ResolveRunOptions): ResolveRun {
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
    const stillWaits = (key: string): boolean => {
      const state = latest.current.states.find((candidate) => candidate.file.key === key);
      return Boolean(state && waitsForTool(state, tool));
    };

    let previousKey: string | undefined;
    let failure: Ended['failure'];
    for (const [position, key] of plan.keys.entries()) {
      if (run.stopped) break;
      if (!stillWaits(key)) continue;
      const current: RunProgress = { toolName: tool.name, total: plan.keys.length, position, currentKey: key, paused: false };
      setProgress(current);
      latest.current.onOpen(key, previousKey);
      previousKey = key;

      const outcome = await latest.current.resolveInTool(key, tool, true);
      if (run.stopped || !outcome) break;
      if (outcome.kind === 'failed') {
        failure = { outcome, path: latest.current.states.find((state) => state.file.key === key)?.file.path ?? key };
        break;
      }
      // Closed by the user without saving (not skipped from here): maybe they meant to stop, so ask before the next.
      const closedUnsaved = outcome.kind === 'unchanged' && outcome.exitCode !== null;
      if (closedUnsaved && latest.current.askWhenMergeToolClosesUnsaved && plan.keys.slice(position + 1).some(stillWaits)) {
        setProgress({ ...current, paused: true });
        const goOn = await new Promise<boolean>((resolve) => (run.answer = resolve));
        run.answer = undefined;
        if (!goOn) break;
      }
    }
    if (control.current !== run) return; // Left the page meanwhile.
    control.current = null;
    setProgress(null);
    setEnded({ plan, stopped: run.stopped, failure });
  }, []);

  // Told once the last decision shows in the states, so the count is right.
  useEffect(() => {
    if (!ended) return;
    setEnded(undefined);
    const { plan, stopped, failure } = ended;
    if (failure) {
      const message = toolOutcomeMessage(failure.outcome, plan.tool.name, fileNameOf(failure.path), labels);
      const reason = message.detail && !/[.!?]$/.test(message.detail) ? `${message.detail}.` : message.detail;
      toast.error(message.title, [reason, 'Stopped resolving one by one.'].filter(Boolean).join(' '));
    } else {
      const resolved = plan.keys.filter((key) => states.find((state) => state.file.key === key)?.resolution).length;
      const summary = runSummary({ resolved, total: plan.keys.length, stopped }, plan);
      toast[summary.kind](summary.title, summary.detail);
    }
    onEnd();
  }, [ended, states, labels, onEnd]);

  // Leaving the page ends the run; useFileConflicts stops waiting for the tool still open.
  useEffect(
    () => () => {
      const run = control.current;
      control.current = null;
      if (run) {
        run.stopped = true;
        run.answer?.(false);
      }
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
    run.stopped = true;
    const session = openSession();
    if (session) void api.mergeTools.stopWaiting(session);
    run.answer?.(false);
  };

  return { progress, start: (tool) => void start(tool), skip, proceed, stop };
}
