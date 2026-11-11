<script lang="ts">
  import { t } from "../i18n.svelte";
  import Icon from "./Icon.svelte";
  import Popover from "./Popover.svelte";
  import {
    deleteAllNotifications,
    deleteNotification,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
  } from "../../api/accountApi";
  import { createSocketConnection } from "../../api/wsClientWrapper";
  import { getStoredToken } from "../../auth/authClient";
  import type { NotificationRow } from "../../api/types";
  import { timeAgo } from "../format";
  import { notificationText } from "../notificationText";
  import { toast } from "../toast.svelte";

  let items = $state<NotificationRow[]>([]);
  let loaded = $state(false);
  let failed = $state(false);

  // skeleton only after 0.5 s
  let slow = $state(false);
  $effect(() => {
    if (loaded) return;
    const timer = setTimeout(() => (slow = true), 500);
    return () => clearTimeout(timer);
  });

  // total unread on the server: the list only holds the newest ones
  let unread = $state(0);

  async function refresh(): Promise<void> {
    try {
      const result = await listNotifications();
      items = result.notifications;
      unread = result.unreadCount;
      failed = false;
    } catch {
      failed = true;
    } finally {
      loaded = true;
    }
  }

  $effect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  });

  // new notifications arrive live: this tab has its own connection, joined to the user's personal room on the server
  $effect(() => {
    const token = getStoredToken();
    if (!token) return;
    const connection = createSocketConnection(window.location.origin, token);
    connection.onAny((event, data) => {
      if (event !== "notification") return;
      const incoming = data as NotificationRow;
      const known = items.findIndex((n) => n.id === incoming.id);
      if (known >= 0) {
        // an update of a notification that is still unread: it goes back on top with its new wording
        items = [incoming, ...items.filter((n) => n.id !== incoming.id)];
      } else {
        items = [incoming, ...items].slice(0, 30);
        unread += 1;
      }
    });
    // a stale or invalid token will not get better by retrying: the HTTP calls handle the sign-in redirect
    connection.onConnectError((error) => {
      if (error.message === "token_expired" || error.message === "unauthorized") connection.disconnect();
    });
    return () => connection.disconnect();
  });

  async function read(item: NotificationRow): Promise<void> {
    if (item.readAt) return;
    item.readAt = new Date().toISOString();
    unread = Math.max(0, unread - 1);
    try {
      await markNotificationRead(item.id);
    } catch {
      item.readAt = null;
      unread += 1;
    }
  }

  async function readAll(): Promise<void> {
    const now = new Date().toISOString();
    items.forEach((n) => (n.readAt ??= now));
    unread = 0;
    try {
      await markAllNotificationsRead();
    } catch {
      toast(t("notif.markFailed"), { kind: "error" });
      await refresh();
    }
  }

  // removes a notification right away; it comes back if the server refuses
  async function remove(item: NotificationRow): Promise<void> {
    const previous = items;
    const wasUnread = !item.readAt;
    items = items.filter((n) => n.id !== item.id);
    if (wasUnread) unread = Math.max(0, unread - 1);
    try {
      await deleteNotification(item.id);
    } catch {
      items = previous;
      if (wasUnread) unread += 1;
      toast("La notification n'a pas pu être supprimée.", { kind: "error" });
    }
  }

  // empties the list right away; reloads it if the server refuses
  async function removeAll(): Promise<void> {
    items = [];
    unread = 0;
    try {
      await deleteAllNotifications();
    } catch {
      toast("Les notifications n'ont pas pu être supprimées.", { kind: "error" });
      await refresh();
    }
  }

  // an in-app path opens in this tab, an absolute http(s) address (GitHub) in a new one; anything else is ignored
  function target(url: unknown): { href: string; external: boolean } | null {
    const raw = String(url ?? "");
    if (raw.startsWith("/") && !raw.startsWith("//")) return { href: raw, external: false };
    try {
      const parsed = new URL(raw);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? { href: parsed.href, external: true } : null;
    } catch {
      return null;
    }
  }
