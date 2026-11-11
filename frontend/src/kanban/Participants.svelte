<!-- Owner: Track 2 (Person A — Kanban CRUD and UI)
     Responsible for: the header list of participants with live online status. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import Avatar from "../shared/ui/Avatar.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import Popover from "../shared/ui/Popover.svelte";
  import { roleLabel } from "../shared/format";
  import type { BoardStore } from "./boardStore.svelte";

  let { store }: { store: BoardStore } = $props();

  let width = $state(typeof window === "undefined" ? 1280 : window.innerWidth);
  const VISIBLE = $derived(width <= 1200 ? 2 :width <= 1400 ? 3 : 4);

  // online first, then by name
  const sorted = $derived(
    [...store.members].sort(
      (a, b) =>
        Number(store.online.has(b.userId)) - Number(store.online.has(a.userId)) || a.user.name.localeCompare(b.user.name)
    )
  );
  const onlineCount = $derived(store.members.filter((m) => store.online.has(m.userId)).length);
</script>

<svelte:window bind:innerWidth={width} />

<Popover width={300}>
  {#snippet trigger({ open, toggle })}
    <button
      type="button"
      class="stack"
      aria-expanded={open}
      aria-label={t("participants.label", { n: store.members.length, online: onlineCount })}
      onclick={toggle}
    >
      <span class="avatars">
        {#each sorted.slice(0, VISIBLE) as member (member.userId)}
          <Avatar name={member.user.name} id={member.userId} src={member.user.avatar} size={28} online={store.online.has(member.userId)} ring />
        {/each}
        {#if sorted.length > VISIBLE}<span class="more">+{sorted.length - VISIBLE}</span>{/if}
      </span>
    </button>
  {/snippet}
  {#snippet children()}
    <div class="title">
      <span>{store.members.length > 1 ? t("participants.many", { n: store.members.length }) : t("participants.one", { n: store.members.length })}</span>
      <span class="online"><span class="dot"></span>{t("participants.online", { n: onlineCount })}</span>
    </div>
    <ul>
      {#each sorted as member (member.userId)}
        <li>
          <Avatar name={member.user.name} id={member.userId} src={member.user.avatar} size={32} online={store.online.has(member.userId)} />
          <div class="info">
            <div class="name selectable">{member.user.name}</div>
            <div class="role">{roleLabel(member.role)}{store.online.has(member.userId) ? ` · ${t("participants.isOnline")}` : ""}</div>
          </div>
        </li>
      {/each}
    </ul>
    {#if store.myRole === "admin" && store.project}
      <a class="invite" href={`/app/${store.project.id}/settings#invitations`}><Icon name="plus" size={15} /> {t("participants.invite")}</a>
    {/if}
  {/snippet}
</Popover>

<style>
  .stack {
    display: inline-flex;
    align-items: center;
    padding: 3px 6px 3px 3px;
    border: none;
    border-radius: 999px;
    background: transparent;
  }
  .stack:hover {
    background: var(--bg-sunken);
  }
  .avatars {
    display: inline-flex;
  }
  .avatars > :global(* + *) {
    margin-left: -6px;
  }
  .more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--bg-sunken);
    color: var(--text-soft);
    font-size: 0.68rem;
    font-weight: 700;
    box-shadow: 0 0 0 2px var(--surface);
  }
  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 6px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .online {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--online);
  }
  ul {
    list-style: none;
    padding: 0;
    max-height: 320px;
    overflow-y: auto;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 8px;
  }
  .info {
    min-width: 0;
  }
  .name {
    font-size: 0.9rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .role {
    font-size: 0.76rem;
    color: var(--text-faint);
  }
  .invite {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    padding: 9px 10px;
    border-top: 1px solid var(--line);
    border-radius: 0 0 8px 8px;
    font-size: 0.88rem;
    font-weight: 600;
    text-decoration: none;
  }
  .invite:hover {
    background: var(--accent-soft);
  }
</style>
