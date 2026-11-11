<!-- Owner: Track 2 (Person A — Kanban CRUD and UI)
     Responsible for: the board area: columns, "add list", empty state and list drag and drop. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import Composer from "./Composer.svelte";
  import ListColumn from "./ListColumn.svelte";
  import { insertionIndex, othersBefore } from "./dnd";
  import type { BoardStore } from "./boardStore.svelte";

  let { store }: { store: BoardStore } = $props();

  let boardEl: HTMLElement;
  // where a dragged list would land (null when not dragging)
  let dropIndex = $state<number | null>(null);
  let creatingDefaults = $state(false);

  const listIds = $derived(store.board?.lists.map((l) => l.id) ?? []);
  const othersCount = $derived(listIds.filter((id) => id !== store.drag?.id).length);

  function onDragOver(event: DragEvent): void {
    if (store.drag?.kind !== "list" || !store.canEdit) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    dropIndex = insertionIndex(boardEl, "[data-id].column-slot", event.clientX, "x", store.drag.id);
  }

  function onDragLeave(event: DragEvent): void {
    if (!boardEl.contains(event.relatedTarget as Node | null)) dropIndex = null;
  }

  function onDrop(event: DragEvent): void {
    if (store.drag?.kind !== "list" || !store.canEdit) return;
    event.preventDefault();
    const listId = store.drag.id;
    const index = dropIndex ?? othersCount;
    dropIndex = null;
    store.drag = null;
    void store.moveList(listId, index);
  }

  async function createDefaults(): Promise<void> {
    creatingDefaults = true;
    await store.addDefaultLists();
    creatingDefaults = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="board" bind:this={boardEl} ondragover={onDragOver} ondragleave={onDragLeave} ondrop={onDrop}>
  {#if store.board}
    {#if store.board.lists.length === 0}
      <div class="welcome">
        <div class="icon"><Icon name="columns" size={28} /></div>
        {#if store.canEdit}
          <h2>{t("board.newTitle")}</h2>
          <p>{t("board.newText")}</p>
          <button type="button" class="btn btn-primary" disabled={creatingDefaults} onclick={createDefaults}>
            {#if creatingDefaults}<span class="spinner"></span>{:else}<Icon name="sparkle" size={17} />{/if}
            {t("board.createDefaults", { lists: [t("board.defaultTodo"), t("board.defaultDoing"), t("board.defaultDone")].join(" · ") })}
          </button>
          <div class="or">{t("board.orOwnList")}</div>
          <div class="own"><Composer ghost label={t("board.addList")} placeholder={t("board.listName")} onadd={(t) => store.addList(t)} /></div>
        {:else}
          <h2>{t("board.emptyTitle")}</h2>
          <p>{t("board.emptyText")}</p>
        {/if}
      </div>
    {:else}
      {#each store.board.lists as list, i (list.id)}
        {#if dropIndex !== null && list.id !== store.drag?.id && othersBefore(listIds, i, store.drag?.id) === dropIndex}
          <div class="drop-line"></div>
        {/if}
        <div class="column-slot" data-id={list.id} style:--col={i}>
          <ListColumn {store} {list} />
        </div>
      {/each}
      {#if dropIndex !== null && dropIndex >= othersCount}
        <div class="drop-line"></div>
      {/if}

      {#if store.canEdit}
        <div class="add-list">
          <Composer ghost label={t("board.addList")} placeholder={t("board.listName")} onadd={(t) => store.addList(t)} />
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .board {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 4px 20px 24px;
    overflow: auto;
    scroll-snap-type: x proximity;
    scroll-padding: 0 20px;
  }
  /* list drop is measured on the slot */
  .column-slot {
    display: flex;
    max-height: 100%;
    scroll-snap-align: start;
  }
  .drop-line {
    width: 3px;
    align-self: stretch;
    flex-shrink: 0;
    border-radius: 2px;
    background: var(--accent);
  }
  .add-list {
    width: 300px;
    flex-shrink: 0;
  }
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 480px;
    margin: 6vh auto 0;
    padding: 0 8px;
    text-align: center;
  }
  .welcome p {
    color: var(--text-soft);
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
  .or {
    margin-top: 6px;
    font-size: 0.84rem;
    color: var(--text-faint);
  }
  .own {
    width: min(300px, 100%);
  }
  @media (max-width: 600px) {
    .board {
      padding: 4px 12px 20px;
    }
    .add-list {
      width: min(300px, 84vw);
    }
  }
</style>
