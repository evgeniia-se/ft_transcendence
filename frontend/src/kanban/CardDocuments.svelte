<!-- Owner: Track 4 (Whiteboard, notes, and supporting modules)
     Responsible for: the linked documents section of the card dialog -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { extensionBadge, humanSize } from "../documents/fileInfo";
  import { describeDocumentError } from "../documents/foldersApi";
  import { downloadAttachment, isPreviewable, linkAttachmentToCard, listAttachments, unlinkAttachmentFromCard, type Attachment } from "../files/attachmentsApi";
  import ImagePreview from "../files/ImagePreview.svelte";
  import { linkNoteToCard, listNotes, noteUrl, unlinkNoteFromCard, type NoteSummary } from "../notes/notesApi";
  import { timeAgo } from "../shared/format";
  import { toast } from "../shared/toast.svelte";
  import DocumentsModal from "./DocumentsModal.svelte";
  import Icon from "../shared/ui/Icon.svelte";

  let {
    projectId,
    cardId,
    canEdit,
    onchange,
  }: { projectId: string; cardId: string; canEdit: boolean; onchange?: () => void } = $props();

  let notes = $state<NoteSummary[]>([]);
  let files = $state<Attachment[]>([]);
  let picking = $state(false);
  let previewId = $state<string | null>(null);
  let failed = $state(false);
  // drops slow answers for a previous card
  let shownCardId: string | null = null;

  $effect(() => {
    const id = cardId;
    shownCardId = id;
    picking = false;
    previewId = null;
    failed = false;
    notes = [];
    files = [];
    Promise.all([listNotes(projectId, id), listAttachments(projectId, id)])
      .then(([n, f]) => {
        if (shownCardId !== id) return;
        notes = n;
        files = f;
      })
      .catch(() => {
        if (shownCardId === id) failed = true;
      });
  });

  const linkedNoteIds = $derived(new Set(notes.map((note) => note.id)));
  const linkedFileIds = $derived(new Set(files.map((file) => file.id)));
  const images = $derived(files.filter(isPreviewable));

  async function toggle(kind: "note" | "file", id: string): Promise<void> {
    try {
      if (kind === "note") {
        if (linkedNoteIds.has(id)) {
          await unlinkNoteFromCard(projectId, id, cardId);
          notes = notes.filter((row) => row.id !== id);
        } else {
          await linkNoteToCard(projectId, id, cardId);
          notes = [...notes, ...(await listNotes(projectId, cardId)).filter((row) => row.id === id)];
        }
      } else if (linkedFileIds.has(id)) {
        await unlinkAttachmentFromCard(projectId, id, cardId);
        files = files.filter((row) => row.id !== id);
      } else {
        await linkAttachmentToCard(projectId, id, cardId);
        files = [...files, ...(await listAttachments(projectId, cardId)).filter((row) => row.id === id)];
      }
      onchange?.();
    } catch (error) {
      toast(describeDocumentError(error), { kind: "error" });
    }
  }

  async function unlinkNote(note: NoteSummary): Promise<void> {
    try {
      await unlinkNoteFromCard(projectId, note.id, cardId);
      notes = notes.filter((row) => row.id !== note.id);
      onchange?.();
    } catch (error) {
      toast(describeDocumentError(error), { kind: "error" });
    }
  }

  async function unlinkFile(file: Attachment): Promise<void> {
    try {
      await unlinkAttachmentFromCard(projectId, file.id, cardId);
      files = files.filter((row) => row.id !== file.id);
      onchange?.();
    } catch (error) {
      toast(describeDocumentError(error), { kind: "error" });
    }
  }

  async function download(file: Attachment): Promise<void> {
    try {
      await downloadAttachment(projectId, file);
    } catch {
      toast(t("files.downloadFailed"), { kind: "error" });
    }
  }
</script>

<ImagePreview {projectId} {images} bind:openId={previewId} ondownload={(image) => void download(image)} />

