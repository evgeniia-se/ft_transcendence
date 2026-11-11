<!-- Owner: Track 2 (Person A — Kanban CRUD and UI)
     Responsible for: the card dialog: title, description (autosaved), list, git info and delete. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { toast } from "../shared/toast.svelte";
  import { formatDateTime, timeAgo } from "../shared/format";
  import Icon from "../shared/ui/Icon.svelte";
  import CardDocuments from "./CardDocuments.svelte";
  import InlineTitle from "./InlineTitle.svelte";
  import TagChip from "./TagChip.svelte";
  import TagsModal from "./TagsModal.svelte";
  import type { BoardStore } from "./boardStore.svelte";

  let { store }: { store: BoardStore } = $props();

  const AUTOSAVE_MS = 900;

  let dialog: HTMLDialogElement;
  let tagsOpen = $state(false);
  const open = $derived(store.openCard);

  // description draft: mirrors the card until the user types
  let description = $state("");
  const DESCRIPTION_MAX = 10000;
  let typing = $state(false);
  let saveState = $state<"idle" | "saving" | "saved">("idle");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let savedTimer: ReturnType<typeof setTimeout> | undefined;
  // card the draft belongs to
  let draftCardId: string | null = null;

  const dirty = $derived(!!open && description !== (open.card.description ?? ""));

  // not typing: follow the card, including live edits
  $effect(() => {
    if (!typing) description = open?.card.description ?? "";
  });

  // another card opened: reset the draft
  $effect(() => {
    void open?.card.id;
    typing = false;
    saveState = "idle";
  });

  $effect(() => {
    draftCardId = open?.card.id ?? null;
  });

  // open or close the dialog with the selected card
  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  // autosave shortly after the last keystroke
  $effect(() => {
    void description;
    clearTimeout(timer);
    if (dirty && typing) timer = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  });

  async function save(): Promise<void> {
    clearTimeout(timer);
    const card = open?.card;
    if (!card || card.id !== draftCardId || description === (card.description ?? "")) return;
    saveState = "saving";
    const ok = await store.editCard(card.id, { description });
    if (ok) {
      typing = false;
      saveState = "saved";
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => (saveState = "idle"), 2200);
    } else {
      saveState = "idle";
    }
  }

  async function close(): Promise<void> {
    await save();
    store.openCardId = null;
  }

  async function onMove(event: Event & { currentTarget: HTMLSelectElement }): Promise<void> {
    if (!open) return;
    const target = store.board?.lists.find((l) => l.id === event.currentTarget.value);
    // moving to another list puts the card last
    if (target && target.id !== open.list.id) await store.moveCard(open.card.id, target.id, target.cards.length);
  }

  function onDelete(): void {
    if (open) store.removeCard(open.card.id);
  }

  async function copyLink(): Promise<void> {
    if (!open || !store.project) return;
    const url = `${location.origin}/app/${store.project.id}?card=${open.card.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("card.linkCopied"), { kind: "success" });
    } catch {
      toast(t("card.copyFailed"), { kind: "error" });
    }
  }

  function onKeydownInDescription(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  }

  const prStatus = $derived(open?.card.gitLink?.prStatus);
  const prLabel = $derived(prStatus === "open" ? t("git.prOpen") : prStatus === "merged" ? t("git.prMerged") : null);
  // link to the branch on GitHub (the repo URL is normalized by the backend)
  const branchUrl = $derived(
    open?.card.gitLink ? safeUrl(`${open.card.gitLink.repoUrl}/tree/${encodeURIComponent(open.card.gitLink.branchName).replace(/%2F/g, "/")}`) : null
  );

  // only link http(s) URLs
  function safeUrl(url: string | null | undefined): string | null {
    try {
      const parsed = new URL(url ?? "");
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
    } catch {
      return null;
    }
  }
</script>

<dialog
  class="modal"
  bind:this={dialog}
  aria-label={t("card.detail")}
  oncancel={(event) => {
    // Escape: save first, then close
    event.preventDefault();
    void close();
  }}
  onclose={() => (store.openCardId = null)}
  onclick={(event) => {
    // a click on the backdrop closes it
    if (event.target === dialog) void close();
  }}
>
  {#if open}
    <div class="head">
      <span class="where">{t("card.inList")} <strong>{open.list.title}</strong></span>
      <div class="head-actions">
        <button type="button" class="icon-btn" aria-label={t("card.copyLinkLabel")} title={t("card.copyLink")} onclick={copyLink}>
          <Icon name="link" size={17} />
        </button>
        <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={close}><Icon name="x" size={18} /></button>
      </div>
    </div>

    <div class="body">
      <div class="main">
        <InlineTitle
          large
          value={open.card.title}
          editable={store.canEdit}
          label={t("card.title")}
          maxlength={200}
          onsave={(title) => store.editCard(open.card.id, { title })}
        />

        <div class="field">
          <div class="label-row">
            <label for="card-description">{t("card.description")}</label>
            <span class="save" aria-live="polite">
              {#if saveState === "saving"}{t("common.saving")}{:else if saveState === "saved"}<Icon name="check" size={13} /> {t("common.saved")}{:else if dirty && store.canEdit}{t("common.unsaved")}{/if}
            </span>
          </div>
          <textarea
            id="card-description"
            class="input"
            bind:value={description}
            maxlength={DESCRIPTION_MAX}
            readonly={!store.canEdit}
            rows="7"
            placeholder={store.canEdit ? t("card.descriptionPlaceholder") : t("card.noDescription")}
            oninput={() => (typing = true)}
            onblur={() => void save()}
            onkeydown={onKeydownInDescription}
          ></textarea>
          {#if store.canEdit && description.length > DESCRIPTION_MAX * 0.9}<span class="hint">{t("card.charCount", { n: description.length, max: DESCRIPTION_MAX })}</span>{/if}
          {#if store.canEdit}<span class="hint">{t("card.autosave")} · <kbd>Ctrl</kbd> + <kbd>{t("card.enterKey")}</kbd> {t("card.saveNow")}</span>{/if}
        </div>

        {#if store.project}
          <CardDocuments projectId={store.project.id} cardId={open.card.id} canEdit={store.canEdit} onchange={() => void store.loadDocCounts()} />
        {/if}

        {#if open.card.linkedBranch || open.card.linkedPrUrl || store.canEdit}
          <div class="git">
            <div class="label-row">
              <div class="label">Git</div>
              {#if prLabel}<span class="chip" class:chip-accent={open.card.gitLink?.prStatus === "merged"} class:chip-warn={open.card.gitLink?.prStatus === "open"}>{prLabel}</span>{/if}
            </div>
            {#if open.card.linkedBranch}
              <div class="git-row">
                <Icon name="branch" size={16} />
                {#if branchUrl}
                  <a href={branchUrl} target="_blank" rel="noopener noreferrer"><code class="selectable">{open.card.linkedBranch}</code></a>
                {:else}
                  <code class="selectable">{open.card.linkedBranch}</code>
                {/if}
              </div>
              {#if open.card.gitLink}<div class="repo selectable">{open.card.gitLink.repoUrl.replace("https://github.com/", "")}</div>{/if}
            {:else if store.canEdit}
              <span class="none">{t("git.noBranch")}</span>
            {/if}
            {#if safeUrl(open.card.linkedPrUrl)}
              <a class="git-row" href={safeUrl(open.card.linkedPrUrl)} target="_blank" rel="noopener noreferrer">
                <Icon name="external" size={16} /> <span>Pull request</span>
              </a>
            {/if}
            {#if store.canEdit}
              <div class="git-actions">
                <button type="button" class="btn btn-ghost btn-sm" onclick={() => (store.gitCardId = open.card.id)}>
                  <Icon name={open.card.linkedBranch ? "pencil" : "plus"} size={14} />
                  {open.card.linkedBranch ? t("common.edit") : t("git.linkBranch")}
                </button>
                {#if open.card.gitLink}
                  <button type="button" class="btn btn-ghost btn-sm" onclick={() => void store.unlinkBranch(open.card.id)}>{t("common.remove")}</button>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <aside class="side">
        <div class="field">
          <label for="card-list">{t("card.list")}</label>
          <select id="card-list" class="input" value={open.list.id} disabled={!store.canEdit} onchange={onMove}>
            {#each store.board?.lists ?? [] as list (list.id)}
              <option value={list.id}>{list.title}</option>
            {/each}
          </select>
        </div>

        <div class="field">
          <span class="label">{t("tags.title")}</span>
          {#if open.card.tags?.length}
            <div class="tag-list">
              {#each open.card.tags as tag (tag.id)}<TagChip {tag} />{/each}
            </div>
          {/if}
          {#if store.canEdit}
            <button type="button" class="btn btn-ghost btn-sm tag-btn" onclick={() => (tagsOpen = true)}>
              <Icon name={open.card.tags?.length ? "pencil" : "plus"} size={14} />
              {open.card.tags?.length ? t("common.edit") : t("common.add")}
            </button>
          {:else if !open.card.tags?.length}
            <span class="none">{t("tags.none")}</span>
          {/if}
        </div>

        {#if open.card.status && open.card.status.toLowerCase() !== "todo"}
          <div class="field">
            <span class="label">{t("card.status")}</span>
            <span class="chip chip-accent status">{open.card.status}</span>
          </div>
        {/if}

        <div class="dates">
          {#if open.card.createdAt}<div><Icon name="clock" size={14} /> {t("card.createdOn", { date: formatDateTime(open.card.createdAt) })}</div>{/if}
          {#if open.card.updatedAt && open.card.updatedAt !== open.card.createdAt}<div>{t("card.updated", { ago: timeAgo(open.card.updatedAt) })}</div>{/if}
        </div>

        {#if store.canEdit}
          <button type="button" class="btn btn-danger btn-sm del" onclick={onDelete}><Icon name="trash" size={15} /> {t("common.delete")}</button>
        {:else}
          <div class="chip">{t("board.readOnly")}</div>
        {/if}
      </aside>
    </div>
    <TagsModal {store} card={open.card} bind:open={tagsOpen} />
  {/if}
</dialog>

<style>
  dialog {
    width: min(760px, calc(100vw - 24px));
    max-height: calc(100vh - 32px);
    overflow: auto;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 0 24px;
  }
  .where {
    font-size: 0.82rem;
    color: var(--text-faint);
  }
  .where strong {
    color: var(--text-soft);
    font-weight: 650;
  }
  .head-actions {
    display: flex;
    gap: 2px;
  }
  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 210px;
    gap: 28px;
    padding: 12px 24px 24px;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 6px;
  }
  .label-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .save {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    color: var(--text-faint);
  }
  textarea {
    min-height: 140px;
  }
  .git {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .repo {
    font-size: 0.78rem;
    color: var(--text-faint);
  }
  .git-actions {
    display: flex;
    gap: 4px;
    margin-left: -8px;
  }
  .git-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.88rem;
    overflow-wrap: anywhere;
  }
  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag-btn {
    align-self: flex-start;
    margin-left: -8px;
  }
  .none {
    font-size: 0.85rem;
    color: var(--text-faint);
  }
  .status {
    align-self: flex-start;
  }
  .dates {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--text-faint);
  }
  .dates div {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .del {
    align-self: flex-start;
    margin-top: 4px;
  }
  @media (max-width: 640px) {
    .body {
      grid-template-columns: 1fr;
      gap: 18px;
    }
  }
</style>
