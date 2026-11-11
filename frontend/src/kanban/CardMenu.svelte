<!-- Owner: Track 2 (Person A — Kanban CRUD and UI)
     Responsible for: the "..." menu of a card: open, copy link, Git branch, move to another list, delete. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { confirmDialog } from "../shared/confirm.svelte";
  import { toast } from "../shared/toast.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import Popover from "../shared/ui/Popover.svelte";
  import TagChip from "./TagChip.svelte";
  import { TAG_COLORS } from "./tagColors";
  import type { BoardStore } from "./boardStore.svelte";
  import type { Card } from "./types";

  let { store, card }: { store: BoardStore; card: Card } = $props();

  // inline tag panel: assign existing tags, create new ones
  let menuOpen = $state(false);
  let tagsOpen = $state(false);
  let query = $state("");
  let newColor = $state(TAG_COLORS[1]);
  let tagError = $state<string | null>(null);
  let creating = $state(false);

  const applied = $derived(new Set((card.tags ?? []).map((t) => t.id)));
  const needle = $derived(query.trim().toLowerCase());
  const shown = $derived(store.tags.filter((t) => t.name.toLowerCase().includes(needle)));
  const canCreate = $derived(needle.length > 0 && !store.tags.some((t) => t.name.toLowerCase() === needle));

  // rename / recolor / delete an existing tag, in place
  let editingId = $state<string | null>(null);
  let editName = $state("");
  let editColor = $state(TAG_COLORS[0]);
  let editBusy = $state(false);

  function startEdit(tagId: string): void {
    const tag = store.tags.find((t) => t.id === tagId);
    if (!tag) return;
    editingId = tag.id;
    editName = tag.name;
    editColor = tag.color;
    tagError = null;
  }

  async function saveEdit(): Promise<void> {
    if (!editingId || !editName.trim() || editBusy) return;
    editBusy = true;
    tagError = await store.editTag(editingId, { name: editName.trim(), color: editColor });
    editBusy = false;
    if (!tagError) editingId = null;
  }

  async function removeTag(): Promise<void> {
    //kept in a variable: the confirmation dialog takes the focus, which closes this menu and resets editingId
    const id = editingId;
    if (!id || editBusy) return;
    const tag = store.tags.find((t) => t.id === id);
    const used = (store.board?.lists ?? []).flatMap((l) => l.cards).filter((c) => c.tags?.some((t) => t.id === id)).length;
    if (tag && used > 0) {
      const ok = await confirmDialog({
        title: t("list.deleteTitle", { name: tag.name }),
        message: used > 1 ? t("tags.usedMany", { n: used }) : t("tags.usedOne"),
        confirmLabel: t("common.delete"),
        danger: true,
      });
      if (!ok) return;
    }
    editBusy = true;
    tagError = await store.removeTag(id);
    editBusy = false;
    if (!tagError) editingId = null;
  }

  // a closed menu forgets its draft
  $effect(() => {
    if (!menuOpen) {
      tagsOpen = false;
      editingId = null;
      query = "";
      tagError = null;
    }
  });

  function toggleTag(tagId: string): void {
    const ids = new Set(applied);
    if (!ids.delete(tagId)) ids.add(tagId);
    void store.setCardTags(card.id, [...ids]);
  }

  async function createTag(): Promise<void> {
    if (!canCreate || creating) return;
    creating = true;
    const result = await store.addTag(query.trim(), newColor);
    creating = false;
    if (result.error || !result.tag) {
      tagError = result.error ?? null;
      return;
    }
    tagError = null;
    query = "";
    void store.setCardTags(card.id, [...applied, result.tag.id]);
  }

  function onTagKey(event: KeyboardEvent): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (canCreate) void createTag();
    else if (shown.length === 1) toggleTag(shown[0].id);
  }

  async function copyLink(): Promise<void> {
    if (!store.project) return;
    const url = `${location.origin}/app/${store.project.id}?card=${card.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("card.linkCopied"), { kind: "success" });
    } catch {
      toast(t("card.copyFailed"), { kind: "error" });
    }
  }
</script>

<!-- a click here must not open the card, and a press must not start dragging it -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wrap" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.stopPropagation()} ondragstart={(event) => event.preventDefault()}>
  <Popover width={264} fixed bind:open={menuOpen}>
    {#snippet trigger({ open, toggle })}
      <button type="button" class="icon-btn menu" class:on={open} aria-label={t("card.options")} aria-haspopup="menu" aria-expanded={open} onclick={toggle}>
        <Icon name="more" size={17} />
      </button>
    {/snippet}
    {#snippet children({ close })}
      <button type="button" class="item" onclick={() => { close(); store.openCardId = card.id; }}>
        <Icon name="external" size={15} /> {t("common.open")}
      </button>
      <button type="button" class="item" onclick={() => { close(); void copyLink(); }}>
        <Icon name="link" size={15} /> {t("card.copyLink")}
      </button>

      {#if store.canEdit}
        <div class="sep" role="separator"></div>
        <button type="button" class="item" aria-expanded={tagsOpen} onclick={() => (tagsOpen = !tagsOpen)}>
          <Icon name="tag" size={15} /> {t("tags.manage")}
          <span class="caret" class:flip={tagsOpen}><Icon name="chevronDown" size={15} /></span>
        </button>
        {#if tagsOpen}
          <div class="tags-panel">
            <input class="input" bind:value={query} placeholder={t("tags.searchOrCreateShort")} maxlength="30" aria-label={t("tags.searchOrCreate")} onkeydown={onTagKey} />
            <ul class="tag-list">
              {#each shown as tag (tag.id)}
                {#if editingId === tag.id}
                  <li class="editor">
                    <input class="input" bind:value={editName} maxlength="30" aria-label={t("tags.name")} onkeydown={(e) => e.key === "Enter" && saveEdit()} />
                    <div class="swatches" role="radiogroup" aria-label={t("tags.color")}>
                      {#each TAG_COLORS as color (color)}
                        <button type="button" class="swatch" class:on={editColor === color} style:--tag={color} role="radio" aria-checked={editColor === color} aria-label={color} onclick={() => (editColor = color)}>
                          {#if editColor === color}<Icon name="check" size={11} />{/if}
                        </button>
                      {/each}
                    </div>
                    <div class="editor-actions">
                      <button type="button" class="mini danger" disabled={editBusy} onclick={removeTag}><Icon name="trash" size={13} /> {t("common.delete")}</button>
                      <span class="spacer"></span>
                      <button type="button" class="mini" onclick={() => (editingId = null)}>{t("common.cancel")}</button>
                      <button type="button" class="mini primary" disabled={editBusy || !editName.trim()} onclick={saveEdit}>OK</button>
                    </div>
                  </li>
                {:else}
                  <li class="row">
                    <button type="button" class="pick" class:on={applied.has(tag.id)} aria-pressed={applied.has(tag.id)} onclick={() => toggleTag(tag.id)}>
                      <span class="box">{#if applied.has(tag.id)}<Icon name="check" size={12} />{/if}</span>
                      <TagChip {tag} />
                    </button>
                    <button type="button" class="edit-btn" aria-label={t("tags.editName", { name: tag.name })} title={t("tags.editOrDelete")} onclick={() => startEdit(tag.id)}>
                      <Icon name="pencil" size={13} />
                    </button>
                  </li>
                {/if}
              {:else}
                {#if !canCreate}<li class="none">{t("tags.empty")}</li>{/if}
              {/each}
            </ul>
            {#if canCreate}
              <div class="swatches" role="radiogroup" aria-label={t("tags.color")}>
                {#each TAG_COLORS as color (color)}
                  <button type="button" class="swatch" class:on={newColor === color} style:--tag={color} role="radio" aria-checked={newColor === color} aria-label={color} onclick={() => (newColor = color)}>
                    {#if newColor === color}<Icon name="check" size={11} />{/if}
                  </button>
                {/each}
              </div>
              <button type="button" class="create" disabled={creating} onclick={createTag}>
                <Icon name="plus" size={14} /> {t("common.create")} <TagChip tag={{ name: query.trim(), color: newColor }} small />
              </button>
            {/if}
            {#if tagError}<p class="field-error" role="alert">{tagError}</p>{/if}
          </div>
        {/if}
        <button type="button" class="item" onclick={() => { close(); store.gitCardId = card.id; }}>
          <Icon name="branch" size={15} /> {card.gitLink ? t("git.editBranch") : t("git.linkGitBranch")}
        </button>
        {#if card.gitLink}
          <button type="button" class="item" onclick={() => { close(); void store.unlinkBranch(card.id); }}>
            <Icon name="x" size={15} /> {t("git.unlink")}
          </button>
        {/if}

        <div class="sep" role="separator"></div>
        <button type="button" class="item danger" onclick={() => { close(); store.removeCard(card.id); }}>
          <Icon name="trash" size={15} /> {t("common.delete")}
        </button>
      {/if}
    {/snippet}
  </Popover>
</div>

<style>
  .wrap {
    position: absolute;
    top: 6px;
    right: 6px;
  }
  .menu {
    width: 28px;
    height: 28px;
    opacity: 0;
    transition: opacity 0.12s, background-color 0.15s var(--ease);
  }
  /* shown when the card is hovered or focused, or while the menu is open */
  :global(.card:hover) .menu,
  :global(.card:focus-within) .menu,
  .menu.on,
  .menu:focus-visible {
    opacity: 1;
  }
  @media (hover: none) {
    .menu {
      opacity: 1;
    }
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font-size: 0.9rem;
    text-align: left;
  }
  .item:hover {
    background: var(--bg-sunken);
  }
  .item.danger {
    color: var(--danger);
  }
  .item.danger:hover {
    background: var(--danger-soft);
  }
  .caret {
    display: inline-flex;
    margin-left: auto;
    color: var(--text-faint);
    transition: transform 0.15s var(--ease);
  }
  .caret.flip {
    transform: rotate(180deg);
  }
  .tags-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 2px 2px 4px;
    padding: 8px;
    border-radius: 8px;
    background: var(--bg-sunken);
  }
  .tags-panel .input {
    height: 34px;
    font-size: 0.86rem;
  }
  .tag-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 170px;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .edit-btn {
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--text-faint);
  }
  .edit-btn:hover {
    background: var(--surface-raised);
    color: var(--text);
  }
  .editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border-radius: 8px;
    background: var(--surface-raised);
  }
  .editor-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .spacer {
    flex: 1;
  }
  .mini {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: none;
    font-size: 0.8rem;
  }
  .mini:hover:not(:disabled) {
    background: var(--bg-sunken);
  }
  .mini.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
  }
  .mini.danger {
    border-color: var(--danger);
    color: var(--danger);
  }
  .mini:disabled {
    opacity: 0.55;
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    padding: 5px 6px;
    border: none;
    border-radius: 6px;
    background: none;
    text-align: left;
  }
  .pick:hover {
    background: var(--surface-raised);
  }
  .box {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border: 1.5px solid var(--line-strong);
    border-radius: 4px;
    color: var(--on-accent);
  }
  .pick.on .box {
    border-color: var(--accent);
    background: var(--accent);
  }
  .none {
    padding: 6px;
    font-size: 0.82rem;
    color: var(--text-faint);
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .swatch {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: var(--tag);
    color: #fff;
  }
  .swatch.on {
    border-color: var(--text);
  }
  .create {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border: 1px dashed var(--line-strong);
    border-radius: 6px;
    background: none;
    font-size: 0.86rem;
  }
  .create:hover:not(:disabled) {
    background: var(--surface-raised);
  }
  .sep {
    height: 1px;
    margin: 5px 4px;
    background: var(--line);
  }
</style>
