// `npm run app:debug`: the built app with its DevTools port open to drive it (`UVCS_CDP_PORT`, 9333 by default), on
// every OS: an npm script can't read a variable with a default the same way in sh, cmd and PowerShell.
import { spawn } from 'node:child_process';
import electron from 'electron';

const port = process.env.UVCS_CDP_PORT || '9333';
spawn(electron, ['.', `--remote-debugging-port=${port}`, ...process.argv.slice(2)], { stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 1));
