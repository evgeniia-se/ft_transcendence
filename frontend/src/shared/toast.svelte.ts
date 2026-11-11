// Short messages. An action (like undo) makes destructive operations reversible.
export interface Toast {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
  action?: { label: string; run: () => void };
}

export const toasts = $state<Toast[]>([]);

let nextId = 1;

export function toast(
  message: string,
  options: { kind?: Toast["kind"]; duration?: number; action?: Toast["action"] } = {}
): number {
  const kind = options.kind ?? "info";
  const id = nextId++;
  toasts.push({ id, message, kind, action: options.action });
  const duration = options.duration ?? (kind === "error" || options.action ? 6500 : 3800);
  setTimeout(() => dismissToast(id), duration);
  return id;
}

export function dismissToast(id: number): void {
  const index = toasts.findIndex((t) => t.id === id);
  if (index >= 0) toasts.splice(index, 1);
}
