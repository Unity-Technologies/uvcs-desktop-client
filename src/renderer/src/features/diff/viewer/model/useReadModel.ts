import { useEffect, useState } from 'react';
import type { ModelBytes } from '@shared/domain/content';
import { readModel } from './modelWorkerSession';
import type { ModelFileRead } from './readModelFile';

export type ModelReadState = { status: 'idle' } | { status: 'loading' } | ({ status: 'ready' } & Extract<ModelFileRead, { kind: 'read' }>) | ({ status: 'failed' } & Extract<ModelFileRead, { kind: 'failed' }>);

/** One version of a model, read in the model worker; idle when there's no version on that side (added, deleted). */
export function useReadModel(model: ModelBytes | undefined): ModelReadState {
  const [kept, setKept] = useState<{ model: ModelBytes; read: ModelFileRead } | null>(null);

  useEffect(() => {
    if (!model) return;
    let stale = false;
    void readModel(model).then((read) => {
      if (!stale) setKept({ model, read });
    });
    return () => {
      stale = true;
    };
  }, [model]);

  if (!model) return { status: 'idle' };
  // Only the read of these bytes: another file's would show for a frame as the selection moves.
  if (kept?.model !== model) return { status: 'loading' };
  return kept.read.kind === 'read' ? { status: 'ready', ...kept.read } : { status: 'failed', ...kept.read };
}
