<!-- Owner: Track 2 (Person A — Kanban CRUD and UI)
     Responsible for: one column: title, count, menu, cards and "add a card". The grip drags the list, cards can be dropped here. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { tick } from "svelte";
  import { confirmDialog } from "../shared/confirm.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import Popover from "../shared/ui/Popover.svelte";
  import CardItem from "./CardItem.svelte";
  import Composer from "./Composer.svelte";
  import { insertionIndex, othersBefore } from "./dnd";
  import InlineTitle from "./InlineTitle.svelte";
  import type { BoardStore } from "./boardStore.svelte";
  import type { List } from "./types";

  let { store, list }: { store: BoardStore; list: List } = $props();

  let column: HTMLElement;
  let cardsEl: HTMLElement;
  let title: ReturnType<typeof InlineTitle> | undefined = $state();
  let composer: ReturnType<typeof Composer> | undefined = $state();
  const listIndex = $derived(store.board?.lists.findIndex((l) => l.id === list.id) ?? -1);
  const listCount = $derived(store.board?.lists.length ?? 0);
  // where a dragged card would land (null when none is over)
  let dropIndex = $state<number | null>(null);

  const filter = $derived(store.filter.trim().toLowerCase());
  const shown = $derived(
    filter
      ? list.cards.filter((c) =>
          `${c.title} ${c.description ?? ""} ${(c.tags ?? []).map((t) => t.name).join(" ")}`.toLowerCase().includes(filter)
        )
      : list.cards
  );
  const cardIds = $derived(list.cards.map((c) => c.id));
  const othersCount = $derived(cardIds.filter((id) => id !== store.drag?.id).length);

  function onGripDragStart(event: DragEvent): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", list.id);
    event.dataTransfer.effectAllowed = "move";
    // drag the whole column
    event.dataTransfer.setDragImage(column, 24, 24);
    store.drag = { kind: "list", id: list.id };
  }

  function onDragOver(event: DragEvent): void {
    if (store.drag?.kind !== "card" || !store.canEdit) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    dropIndex = insertionIndex(cardsEl, "[data-id]", event.clientY, "y", store.drag.id);
  }

  function onDragLeave(event: DragEvent): void {
    // ignore moves between children
    if (!column.contains(event.relatedTarget as Node | null)) dropIndex = null;
  }

  function onDrop(event: DragEvent): void {
    if (store.drag?.kind !== "card" || !store.canEdit) return;
    event.preventDefault();
    const cardId = store.drag.id;
    const index = dropIndex ?? othersCount;
    dropIndex = null;
    store.drag = null;
    void store.moveCard(cardId, list.id, index);
  }

  async function addCard(text: string): Promise<boolean> {
    const ok = await store.addCard(list.id, text);
    if (ok) {
      await tick();
      cardsEl.scrollTo({ top: cardsEl.scrollHeight, behavior: "smooth" });
    }
    return ok;
  }

  async function onDelete(): Promise<void> {
    if (list.cards.length > 0) {
      const n = list.cards.length;
      const ok = await confirmDialog({
        title: t("list.deleteTitle", { name: list.title }),
        message: n === 1 ? t("list.deleteOne") : t("list.deleteMany", { n }),
        confirmLabel: t("list.delete"),
        danger: true,
      });
      if (!ok) return;
    }
    await store.removeList(list.id);
  }
</script>

