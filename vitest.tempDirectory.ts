import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Gives the test run its own temp folder and removes it at the end: tests make workspaces, backups and settings under
 * `os.tmpdir()`, which reads these variables, and would otherwise leave them behind on every run.
 */
export default function tempDirectory(): () => void {
  const directory = mkdtempSync(join(tmpdir(), 'uvcs-tests-'));
  for (const name of ['TMPDIR', 'TEMP', 'TMP']) process.env[name] = directory;
  return () => rmSync(directory, { recursive: true, force: true, maxRetries: 5 });
}