<div class="field">
  <span class="label">{t("docs.linked")}</span>

  {#if failed}
    <span class="none">{t("docs.loadFailed")}</span>
  {:else if notes.length === 0 && files.length === 0}
    <span class="none">{t("docs.noneLinkedDot")}</span>
  {:else}
    <div class="tiles">
      {#each notes as note (note.id)}
        <div class="tile">
          <a class="open" href={noteUrl(projectId, note.id)} target="_blank" rel="noopener noreferrer" aria-label={t("docs.openNote", { name: note.title })}></a>
          <span class="badge note">NOTE</span>
          <span class="name">{note.title}</span>
          {#if note.preview}<span class="preview">{note.preview}</span>{/if}
          <span class="meta">{timeAgo(note.updatedAt)}</span>
          {#if canEdit}
            <button type="button" class="unlink" title={t("docs.unlink")} aria-label={t("docs.unlinkName", { name: note.title })} onclick={() => void unlinkNote(note)}><Icon name="x" size={14} /></button>
          {/if}
        </div>
      {/each}
      {#each files as file (file.id)}
        <div class="tile">
          {#if isPreviewable(file)}
            <!-- double click with the mouse and Enter or Space with the keyboard -->
            <button
              type="button"
              class="open"
              title={t("docs.dblPreview")}
              aria-label={t("docs.previewOf", { name: file.fileName })}
              onclick={(event) => event.detail === 0 && (previewId = file.id)}
              ondblclick={() => (previewId = file.id)}
            ></button>
          {:else}
            <button type="button" class="open" title={t("files.download")} aria-label={t("files.downloadName", { name: file.fileName })} onclick={() => void download(file)}></button>
          {/if}
          <span class="badge">{extensionBadge(file)}</span>
          <span class="name">{file.fileName}</span>
          <span class="meta">{humanSize(file.fileSize)}</span>
          {#if canEdit}
            <button type="button" class="unlink" title={t("docs.unlink")} aria-label={t("docs.unlinkName", { name: file.fileName })} onclick={() => void unlinkFile(file)}><Icon name="x" size={14} /></button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if canEdit}
    <button type="button" class="btn btn-ghost btn-sm add" onclick={() => (picking = true)}>
      <Icon name="plus" size={14} /> {t("docs.link")}
    </button>
    <DocumentsModal {projectId} bind:open={picking} {canEdit} {linkedNoteIds} {linkedFileIds} ontoggle={toggle} />
  {/if}
</div>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: 8px;
    margin-bottom: 6px;
  }
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    min-width: 0;
    padding: 9px 11px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    transition: border-color 0.12s var(--ease), background 0.12s var(--ease);
  }
  .tile:hover {
    border-color: var(--line-strong);
    background: var(--bg-sunken);
  }
  .open {
    position: absolute;
    inset: 0;
    z-index: 1;
    border: 0;
    border-radius: inherit;
    background: none;
    cursor: pointer;
  }
  .open:focus-visible {
    outline: 2px solid var(--accent);
  }
  .badge {
    padding: 1px 7px;
    border-radius: var(--radius-sm);
    background: var(--bg-sunken);
    color: var(--text-soft);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .badge.note {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .name {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    max-width: 100%;
    overflow: hidden;
    overflow-wrap: anywhere;
    color: var(--text);
    font-size: 0.88rem;
    font-weight: 600;
    line-height: 1.3;
  }
  .preview {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    max-width: 100%;
    overflow: hidden;
    overflow-wrap: anywhere;
    color: var(--text-soft);
    font-size: 0.78rem;
    line-height: 1.4;
  }
  .meta {
    color: var(--text-faint);
    font-size: 0.74rem;
  }
  .unlink {
    position: absolute;
    top: 5px;
    right: 5px;
    z-index: 2;
    display: inline-flex;
    padding: 3px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-faint);
    opacity: 0;
    cursor: pointer;
    transition: opacity 0.12s var(--ease);
  }
  .tile:hover .unlink,
  .unlink:focus-visible {
    opacity: 1;
  }
  .unlink:hover {
    background: var(--surface-raised);
    color: var(--text);
  }
  @media (hover: none) {
    .unlink {
      opacity: 1;
    }
  }
  .none {
    color: var(--text-faint);
    font-size: 0.85rem;
  }
  .add {
    align-self: flex-start;
  }
</style>
