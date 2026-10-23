// The objects lists read with `cm find`, as `--format` records: just the fields each list needs, split by control
// characters (`recordFormat`; why records, not XML: ARCHITECTURE.md "Parsing `cm` output"). `cm find --xml` printed
// the same fields through the same formatter; what XML parsing did besides, records do too: CRLF becomes LF
// (`RecordReader`), and each layout trims the free text it shows. Dates come in `FIND_DATE_FORMAT` (`findCommand`).

import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import type { Shelve } from '@shared/domain/shelve';
import { repositorySpec } from '@shared/domain/specs';
import { integerValue, type RecordLayout } from './formatRecords';

/** How one kind of object is read with `cm find`: the object, the fields printed of each, and what a record becomes. */
export interface FoundObjects<T, Field extends string = string> extends RecordLayout<T, Field> {
  /** As `cm find` names it: `branch`, `label`... */
  object: string;
}

/** Declares how `object`s are read; `read` gets each record's values by field name. */
export function foundObjects<Field extends string, T>(object: string, fields: readonly Field[], read: (value: (field: Field) => string) => T): FoundObjects<T, Field> {
  return { object, fields, read };
}

export const FOUND_BRANCHES = foundObjects(
  'branch',
  ['id', 'name', 'parent', 'comment', 'owner', 'date', 'changeset', 'guid', 'repname', 'repserver'],
  (value): Branch => ({
    id: integerValue(value('id')),
    name: value('name'),
    parent: value('parent'),
    comment: value('comment').trim(),
    owner: value('owner'),
    date: value('date'),
    headChangeset: integerValue(value('changeset')),
    guid: value('guid'),
    repository: repositorySpec(value('repname'), value('repserver')),
  }),
);

export const FOUND_CHANGESETS = foundObjects(
  'changeset',
  ['changesetid', 'guid', 'branch', 'comment', 'owner', 'date', 'parent', 'repname', 'repserver'],
  (value): Changeset => ({
    id: integerValue(value('changesetid')),
    guid: value('guid'),
    branch: value('branch'),
    comment: value('comment').trim(),
    owner: value('owner'),
    date: value('date'),
    parent: integerValue(value('parent')),
    repository: repositorySpec(value('repname'), value('repserver')),
  }),
);

export const FOUND_LABELS = foundObjects(
  'label',
  ['id', 'name', 'changeset', 'branch', 'comment', 'owner', 'date', 'repname', 'repserver'],
  (value): Label => ({
    id: integerValue(value('id')),
    name: value('name'),
    changeset: integerValue(value('changeset')),
    branch: value('branch'),
    comment: value('comment').trim(),
    owner: value('owner'),
    date: value('date'),
    repository: repositorySpec(value('repname'), value('repserver')),
  }),
);

export const FOUND_SHELVES = foundObjects(
  'shelve',
  ['shelveid', 'guid', 'comment', 'owner', 'date', 'parent', 'repname', 'repserver'],
  (value): Shelve => ({
    id: integerValue(value('shelveid')),
    guid: value('guid'),
    comment: value('comment').trim(),
    owner: value('owner'),
    date: value('date'),
    parentChangeset: integerValue(value('parent')),
    repository: repositorySpec(value('repname'), value('repserver')),
  }),
);