</script>

<Popover width={360} onopen={() => void refresh()}>
  {#snippet trigger({ open, toggle })}
    <button
      type="button"
      class="icon-btn bell"
      aria-label={unread > 0 ? t("notif.unreadLabel", { n: unread }) : t("notif.title")}
      aria-expanded={open}
      onclick={toggle}
    >
      <Icon name="bell" size={19} />
      {#if unread > 0}<span class="badge">{unread > 9 ? "9+" : unread}</span>{/if}
    </button>
  {/snippet}
  {#snippet children()}
    <div class="head">
      <h3>{t("notif.title")}</h3>
      {#if unread > 0}
        <button type="button" class="btn btn-ghost btn-sm" onclick={readAll}>{t("notif.markAll")}</button>
      {/if}
    </div>
    <div class="list">
      {#if !loaded}
        {#if slow}
          <div class="skeleton line sk-enter" style:--i="0"></div>
          <div class="skeleton line sk-enter" style:--i="1"></div>
        {/if}
      {:else if failed && items.length === 0}
        <p class="empty">{t("notif.loadFailed")}</p>
      {:else if items.length === 0}
        <p class="empty">{t("notif.empty")}</p>
      {:else}
        {#each items as item (item.id)}
          {@const link = target(item.payload.url)}
          <div class="item">
            {#if link}
              <a
                class="row"
                class:unread={!item.readAt}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                onclick={() => read(item)}
              >
                {@render content(item)}
                {#if link.external}<Icon name="external" size={14} />{/if}
              </a>
            {:else}
              <button type="button" class="row" class:unread={!item.readAt} onclick={() => read(item)}>
                {@render content(item)}
              </button>
            {/if}
            <button type="button" class="icon-btn del" aria-label="Supprimer la notification" onclick={() => remove(item)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        {/each}
      {/if}
    </div>
  {/snippet}
</Popover>

{#snippet content(item: NotificationRow)}
  <span class="dot" aria-hidden="true"></span>
  <span class="body">
    <span class="msg">{notificationText(item)}</span>
    <span class="time">{item.payload.projectName ? `${item.payload.projectName} · ` : ""}{timeAgo(item.createdAt)}</span>
  </span>
{/snippet}

<style>
  .bell {
    position: relative;
  }
  .badge {
    position: absolute;
    top: 2px;
    right: 1px;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 0.66rem;
    font-weight: 700;
    line-height: 17px;
    text-align: center;
    box-shadow: 0 0 0 2px var(--surface);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 4px 8px;
    padding: 6px 8px 8px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px;
    margin-left: auto;
  }
  .actions .btn {
    white-space: nowrap;
  }
  .list {
    display: flex;
    flex-direction: column;
    max-height: min(420px, 60vh);
    overflow-x: hidden;
    overflow-y: auto;
  }
  .item {
    display: flex;
    align-items: flex-start;
    min-width: 0;
  }
  .row {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 8px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text);
    text-align: left;
    text-decoration: none;
  }
  .row:hover {
    background: var(--bg-sunken);
    color: var(--text);
  }
  .del {
    flex-shrink: 0;
    margin: 6px 4px 0 0;
    opacity: 0.55;
  }
  .item:hover .del,
  .del:hover,
  .del:focus-visible {
    opacity: 1;
  }
  .dot {
    width: 8px;
    height: 8px;
    margin-top: 7px;
    flex-shrink: 0;
    border-radius: 50%;
    background: transparent;
  }
  .unread .dot {
    background: var(--accent);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .msg {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.9rem;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .row:not(.unread) .msg {
    color: var(--text-soft);
  }
  .time {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.76rem;
    color: var(--text-faint);
  }
  .empty {
    padding: 20px 12px;
    text-align: center;
    color: var(--text-faint);
    font-size: 0.88rem;
  }
  .line {
    height: 44px;
    margin: 4px 8px;
  }
</style>
