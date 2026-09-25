import { toast } from '../ui/toast/toastStore';

/** Copies text and confirms it with a short toast. */
export function copyText(text: string, confirmation: string): void {
  void navigator.clipboard.writeText(text);
  toast.info(confirmation);
}
