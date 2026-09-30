import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import type { Shelve } from '@shared/domain/shelve';
import { repositorySpec } from '@shared/domain/specs';
import { child, children, integer, parseXml, text } from './parseXml';

type XmlRecord = Record<string, unknown>;

/** Reads the records of `cm find <object> --xml`. */
export function findRecords(xml: string, element: string): XmlRecord[] {
  return children(child(parseXml(xml, [element]), 'PLASTICQUERY'), element);
}

export function toBranch(record: XmlRecord): Branch {
  return {
    id: integer(record.ID),
    name: text(record.NAME),
    parent: text(record.PARENT),
    comment: text(record.COMMENT),
    owner: text(record.OWNER),
    date: text(record.DATE),
    headChangeset: integer(record.CHANGESET),
    guid: text(record.GUID),
    repository: repositoryOf(record),
  };
}

export function toChangeset(record: XmlRecord): Changeset {
  return {
    id: integer(record.CHANGESETID),
    guid: text(record.GUID),
    branch: text(record.BRANCH),
    comment: text(record.COMMENT),
    owner: text(record.OWNER),
    date: text(record.DATE),
    parent: integer(record.PARENT),
    repository: repositoryOf(record),
  };
}

export function toLabel(record: XmlRecord): Label {
  return {
    id: integer(record.ID),
    name: text(record.NAME),
    changeset: integer(record.CHANGESET),
    branch: text(record.BRANCH),
    comment: text(record.COMMENT),
    owner: text(record.OWNER),
    date: text(record.DATE),
    repository: repositoryOf(record),
  };
}

export function toShelve(record: XmlRecord): Shelve {
  return {
    id: integer(record.SHELVEID),
    guid: text(record.GUID),
    comment: text(record.COMMENT),
    owner: text(record.OWNER),
    date: text(record.DATE),
    parentChangeset: integer(record.PARENT),
    repository: repositoryOf(record),
  };
}

/** The repository a found object belongs to (`name@server`). */
function repositoryOf(record: XmlRecord): string {
  return repositorySpec(text(record.REPNAME), text(record.REPSERVER));
}
