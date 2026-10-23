type List<T> = (paths: readonly string[]) => Promise<Map<string, T>>;

/**
 * Lists the paths with one call; when it fails, lists each half on its own, and the half that fails again is split
 * again, so the paths that can be listed are, however few fail. `cm ls` fails on a path it can't find, its message in
 * the records it streams (`queryRecords`), never in the error, so which one failed can't be read: narrowing down costs
 * about two calls per halving for each path that fails, never one call per path. When both halves of the first split
 * fail, the listing itself failed (the server, `cm`), and so does this, as `RevisionCat` does (`narrowDown`).
 */
export async function listNarrowingDown<T>(paths: readonly string[], list: List<T>): Promise<Map<string, T>> {
  if (paths.length === 0) return new Map();
  try {
    return await list(paths);
  } catch (error) {
    if (paths.length === 1) throw error;
    const [first, second] = halvesOf(paths);
    const tried = await Promise.allSettled([list(first), list(second)]);
    if (tried.every((result) => result.status === 'rejected')) throw error;
    return mergedListings([first, second], tried, list);
  }
}

/**
 * The paths a listing known to work lists: each half's that didn't fail, and those of a half that failed, narrowed
 * down again. A path alone that fails is one that can't be listed.
 */
async function narrowedDown<T>(paths: readonly string[], list: List<T>): Promise<Map<string, T>> {
  if (paths.length === 1) return new Map();
  const halves = halvesOf(paths);
  return mergedListings(halves, await Promise.allSettled(halves.map((half) => list(half))), list);
}

async function mergedListings<T>(halves: readonly (readonly string[])[], tried: PromiseSettledResult<Map<string, T>>[], list: List<T>): Promise<Map<string, T>> {
  const listed = await Promise.all(tried.map((result, index) => (result.status === 'fulfilled' ? result.value : narrowedDown(halves[index]!, list))));
  return new Map(listed.flatMap((each) => [...each]));
}

function halvesOf(paths: readonly string[]): [readonly string[], readonly string[]] {
  const middle = Math.ceil(paths.length / 2);
  return [paths.slice(0, middle), paths.slice(middle)];
}
