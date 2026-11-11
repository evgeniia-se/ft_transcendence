<!-- Owner: Track 4 (Whiteboard, notes, and supporting modules)
     Responsible for: the dialog that picks the documents linked to a card -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { humanSize } from "../documents/fileInfo";
  import { listAttachments, type Attachment } from "../files/attachmentsApi";
  import { listNotes, type NoteSummary } from "../notes/notesApi";
  import { timeAgo } from "../shared/format";
  import { toast } from "../shared/toast.svelte";
  import Icon from "../shared/ui/Icon.svelte";

  type Filter = "all" | "note" | "file";
  type Row = { key: string; kind: "note" | "file"; id: string; name: string; meta: string; searchable: string };

  let {
    projectId,
    open = $bindable(false),
    canEdit,
    linkedNoteIds,
    linkedFileIds,
    ontoggle,
  }: {
    projectId: string;
    open: boolean;
    canEdit: boolean;
    linkedNoteIds: Set<string>;
    linkedFileIds: Set<string>;
    ontoggle: (kind: "note" | "file", id: string) => Promise<void>;
  } = $props();

  let dialog: HTMLDialogElement;
  let notes = $state<NoteSummary[]>([]);
  let files = $state<Attachment[]>([]);
  let loading = $state(false);
  let query = $state("");
  let filter = $state<Filter>("all");
  // linked when the dialog opened so they stay listed first when toggled
  let pinned = $state<Set<string>>(new Set());
  let busyKey = $state<string | null>(null);
  let search: HTMLInputElement | undefined = $state();

  const rows = $derived.by<Row[]>(() => [
    ...notes.map((note) => ({
      key: `note:${note.id}`,
      kind: "note" as const,
      id: note.id,
      name: note.title,
      meta: timeAgo(note.updatedAt),
      searchable: note.title.toLowerCase(),
    })),
    ...files.map((file) => ({
      key: `file:${file.id}`,
      kind: "file" as const,
      id: file.id,
      name: file.fileName,
      meta: humanSize(file.fileSize),
      searchable: file.fileName.toLowerCase(),
    })),
  ]);

  const needle = $derived(query.trim().toLowerCase());
  const shown = $derived(
    rows
      .filter((row) => (filter === "all" || row.kind === filter) && row.searchable.includes(needle))
      .sort((a, b) => Number(pinned.has(b.key)) - Number(pinned.has(a.key)))
  );
  const linkedCount = $derived(linkedNoteIds.size + linkedFileIds.size);

  $effect(() => {
    if (open && !dialog.open) {
      query = "";
      filter = "all";
      pinned = new Set([...linkedNoteIds].map((id) => `note:${id}`).concat([...linkedFileIds].map((id) => `file:${id}`)));
      dialog.showModal();
      void load();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  async function load(): Promise<void> {
    loading = true;
    try {
      [notes, files] = await Promise.all([listNotes(projectId), listAttachments(projectId)]);
      queueMicrotask(() => search?.focus());
    } catch {
      toast(t("docs.loadFailed"), { kind: "error" });
      open = false;
    } finally {
      loading = false;
    }
  }

  function isLinked(row: Row): boolean {
    return row.kind === "note" ? linkedNoteIds.has(row.id) : linkedFileIds.has(row.id);
  }

  async function toggle(row: Row): Promise<void> {
    if (!canEdit || busyKey) return;
    busyKey = row.key;
    await ontoggle(row.kind, row.id);
    busyKey = null;
  }

  function onSearchKey(event: KeyboardEvent): void {
    if (event.key === "Enter" && shown.length === 1) {
      event.preventDefault();
      void toggle(shown[0]);
    }
  }
</script>

<dialog
  class="modal"
  bind:this={dialog}
  aria-label={t("docs.ofCard")}
  onclose={() => (open = false)}
  onclick={(event) => {
    if (event.target === dialog) open = false;
  }}
>
  {#if open}
    <div class="head">
      <h2>{t("docs.linked")}</h2>
      <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={() => (open = false)}><Icon name="x" size={18} /></button>
    </div>

    <div class="search">
      <Icon name="search" size={16} />
      <input class="bare" bind:this={search} bind:value={query} placeholder={t("docs.search")} maxlength="100" onkeydown={onSearchKey} />
    </div>

    <div class="filters" role="tablist" aria-label={t("docs.type")}>
      {#each [["all", t("docs.all")], ["note", t("nav.notes")], ["file", t("nav.files")]] as [value, label] (value)}
        <button type="button" role="tab" class="filter" class:on={filter === value} aria-selected={filter === value} onclick={() => (filter = value as Filter)}>{label}</button>
      {/each}
    </div>

    <ul class="list">
      {#if loading}
        <li class="empty">{t("common.loading")}</li>
      {:else}
        {#each shown as row (row.key)}
          <li>
            <button type="button" class="pick" class:on={isLinked(row)} disabled={!canEdit || busyKey !== null} aria-pressed={isLinked(row)} onclick={() => void toggle(row)}>
              <span class="box">{#if isLinked(row)}<Icon name="check" size={13} />{/if}</span>
              <Icon name={row.kind === "note" ? "note" : "link"} size={16} />
              <span class="name">{row.name}</span>
              <span class="meta">{row.meta}</span>
            </button>
          </li>
        {:else}
          <li class="empty">
            {rows.length === 0 ? t("docs.noneInProject") : t("docs.noMatch")}
          </li>
        {/each}
      {/if}
    </ul>

    <div class="foot">
      <span class="count">{linkedCount === 0 ? t("docs.noneLinked") : linkedCount > 1 ? t("card.linkedDocs", { n: linkedCount }) : t("card.linkedDoc", { n: linkedCount })}</span>
      <button type="button" class="btn btn-primary btn-sm" onclick={() => (open = false)}>{t("common.done")}</button>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(460px, calc(100vw - 24px));
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
  .filters {
    display: flex;
    gap: 4px;
    margin: 0 16px 8px;
  }
  .filter {
    padding: 3px 12px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: transparent;
    color: var(--text-soft);
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .filter.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0 10px;
    list-style: none;
    height: 300px;
    overflow: auto;
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
    padding: 8px 10px;
    border: 0;
    border-radius: var(--radius);
    background: transparent;
    color: var(--text-soft);
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
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    flex: none;
    color: var(--text-faint);
    font-size: 0.78rem;
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
    padding: 28px 14px;
    text-align: center;
    font-size: 0.88rem;
    color: var(--text-faint);
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 14px;
  }
  .count {
    color: var(--text-faint);
    font-size: 0.82rem;
  }
</style>
