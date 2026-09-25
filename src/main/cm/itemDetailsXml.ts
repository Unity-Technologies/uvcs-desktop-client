import type { ItemDetails } from '@shared/domain/explorer';
import { child, children, integer, parseXml, text } from './parseXml';

/** Parses `cm fileinfo --xml` for a single item. */
export function parseItemDetails(xml: string): ItemDetails {
  const info = children(child(parseXml(xml, ['FileInfo']), 'FileInfos'), 'FileInfo')[0];
  if (!info) throw new Error('cm fileinfo returned no information for the item.');

  return {
    serverPath: text(info.ServerPath),
    status: text(info.Status),
    loadedChangeset: integer(info.RevisionChangeset),
    owner: text(info.Owner),
    hash: text(info.Hash),
    repository: text(info.RepSpec),
    changelist: text(info.Changelist),
    xlinkTarget: text(info.XlinkTarget),
    underXlinkTarget: text(info.UnderXlinkTarget),
  };
}