<!-- drop zone for cards; without a mouse, use Alt+arrows or the card dialog -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
  class="column"
  class:dragging={store.drag?.kind === "list" && store.drag.id === list.id}
  class:over={dropIndex !== null}
  data-id={list.id}
  aria-label={list.title}
  bind:this={column}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  <header>
    <span class="count" title={list.cards.length > 1 ? t("board.cards", { n: list.cards.length }) : t("board.card", { n: list.cards.length })}>
      {filter ? `${shown.length}/${list.cards.length}` : list.cards.length}
    </span>
    <InlineTitle bind:this={title} value={list.title} editable={store.canEdit} label={t("list.title")} onsave={(t) => store.renameList(list.id, t)} />
    {#if store.canEdit}
      <span
        class="icon-btn grip"
        role="presentation"
        draggable="true"
        title={t("list.dragHint")}
        ondragstart={onGripDragStart}
        ondragend={() => (store.drag = null)}
      >
        <Icon name="grip" size={17} />
      </span>
      <Popover width={220}>
        {#snippet trigger({ open, toggle })}
          <button type="button" class="icon-btn menu" aria-label={t("list.options")} aria-expanded={open} onclick={toggle}>
            <Icon name="more" size={17} />
          </button>
        {/snippet}
        {#snippet children({ close })}
          <button
            type="button"
            class="item"
            onclick={() => {
              close();
              title?.focus();
            }}
          >
            <Icon name="pencil" size={15} /> {t("common.rename")}
          </button>
          <button
            type="button"
            class="item"
            onclick={() => {
              close();
              composer?.show();
            }}
          >
            <Icon name="plus" size={15} /> {t("list.addCard")}
          </button>
          <button type="button" class="item" disabled={listIndex <= 0} onclick={() => { close(); void store.moveList(list.id, listIndex - 1); }}>
            <Icon name="arrowLeft" size={15} /> {t("list.moveLeft")}
          </button>
          <button type="button" class="item" disabled={listIndex < 0 || listIndex >= listCount - 1} onclick={() => { close(); void store.moveList(list.id, listIndex + 1); }}>
            <Icon name="arrowRight" size={15} /> {t("list.moveRight")}
          </button>
          <div class="sep" role="separator"></div>
          <button
            type="button"
            class="item danger"
            onclick={() => {
              close();
              void onDelete();
            }}
          >
            <Icon name="trash" size={15} /> {t("list.delete")}
          </button>
        {/snippet}
      </Popover>
    {/if}
  </header>

  <div class="cards" role="list" bind:this={cardsEl}>
    {#each shown as card, i (card.id)}
      {#if dropIndex !== null && card.id !== store.drag?.id && othersBefore(cardIds, i, store.drag?.id) === dropIndex}
        <div class="drop-line"></div>
      {/if}
      <CardItem {store} {card} index={i} />
    {/each}
    {#if dropIndex !== null && dropIndex >= othersCount}
      <div class="drop-line"></div>
    {/if}
    {#if list.cards.length === 0 && dropIndex === null}
      <p class="empty">{store.canEdit ? t("list.dropHere") : t("list.noCard")}</p>
    {:else if filter && shown.length === 0}
      <p class="empty">{t("list.noMatch")}</p>
    {/if}
  </div>

  {#if store.canEdit}
    <Composer bind:this={composer} label={t("list.addCard")} placeholder={t("list.cardTitle")} multiline maxlength={200} onadd={addCard} />
  {/if}
</section>

<style>
  .column {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 300px;
    max-height: 100%;
    flex-shrink: 0;
    padding: 10px 8px 8px;
    border-radius: var(--radius-lg);
    background: var(--bg-sunken);
    border: 1px solid transparent;
    transition: opacity 0.12s, border-color 0.15s var(--ease), background-color 0.15s var(--ease);
  }
  /* entrance animation */
  :global(.reveal) .column {
    animation: reveal-in 0.5s var(--ease) backwards;
    animation-delay: calc(var(--reveal-base, 0ms) + var(--col, 0) * 70ms);
  }
  .column.over {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent-soft) 45%, var(--bg-sunken));
  }
  .column.dragging {
    opacity: 0.4;
  }
  header {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 30px;
    padding: 0 2px 0 6px;
    font-family: var(--font-serif);
    font-size: 1.02rem;
  }
  .grip {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    opacity: 0;
    cursor: grab;
    transition: opacity 0.12s, background-color 0.15s var(--ease), color 0.15s var(--ease);
  }
  header:hover .grip,
  .grip:focus-visible {
    opacity: 1;
  }
  .count {
    flex-shrink: 0;
    min-width: 22px;
    padding: 0 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 8%, transparent);
    color: var(--text-soft);
    font-family: var(--font-sans);
    font-size: 0.74rem;
    font-weight: 700;
    line-height: 20px;
    text-align: center;
  }
  .menu {
    width: 30px;
    height: 30px;
    opacity: 0.55;
    transition: opacity 0.12s;
  }
  header:hover .menu,
  .menu:focus-visible,
  .menu[aria-expanded="true"] {
    opacity: 1;
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 36px;
    padding: 2px;
    overflow-y: auto;
  }
  .drop-line {
    height: 3px;
    flex-shrink: 0;
    border-radius: 2px;
    background: var(--accent);
  }
  .empty {
    padding: 14px 8px;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius);
    color: var(--text-faint);
    font-size: 0.84rem;
    text-align: center;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 10px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font-size: 0.9rem;
    text-align: left;
  }
  .item:hover:not(:disabled) {
    background: var(--bg-sunken);
  }
  .item:disabled {
    color: var(--text-faint);
    cursor: default;
  }
  .sep {
    height: 1px;
    margin: 5px 4px;
    background: var(--line);
  }
  .item.danger {
    color: var(--danger);
  }
  .item.danger:hover {
    background: var(--danger-soft);
  }
  @media (hover: none) {
    .grip,
    .menu {
      opacity: 1;
    }
  }
  @media (max-width: 600px) {
    .column {
      width: min(300px, 84vw);
    }
  }
</style>
