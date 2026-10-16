// The objects lists read with `cm find`, as `--format` records: just the fields each list needs, split by control
// characters (`recordFormat`). Records are about a third the size of `--xml` for the same objects and parse in a
// third of the time, and a list stays far from the output limit (`MAX_OUTPUT_LENGTH`) that XML reaches first.
// `cm find --xml` prints the same fields through the same formatter, so the values are the same; dates come in
// `FIND_DATE_FORMAT` (`findCommand`).

import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import type { Shelve } from '@shared/domain/shelve';
import { repositorySpec } from '@shared/domain/specs';
import { parseRecords, recordFormat } from './formatRecords';

/** How one kind of object is read with `cm find`: the object, the fields printed of each, and what a record becomes. */
export interface FoundObjects<T, Field extends string = string> {
  /** As `cm find` names it: `branch`, `label`... */
  object: string;
  fields: readonly Field[];
  read: (value: (field: Field) => string) => T;
}

/** Declares how `object`s are read; `read` gets each record's values by field name. */
export function foundObjects<Field extends string, T>(object: string, fields: readonly Field[], read: (value: (field: Field) => string) => T): FoundObjects<T, Field> {
  return { object, fields, read };
}

/** The `--format` that prints the objects' fields as `parseFound` reads them. */
export function foundFormat(found: FoundObjects<unknown>): string {
  return `--format=${recordFormat(found.fields)}`;
}

/** The objects of a `cm find` output printed through `foundFormat`. */
export function parseFound<T, Field extends string>({ fields, read }: FoundObjects<T, Field>, output: string): T[] {
  const indexes = new Map(fields.map((field, index) => [field, index]));
  return parseRecords(output).map((values) => read((field) => values[indexes.get(field)!] ?? ''));
}

/** A number `cm` printed; -1 where it printed none. */
export function integerValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}

export const FOUND_BRANCHES = foundObjects(
  'branch',
  ['id', 'name', 'parent', 'comment', 'owner', 'date', 'changeset', 'guid', 'repname', 'repserver'],
  (value): Branch => ({
    id: integerValue(value('id')),
    name: value('name'),
    parent: value('parent'),
    comment: value('comment'),
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
    comment: value('comment'),
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
    comment: value('comment'),
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
    comment: value('comment'),
    owner: value('owner'),
    date: value('date'),
    parentChangeset: integerValue(value('parent')),
    repository: repositorySpec(value('repname'), value('repserver')),
  }),
);
