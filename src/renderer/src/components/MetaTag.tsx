import { ItemTag } from './ItemTag';

/** What the tag means where a row's `.meta` is only shown with it: a diff, a details panel, Incoming, the merge page. */
const SHOWN_TIP = 'Its .meta changed too, and shares this row.';
/** What it means in Changes, where what changes the row changes the `.meta` too (`withMetas`). */
const TAKEN_ALONG_TIP =
  'Its .meta changed too, and shares this row: checking it in, undoing it or moving it to a changelist takes the .meta along.';

/**
 * "+ meta", small, on the row of a Unity asset (or folder) whose `.meta` changed alike and joined it
 * (`pairUnityMetas`), with a tip saying so: in Changes (`takenAlong`), also that what the row does, its `.meta` gets too.
 */
export function MetaTag({ takenAlong = false }: { takenAlong?: boolean }) {
  return (
    <ItemTag compact tip={takenAlong ? TAKEN_ALONG_TIP : SHOWN_TIP}>
      + meta
    </ItemTag>
  );
}
