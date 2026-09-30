/// <reference types="node" />
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under `directory`, at any depth, whose name `matches`: what a static test reads to enforce a rule. */
export function filesUnder(directory: string, matches: (name: string) => boolean): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path, matches);
    return matches(entry.name) ? [path] : [];
  });
}

/** A TypeScript source of the app: `.ts` or `.tsx`, not a test. */
export function isAppSource(name: string): boolean {
  return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);
}
