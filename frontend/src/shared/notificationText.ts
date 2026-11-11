// Writes a notification in the reader's language from the event key and values the server sends. A notification
// without a known key (stored before keys existed) keeps the French sentence the server wrote.
import type { NotificationRow, Role } from "../api/types";
import { roleLabel } from "./format";
import { t, type MessageKey } from "./i18n.svelte";

const ROLES = new Set(["admin", "member", "viewer"]);

export function notificationText(item: NotificationRow): string {
  const { key, params, actorName, message } = item.payload as {
    key?: unknown;
    params?: unknown;
    actorName?: unknown;
    message?: unknown;
  };
  const fallback = typeof message === "string" ? message : t("notif.cardUpdated");
  if (typeof key !== "string") return fallback;

  const values: Record<string, string> = {};
  if (params && typeof params === "object") {
    for (const [name, value] of Object.entries(params)) if (typeof value === "string") values[name] = value;
  }
  values.actor = typeof actorName === "string" ? actorName : "";
  if (values.role && ROLES.has(values.role)) values.role = roleLabel(values.role as Role).toLowerCase();

  const wanted = key === "git_pr_opened" && values.reopened ? "git_pr_reopened" : key;
  const messageKey = `notif.ev.${wanted}` as MessageKey;
  const text = t(messageKey, values);
  // t() gives the key back when no dictionary knows it (an event added on the server later)
  return text === messageKey ? fallback : text;
}
