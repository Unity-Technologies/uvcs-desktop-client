import { useEffect, useMemo, useState } from 'react';
import type { ModelBytes } from '@shared/domain/content';
import { readModel } from './modelWorkerSession';
import { PLAIN_READ, type ModelFileRead, type ModelReadOptions } from './readModelFile';

export type ModelReadState = { status: 'idle' } | { status: 'loading' } | ({ status: 'ready' } & Extract<ModelFileRead, { kind: 'read' }>) | ({ status: 'failed' } & Extract<ModelFileRead, { kind: 'failed' }>);

/**
 * One version of a model, read in the model worker; idle when there's no version on that side (added, deleted).
 * `options`: the files it needs beside it and its import settings, read (`useModelReadOptions`); null while they are.
 */
export function useReadModel(model: ModelBytes | undefined, options: ModelReadOptions | null = PLAIN_READ): ModelReadState {
  const [kept, setKept] = useState<{ model: ModelBytes; options: ModelReadOptions; read: ModelFileRead } | null>(null);

  useEffect(() => {
    if (!model || !options) return;
    let stale = false;
    void readModel(model, options).then((read) => {
      if (!stale) setKept({ model, options, read });
    });
    return () => {
      stale = true;
    };
  }, [model, options]);

  // One object while nothing changes: the viewer builds a scene, a comparison and the panel's rows from it.
  const shown = kept?.model === model && kept?.options === options ? kept : null;
  const ready = useMemo<ModelReadState | null>(() => (shown ? (shown.read.kind === 'read' ? { status: 'ready', ...shown.read } : { status: 'failed', ...shown.read }) : null), [shown]);
  if (!model) return IDLE;
  // Only the read of these bytes: another file's would show for a frame as the selection moves.
  return ready ?? LOADING;
}

const IDLE: ModelReadState = { status: 'idle' };
const LOADING: ModelReadState = { status: 'loading' };
