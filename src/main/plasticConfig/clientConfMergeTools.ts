import { child, children, parseXml, text } from '../cm/parseXml';

/**
 * One entry of the official client's merge tools (client.conf's `<MergeTools>`, each a `<MergeToolData>`): the files
 * it's for and the command lines it runs on them, in order. The first entry whose type and patterns match a file wins.
 */
export interface LegacyMergeToolEntry {
  /** `<FileType>`: `enTextFile` or `enBinaryFile`; left out for an entry that takes both. */
  fileType: 'text' | 'binary' | 'any';
  /** `<FileExtensions>`, split on `;`: `.cs`, `*`, a wildcard name, or a regular expression. */
  patterns: string[];
  /** `<Tools>`: a chain, each run while the one before fails; the last is the one a person merges in. */
  commands: string[];
}

/**
 * The entries in the order the official client tries them; null when the file has no `<MergeTools>` (or isn't the
 * client's settings at all, or can't be read as XML), so the app keeps its own defaults.
 */
export function readLegacyMergeTools(xml: string): LegacyMergeToolEntry[] | null {
  if (!xml.includes('<MergeTools>')) return null;
  try {
    const root = child(parseXml(xml.replace(/^\uFEFF/, ''), ['MergeToolData', 'string']), 'ClientConfigData');
    const section = child(root, 'MergeTools');
    if (!section) return null;
    return children(section, 'MergeToolData').map((entry) => ({
      fileType: fileTypeOf(text(entry.FileType)),
      patterns: text(entry.FileExtensions)
        .split(';')
        .map((pattern) => pattern.trim())
        .filter(Boolean),
      commands: children(child(entry, 'Tools'), 'string')
        .map((command) => text(command).trim())
        .filter(Boolean),
    }));
  } catch {
    return null;
  }
}

function fileTypeOf(value: string): LegacyMergeToolEntry['fileType'] {
  if (value === 'enTextFile') return 'text';
  if (value === 'enBinaryFile') return 'binary';
  return 'any';
}
