import type { BranchExplorerData } from '@shared/domain/branchExplorer';

/**
 * The history as it arrives over IPC, made lighter to keep: each branch name, owner and link type is one shared copy
 * (IPC gives every record its own, and a big repository's history repeats a few thousand names hundreds of thousands
 * of times), and each record is rebuilt whole, so its fields live inside it instead of in a separate property store
 * (deserialized objects grow field by field). Same values.
 */
export function shareRepeatedStrings(data: BranchExplorerData): BranchExplorerData {
  const pool = new Map<string, string>();
  const shared = <Text extends string>(text: Text): Text => {
    const known = pool.get(text);
    if (known !== undefined) return known as Text;
    pool.set(text, text);
    return text;
  };
  return {
    changesets: data.changesets.map(({ id, branch, parent, date, owner, comment }) => ({ id, branch: shared(branch), parent, date, owner: shared(owner), comment })),
    branches: data.branches.map(({ id, name, parent, owner, date, comment, headChangeset, isHidden }) => ({
      id,
      name: shared(name),
      parent: shared(parent),
      owner: shared(owner),
      date,
      comment,
      headChangeset,
      isHidden,
    })),
    mergeLinks: data.mergeLinks.map(({ type, sourceChangeset, destinationChangeset }) => ({ type: shared(type), sourceChangeset, destinationChangeset })),
    labels: data.labels.map(({ name, changeset, owner, date, comment }) => ({ name, changeset, owner: shared(owner), date, comment })),
  };
}
