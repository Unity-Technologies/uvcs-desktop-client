/**
 * One latest-mac.yml for both macOS architectures. Releases build x64 and arm64 in two electron-builder runs at once,
 * so Apple notarizes both apps at the same time instead of one after the other (minutes each), and each run writes a
 * latest-mac.yml naming only its own files. electron-updater reads one file listing every architecture's zip and picks
 * its own (`installerAsset` picks the disk image the same way), so this joins them: the first file whole (its `path`
 * and `sha512` stay the default download, as a single two-architecture run writes them), with the others' `files`
 * entries added to its list.
 *
 *   node scripts/build/mergeMacUpdateInfo.ts dist/x64/latest-mac.yml dist/arm64/latest-mac.yml > latest-mac.yml
 *
 * It edits the text electron-builder writes rather than parsing YAML, so it needs no package: only Node's own modules.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** latest-mac.yml split where `files` starts and ends: the lines before, the entries' lines, and the lines after. */
interface UpdateInfoParts {
  head: string[];
  entries: string[];
  tail: string[];
}

function partsOf(updateInfo: string, name: string): UpdateInfoParts {
  const lines = updateInfo.replace(/\r\n/g, '\n').trimEnd().split('\n');
  const start = lines.indexOf('files:');
  if (start < 0) throw new Error(`${name} has no files list.`);
  const end = lines.findIndex((line, index) => index > start && !line.startsWith(' '));
  const stop = end < 0 ? lines.length : end;
  return { head: lines.slice(0, start + 1), entries: lines.slice(start + 1, stop), tail: lines.slice(stop) };
}

function versionOf(updateInfo: UpdateInfoParts, name: string): string {
  const version = updateInfo.head.find((line) => line.startsWith('version:'));
  if (!version) throw new Error(`${name} has no version.`);
  return version;
}

/** The update info of every architecture as one; the first one's default download and date stay. */
export function mergeMacUpdateInfo(updateInfos: { name: string; text: string }[]): string {
  if (updateInfos.length === 0) throw new Error('No latest-mac.yml to merge.');
  const [first, ...others] = updateInfos.map(({ name, text }) => ({ name, parts: partsOf(text, name) }));
  const version = versionOf(first!.parts, first!.name);
  for (const other of others) {
    if (versionOf(other.parts, other.name) !== version) {
      throw new Error(`${other.name} is ${versionOf(other.parts, other.name)}, ${first!.name} is ${version}.`);
    }
  }
  const entries = [first!, ...others].flatMap(({ parts }) => parts.entries);
  return [...first!.parts.head, ...entries, ...first!.parts.tail].join('\n') + '\n';
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  const files = process.argv.slice(2);
  process.stdout.write(mergeMacUpdateInfo(files.map((file) => ({ name: file, text: readFileSync(file, 'utf8') }))));
}
