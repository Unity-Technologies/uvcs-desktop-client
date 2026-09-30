// The workspace the smoke test opens: a real folder, so the watcher and the file views have something to read. Its
// files and selector match what the fake `cm` answers (fakeCm/repository.cjs).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import repository from './fakeCm/repository.cjs';

const { FILES, REPOSITORY_SPEC, WORKSPACE } = repository;

/** Creates the workspace in `path`: `.plastic/plastic.selector` and the files, with the user's edits on disk. */
export function createWorkspace(path) {
  write(join(path, '.plastic', 'plastic.selector'), `repository "${REPOSITORY_SPEC}"\n  path "/"\n    smartbranch "${WORKSPACE.branch}"\n`);
  for (const [file, { loaded, onDisk }] of Object.entries(FILES)) write(join(path, file), onDisk ?? loaded);
}

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
