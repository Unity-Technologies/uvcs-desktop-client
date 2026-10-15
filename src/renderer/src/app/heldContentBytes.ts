import type { Query } from '@tanstack/react-query';
import type { FileContent } from '@shared/domain/content';

/**
 * The files a query's data holds, each with about the bytes it takes (`boundUnusedQueries`' byte bound): a version's
 * content (its text, image or model), a diff's pair of them (the same objects its two content queries hold), a file's
 * bytes. Other queries hold nothing big.
 */
export function heldContentBytes(query: Pick<Query, 'queryKey' | 'state'>): ReadonlyMap<object, number> {
  const data = query.state.data;
  if (!data) return NONE;
  switch (query.queryKey[2]) {
    case 'content':
      return new Map([[data as FileContent, contentBytes(data as FileContent)]]);
    case 'diffContents': {
      const { left, right } = data as { left: FileContent; right: FileContent };
      return new Map([left, right].map((content) => [content, contentBytes(content)]));
    }
    case 'contentBytes':
    case 'unityAsset':
      return data instanceof Uint8Array ? new Map([[data, data.byteLength]]) : NONE;
    default:
      return NONE;
  }
}

const NONE: ReadonlyMap<object, number> = new Map();

/** A text's characters count as a byte each: most are ASCII, which JavaScript keeps in one. */
function contentBytes(content: FileContent): number {
  return (content.text?.length ?? 0) + (content.image?.bytes.byteLength ?? 0) + (content.model?.bytes.byteLength ?? 0);
}
