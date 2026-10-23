import { ranksBefore, scoreOf, toNeedle } from '@shared/fuzzyScore';
import type { ListedPath } from '../cm/repositoryPaths';

interface Ranked extends ListedPath {
  score: number;
}

/**
 * The best matches of a query among paths offered one by one, ranked as the renderer's lists rank them
 * (`scoreOf`, `ranksBefore`): only the best `limit` are kept, so a tree of any size is searched in the memory of a
 * few results. `changed` tells whether an offer since the last `take` changed them.
 */
export class BestPaths {
  private readonly needle: string;
  private readonly best: Ranked[] = [];
  private changedSinceTake = false;

  constructor(
    query: string,
    private readonly limit: number,
  ) {
    this.needle = toNeedle(query);
  }

  /** Considers one path; returns whether it is among the best now. */
  offer(item: ListedPath): boolean {
    if (!this.needle) return false;
    const score = scoreOf(item.path.toLowerCase(), this.needle);
    if (score === 0) return false;
    const ranked = { text: item.path, score };
    const worst = this.best.at(-1);
    if (this.best.length === this.limit && worst && !ranksBefore(ranked, { text: worst.path, score: worst.score })) return false;
    if (this.best.length === this.limit) this.best.pop();
    let position = this.best.length;
    while (position > 0 && ranksBefore(ranked, { text: this.best[position - 1]!.path, score: this.best[position - 1]!.score })) position--;
    this.best.splice(position, 0, { path: item.path, isDirectory: item.isDirectory, score });
    this.changedSinceTake = true;
    return true;
  }

  get changed(): boolean {
    return this.changedSinceTake;
  }

  /** The best so far, best first. */
  take(): ListedPath[] {
    this.changedSinceTake = false;
    return this.best.map(({ path, isDirectory }) => ({ path, isDirectory }));
  }
}
