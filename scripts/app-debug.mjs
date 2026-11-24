// `npm run app:debug`: the built app with its DevTools port open to drive it (`UVCS_CDP_PORT`, 9333 by default), on
// every OS: an npm script can't read a variable with a default the same way in sh, cmd and PowerShell.
// `npm run app:debug -- --background`: its windows show but never take the focus (`windowsStayInBackground`), for an
// agent that opens the app on its own to check its work while a person keeps working (CLAUDE.md "Seeing the app").
import { spawn } from 'node:child_process';
import electron from 'electron';

const port = process.env.UVCS_CDP_PORT || '9333';
const inBackground = process.argv.includes('--background');
const args = process.argv.slice(2).filter((argument) => argument !== '--background');
const env = inBackground ? { ...process.env, UVCS_BACKGROUND_WINDOWS: '1' } : process.env;
spawn(electron, ['.', `--remote-debugging-port=${port}`, ...args], { stdio: 'inherit', env }).on('exit', (code) => process.exit(code ?? 1));
