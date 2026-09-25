const UNSAFE_FOR_SHELL = /["\r\n]/;

export function canRunInShell(args: string[]): boolean {
  return !args.some((arg) => UNSAFE_FOR_SHELL.test(arg));
}

export function toShellCommandLine(args: string[]): string {
  return args.map((arg) => (arg === '' || /\s/.test(arg) ? `"${arg}"` : arg)).join(' ');
}
