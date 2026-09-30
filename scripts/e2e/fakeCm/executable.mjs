// The path `UVCS_CM_PATH` takes to run the fake `cm`. The app starts `cm` without a shell (`runCmProcess`,
// `CmShellSession`): on macOS and Linux the script runs by its `#!/usr/bin/env node` line, but Windows only starts
// executables (Node refuses a `.cmd` without a shell), so there it becomes `cm.exe`: a Node single executable
// application (`node --build-sea`, Node 25.5 or later) that loads cm.cjs from this folder.
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./cm.cjs', import.meta.url));

/** The fake `cm` to run, built in `folder` when it has to be (Windows). */
export function fakeCmExecutable(folder, platform = process.platform) {
  if (platform !== 'win32') {
    chmodSync(SCRIPT, 0o755);
    return SCRIPT;
  }
  return buildWindowsExecutable(folder);
}

function buildWindowsExecutable(folder) {
  const launcher = join(folder, 'cm-launcher.cjs');
  const config = join(folder, 'cm-sea.json');
  const executable = join(folder, 'cm.exe');
  // A single executable's `require` only reaches Node's own modules: cm.cjs is loaded through one made for its path.
  writeFileSync(launcher, `require('node:module').createRequire(__filename)(${JSON.stringify(SCRIPT)});\n`);
  // Without the warning Node would print on every start, into the output the app parses.
  writeFileSync(config, JSON.stringify({ main: launcher, output: executable, disableExperimentalSEAWarning: true }));
  execFileSync(process.execPath, ['--build-sea', config], { stdio: 'inherit' });
  return executable;
}
