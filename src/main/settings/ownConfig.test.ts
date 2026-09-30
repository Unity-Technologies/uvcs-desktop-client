import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The app keeps its settings in its own store: it never writes to, or keeps reading, the official Desktop client's
 * config (`plasticgui.conf`, `client.conf`...). `importLegacySettings` reads it once, on the first run. This scans the
 * main process for who reaches that folder or names its files.
 */

const MAIN_DIRECTORY = join(__dirname, '..');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'testing' ? [] : sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

const sources = sourceFiles(MAIN_DIRECTORY).map((path) => ({ file: relative(MAIN_DIRECTORY, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }));
const filesWhere = (test: (text: string) => boolean): string[] => sources.filter(({ text }) => test(text)).map(({ file }) => file).sort();

const LEGACY_READERS = ['plasticConfig/configFolder.ts', 'plasticConfig/recentBranchesConf.ts', 'settings/importLegacySettings.ts'];
const FILE_WRITES = /\b(writeFile|writeFileSync|appendFile|appendFileSync|rename|renameSync|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|copyFile|copyFileSync|createWriteStream)\b/;

describe("the official client's config", () => {
  it('is reached only by the first-run import, wired once at start', () => {
    expect(filesWhere((text) => text.includes('plasticConfigFolder('))).toEqual(['index.ts', 'plasticConfig/configFolder.ts']);
    expect(filesWhere((text) => /from '\.\.?\/(\.\.\/)?plasticConfig\//.test(text))).toEqual(['index.ts', 'settings/importLegacySettings.ts']);
  });

  it('has its files named only by the import', () => {
    expect(filesWhere((text) => /['"](plasticgui|client|guiclient)\.conf['"]/.test(text))).toEqual(['settings/importLegacySettings.ts']);
  });

  it('is only read: the modules that reach it import no way to write a file', () => {
    expect(LEGACY_READERS.filter((file) => FILE_WRITES.test(importsOf(file)))).toEqual([]);
  });
});

function importsOf(file: string): string {
  return sources
    .find((source) => source.file === file)!
    .text.split('\n')
    .filter((line) => line.startsWith('import '))
    .join('\n');
}
