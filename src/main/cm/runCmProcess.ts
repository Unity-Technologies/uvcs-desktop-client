import { spawn } from 'node:child_process';
import type { CmResult } from './CmResult';

export interface CmProcessOptions {
  cwd?: string;
  signal?: AbortSignal;
  onOutputLine?: (line: string) => void;
}

export function runCmProcess(cmPath: string, args: string[], options: CmProcessOptions): Promise<CmResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmPath, args, { cwd: options.cwd, signal: options.signal, windowsHide: true });
    const chunks: string[] = [];
    let pendingLine = '';

    const collect = (data: Buffer): void => {
      const text = data.toString('utf8');
      chunks.push(text);
      if (!options.onOutputLine) return;

      const lines = (pendingLine + text).split(/\r?\n/);
      pendingLine = lines.pop() ?? '';
      lines.forEach(options.onOutputLine);
    };

    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', reject);
    child.on('close', (code) => {
      if (pendingLine) options.onOutputLine?.(pendingLine);
      resolve({ output: chunks.join(''), exitCode: code ?? -1 });
    });
  });
}
