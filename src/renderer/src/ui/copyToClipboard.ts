import { toast } from './toast/toastStore';

/** Copies text and confirms it, e.g. `copyToClipboard('/main/task', 'Branch name')`. */
export function copyToClipboard(text: string, what: string): void {
  void navigator.clipboard.writeText(text);
  toast.info(`${what} copied`);
}
