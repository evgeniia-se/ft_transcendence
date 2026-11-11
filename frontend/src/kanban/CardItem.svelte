<!-- Owner: Track 2 (Person A — Kanban CRUD and UI)
     Responsible for: one card. Click opens it, drag moves it, Alt+arrows move it, Delete removes it (undoable). -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import CardMenu from "./CardMenu.svelte";
  import TagChip from "./TagChip.svelte";
  import type { BoardStore } from "./boardStore.svelte";
  import type { Card } from "./types";

  let { store, card, index = 0 }: { store: BoardStore; card: Card; index?: number } = $props();

  const draggable = $derived(store.canEdit && !store.filter.trim());
  const status = $derived(card.status && card.status.toLowerCase() !== "todo" ? card.status : null);
  const docCount = $derived(store.docCounts[card.id] ?? 0);
  const done = $derived(/^(done|merged|termin)/i.test(card.status ?? ""));

  function onDragStart(event: DragEvent): void {
    if (!event.dataTransfer) return;
    // Firefox needs some data to start a drag
    event.dataTransfer.setData("text/plain", card.id);
    event.dataTransfer.effectAllowed = "move";
    store.drag = { kind: "card", id: card.id };
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      store.openCardId = card.id;
      return;
    }
    if (!store.canEdit) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      // keep the focus in the list
      const cards = [...((event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(".card") ?? [])];
      const at = cards.indexOf(event.currentTarget as HTMLElement);
      const neighbour = cards[at + 1] ?? cards[at - 1];
      store.removeCard(card.id);
      neighbour?.focus();
      return;
    }
    if (!event.altKey) return;
    const lists = store.board?.lists ?? [];
    const listIndex = lists.findIndex((l) => l.id === card.listId);
    const list = lists[listIndex];
    if (!list) return;
    const at = list.cards.findIndex((c) => c.id === card.id);

    let move: Promise<void> | null = null;
    if (event.key === "ArrowUp" && at > 0) move = store.moveCard(card.id, list.id, at - 1);
    else if (event.key === "ArrowDown" && at < list.cards.length - 1) move = store.moveCard(card.id, list.id, at + 1);
    else if (event.key === "ArrowLeft" && listIndex > 0) move = store.moveCard(card.id, lists[listIndex - 1].id, Math.min(at, lists[listIndex - 1].cards.length));
    else if (event.key === "ArrowRight" && listIndex < lists.length - 1) move = store.moveCard(card.id, lists[listIndex + 1].id, Math.min(at, lists[listIndex + 1].cards.length));
    if (!move) return;

    event.preventDefault();
    // give the focus back after the card is re-rendered
    const id = card.id;
    void move.then(() => requestAnimationFrame(() => document.querySelector<HTMLElement>(`.card[data-id="${id}"]`)?.focus()));
  }
</script>

<div
  class="card"
  class:dragging={store.drag?.id === card.id}
  class:flash={store.flashed.has(card.id)}
  data-id={card.id}
  style:--row={Math.min(index, 8)}
  role="button"
  tabindex="0"
  aria-label={card.title}
  {draggable}
  ondragstart={onDragStart}
  ondragend={() => (store.drag = null)}
  onclick={() => (store.openCardId = card.id)}
  onkeydown={onKeydown}
>
  <CardMenu {store} {card} />
  {#if docCount > 0 || card.tags?.length}
    <div class="tags">
      {#if docCount > 0}
        <span class="docs" title={docCount > 1 ? t("card.linkedDocs", { n: docCount }) : t("card.linkedDoc", { n: docCount })}>
          <Icon name="note" size={12} /><span>{docCount}</span>
        </span>
      {/if}
      {#each card.tags ?? [] as tag (tag.id)}<TagChip {tag} small />{/each}
    </div>
  {/if}
  <div class="title selectable">{card.title}</div>
  {#if card.description}
    <div class="excerpt selectable">{card.description}</div>
  {/if}
  {#if status || card.linkedBranch || card.linkedPrUrl}
    <div class="meta">
      {#if status}<span class="chip" class:chip-accent={done} class:chip-warn={!done}>{status}</span>{/if}
      {#if card.linkedBranch}<span class="git" title={card.linkedBranch}><Icon name="branch" size={13} /><span class="selectable">{card.linkedBranch}</span></span>{/if}
      {#if card.linkedPrUrl}<span class="git" title={t("card.linkedPr")}><Icon name="link" size={13} /> PR</span>{/if}
    </div>
  {/if}
</div>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-raised);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: transform 0.15s var(--ease), box-shadow 0.15s var(--ease), border-color 0.15s var(--ease), opacity 0.12s;
  }
  .card[draggable="true"] {
    cursor: grab;
  }
  .card:hover {
    border-color: var(--line-strong);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  .card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .card.dragging {
    opacity: 0.35;
  }
  :global(.reveal) .card {
    animation: reveal-in 0.5s var(--ease) backwards;
    animation-delay: calc(var(--reveal-base, 0ms) + var(--col, 0) * 70ms + 120ms + var(--row, 0) * 55ms);
  }
  .card.flash {
    animation: flash 1.8s var(--ease);
  }
  @keyframes flash {
    0%,
    35% {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-soft);
    }
  }
  .docs {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 8px 0 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 7%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 16%, transparent);
    color: color-mix(in srgb, var(--text) 82%, transparent);
    font-size: 0.72rem;
    font-weight: 620;
    line-height: 1.55;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .title {
    font-size: 0.93rem;
    font-weight: 560;
    line-height: 1.35;
    overflow-wrap: anywhere;
    /* room for the "..." button */
    padding-right: 22px;
  }
  .excerpt {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.82rem;
    line-height: 1.4;
    color: var(--text-soft);
    overflow-wrap: anywhere;
    white-space: pre-line;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .git {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    font-size: 0.76rem;
    color: var(--text-faint);
  }
  .git span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 150px;
    font-family: var(--font-mono);
  }
</style>
