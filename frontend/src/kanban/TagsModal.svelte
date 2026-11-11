<!-- Owner: Track 2 (Person A — Kanban CRUD and UI)
     Responsible for: the dialog that sets the tags of a card, and creates, renames, recolors and deletes the project's tags. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { confirmDialog } from "../shared/confirm.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import TagChip from "./TagChip.svelte";
  import { TAG_COLORS } from "./tagColors";
  import type { BoardStore } from "./boardStore.svelte";
  import type { Card } from "./types";

  let { store, card, open = $bindable(false) }: { store: BoardStore; card: Card; open: boolean } = $props();

  let dialog: HTMLDialogElement;
  let query = $state("");
  let newColor = $state(TAG_COLORS[1]);
  let error = $state<string | null>(null);
  let busy = $state(false);

  let editingId = $state<string | null>(null);
  let editName = $state("");
  let editColor = $state(TAG_COLORS[0]);

  const applied = $derived(new Set((card.tags ?? []).map((t) => t.id)));
  const needle = $derived(query.trim().toLowerCase());
  const shown = $derived(store.tags.filter((t) => t.name.toLowerCase().includes(needle)));
  const canCreate = $derived(
    store.canEdit && needle.length > 0 && !store.tags.some((t) => t.name.toLowerCase() === needle)
  );

  $effect(() => {
    if (open && !dialog.open) {
      query = "";
      error = null;
      editingId = null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function toggle(tagId: string): void {
    if (!store.canEdit) return;
    const ids = new Set(applied);
    if (!ids.delete(tagId)) ids.add(tagId);
    void store.setCardTags(card.id, [...ids]);
  }

  async function create(): Promise<void> {
    if (!canCreate || busy) return;
    busy = true;
    const result = await store.addTag(query.trim(), newColor);
    busy = false;
    if (result.error || !result.tag) {
      error = result.error ?? null;
      return;
    }
    error = null;
    query = "";
    void store.setCardTags(card.id, [...applied, result.tag.id]);
  }

  function startEdit(tagId: string): void {
    const tag = store.tags.find((t) => t.id === tagId);
    if (!tag) return;
    editingId = tag.id;
    editName = tag.name;
    editColor = tag.color;
    error = null;
  }

  async function saveEdit(): Promise<void> {
    if (!editingId || !editName.trim() || busy) return;
    busy = true;
    error = await store.editTag(editingId, { name: editName.trim(), color: editColor });
    busy = false;
    if (!error) editingId = null;
  }

  async function remove(): Promise<void> {
    if (!editingId || busy) return;
    const tag = store.tags.find((t) => t.id === editingId);
    const used = (store.board?.lists ?? []).flatMap((l) => l.cards).filter((c) => c.tags?.some((t) => t.id === editingId)).length;
    if (tag && used > 0) {
      const ok = await confirmDialog({
        title: t("list.deleteTitle", { name: tag.name }),
        message: used > 1 ? t("tags.usedMany", { n: used }) : t("tags.usedOne"),
        confirmLabel: t("common.delete"),
        danger: true,
      });
      if (!ok) return;
    }
    busy = true;
    error = await store.removeTag(editingId);
    busy = false;
    if (!error) editingId = null;
  }

  function onSearchKey(event: KeyboardEvent): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (canCreate) void create();
    else if (shown.length === 1) toggle(shown[0].id);
  }
</script>

<dialog
  class="modal"
  bind:this={dialog}
  aria-label={t("tags.ofCard")}
  onclose={() => (open = false)}
  onclick={(event) => {
    if (event.target === dialog) open = false;
  }}
>
  {#if open}
    <div class="head">
      <h2>{t("tags.title")}</h2>
      <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={() => (open = false)}><Icon name="x" size={18} /></button>
    </div>

    <div class="search">
      <Icon name="search" size={16} />
      <input
        class="bare"
        bind:value={query}
        placeholder={store.canEdit ? t("tags.searchOrCreatePh") : t("tags.searchPh")}
        maxlength="30"
        onkeydown={onSearchKey}
      />
    </div>

    <ul class="list">
      {#each shown as tag (tag.id)}
        {#if editingId === tag.id}
          <li class="editor">
            <input class="input" bind:value={editName} maxlength="30" aria-label={t("tags.name")} onkeydown={(e) => e.key === "Enter" && saveEdit()} />
            <div class="swatches" role="radiogroup" aria-label={t("tags.color")}>
              {#each TAG_COLORS as color (color)}
                <button
                  type="button"
                  class="swatch"
                  class:on={editColor === color}
                  style:--tag={color}
                  role="radio"
                  aria-checked={editColor === color}
                  aria-label={color}
                  onclick={() => (editColor = color)}
                >{#if editColor === color}<Icon name="check" size={13} />{/if}</button>
              {/each}
            </div>
            <div class="editor-actions">
              <button type="button" class="btn btn-danger btn-sm" disabled={busy} onclick={remove}><Icon name="trash" size={14} /> {t("common.delete")}</button>
              <span class="spacer"></span>
              <button type="button" class="btn btn-ghost btn-sm" onclick={() => (editingId = null)}>{t("common.cancel")}</button>
              <button type="button" class="btn btn-primary btn-sm" disabled={busy || !editName.trim()} onclick={saveEdit}>{t("common.save")}</button>
            </div>
          </li>
        {:else}
          <li class="row">
            <button type="button" class="pick" class:on={applied.has(tag.id)} disabled={!store.canEdit} aria-pressed={applied.has(tag.id)} onclick={() => toggle(tag.id)}>
              <span class="box">{#if applied.has(tag.id)}<Icon name="check" size={13} />{/if}</span>
              <TagChip {tag} />
            </button>
            {#if store.canEdit}
              <button type="button" class="icon-btn" aria-label={t("tags.editName", { name: tag.name })} onclick={() => startEdit(tag.id)}><Icon name="pencil" size={15} /></button>
            {/if}
          </li>
        {/if}
      {:else}
        {#if !canCreate}<li class="empty">{t("tags.empty")}</li>{/if}
      {/each}
    </ul>

    {#if canCreate}
      <div class="create">
        <div class="swatches" role="radiogroup" aria-label={t("tags.newColor")}>
          {#each TAG_COLORS as color (color)}
            <button
              type="button"
              class="swatch"
              class:on={newColor === color}
              style:--tag={color}
              role="radio"
              aria-checked={newColor === color}
              aria-label={color}
              onclick={() => (newColor = color)}
            >{#if newColor === color}<Icon name="check" size={13} />{/if}</button>
          {/each}
        </div>
        <button type="button" class="btn btn-primary btn-block" disabled={busy} onclick={create}>
          <Icon name="plus" size={15} /> {t("common.create")} <TagChip tag={{ name: query.trim(), color: newColor }} small />
        </button>
      </div>
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}
  {/if}
</dialog>

<style>
  dialog {
    width: min(400px, calc(100vw - 24px));
    max-height: calc(100vh - 32px);
    overflow: auto;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 14px 6px 20px;
  }
  h2 {
    margin: 0;
    font-size: 1.05rem;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 16px 10px;
    padding: 0 12px;
    min-height: 40px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text-faint);
  }
  .search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .bare {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0 10px;
    list-style: none;
    max-height: 300px;
    overflow: auto;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .pick {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 7px 10px;
    border: 0;
    border-radius: var(--radius);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s var(--ease);
  }
  .pick:hover:not(:disabled) {
    background: var(--bg-sunken);
  }
  .pick:disabled {
    cursor: default;
  }
  .pick:focus-visible {
    outline: 2px solid var(--accent);
  }
  .box {
    display: grid;
    place-items: center;
    flex: none;
    width: 18px;
    height: 18px;
    border: 1.5px solid var(--line-strong);
    border-radius: 5px;
    color: var(--on-accent);
    transition: background 0.12s var(--ease), border-color 0.12s var(--ease);
  }
  .on .box {
    background: var(--accent);
    border-color: var(--accent);
  }
  .empty {
    padding: 14px;
    text-align: center;
    font-size: 0.88rem;
    color: var(--text-faint);
  }
  .editor,
  .create {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .create {
    margin: 10px 16px 0;
  }
  .editor-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .spacer {
    flex: 1;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatch {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    background: var(--tag);
    color: #fff;
    cursor: pointer;
    transition: transform 0.12s var(--ease);
  }
  .swatch:hover {
    transform: scale(1.12);
  }
  .swatch.on {
    border-color: var(--surface-raised);
    box-shadow: 0 0 0 2px var(--tag);
  }
  .swatch:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .error {
    margin: 10px 16px 0;
    font-size: 0.85rem;
    color: var(--danger);
  }
  dialog::after {
    content: "";
    display: block;
    height: 16px;
  }
</style>
