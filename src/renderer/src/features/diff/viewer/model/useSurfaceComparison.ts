import { useEffect, useState } from 'react';
import { compareModels } from './modelWorkerSession';
import type { ParsedModel } from './parsedModel';
import type { SurfaceComparison } from './surfaceComparison';

/** The pair's surfaces compared in the model worker, once the Differences mode asks; null until then and meanwhile. */
export function useSurfaceComparison(before: ParsedModel | null, after: ParsedModel | null, wanted: boolean): { comparison: SurfaceComparison | null; comparing: boolean } {
  const [kept, setKept] = useState<{ before: ParsedModel; after: ParsedModel; comparison: SurfaceComparison } | null>(null);

  useEffect(() => {
    if (!wanted || !before || !after) return;
    let stale = false;
    void compareModels(before, after).then((comparison) => {
      if (!stale) setKept({ before, after, comparison });
    });
    return () => {
      stale = true;
    };
  }, [wanted, before, after]);

  // Only the comparison of this pair: another file's would show for a frame as the selection moves.
  const comparison = kept && kept.before === before && kept.after === after ? kept.comparison : null;
  return { comparison, comparing: wanted && before !== null && after !== null && comparison === null };
}
