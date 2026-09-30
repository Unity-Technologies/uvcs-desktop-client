import type { FailedCommand } from '@shared/ipc';
import { commandEnding } from '../shell/commandEnding';

/** A failed command as text, what the error dialog's Copy button copies: what failed, the command and what `cm` printed. */
export function errorReport(title: string, message: string, command: FailedCommand): string {
  return [title, message, '', `$ ${command.commandLine}`, commandEnding(command.exitCode), '', command.output].join('\n').trimEnd();
}
