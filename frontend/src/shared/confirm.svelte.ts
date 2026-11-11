// Promise-based confirm dialog, rendered by ConfirmHost.svelte.
// requireText: the user must type it to confirm.
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  requireText?: string;
}

export const confirmState = $state<{ options: ConfirmOptions | null }>({ options: null });

let resolver: ((ok: boolean) => void) | null = null;

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  resolver?.(false);
  confirmState.options = options;
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export function answerConfirm(ok: boolean): void {
  confirmState.options = null;
  resolver?.(ok);
  resolver = null;
}
