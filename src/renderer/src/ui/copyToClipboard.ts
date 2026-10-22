import { toast } from './toast/toastStore';

/** Copies text and confirms it, e.g. `copyToClipboard('/main/task', 'Branch name')`; `detail` goes under the toast's title. */
export function copyToClipboard(text: string, what: string, detail?: string): void {
  void navigator.clipboard.writeText(text);
  toast.info(`${what} copied`, detail);
}
