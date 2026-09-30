import type { OperationContext } from '../OperationTracker';

/** An operation context that records the steps and activities it is told about. */
export function recordingContext(signal: AbortSignal = new AbortController().signal) {
  const steps: string[] = [];
  const activities: string[] = [];
  const context: OperationContext = {
    signal,
    reportProgress: (activity) => activities.push(activity),
    beginStep: (label, index, count) => steps.push(`${index}/${count} ${label}`),
    progressOf: () => () => {},
  };
  return { context, steps, activities };
}
