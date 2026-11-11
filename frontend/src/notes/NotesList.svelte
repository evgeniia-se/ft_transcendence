<script lang="ts">
  import { t } from "../shared/i18n.svelte";
	// Owner: Track 4 (Whiteboard, notes, and supporting modules)
	// Responsible for: the notes list page
	import { onMount } from "svelte";
	import { getProject } from "../api/projectsApi";
	import type { Project } from "../api/types";
	import { fetchCanEdit } from "../documents/canEdit";
	import Tile from "../documents/Tile.svelte";
	import TileGrid from "../documents/TileGrid.svelte";
	import { describeDocumentError } from "../documents/foldersApi";
	import { confirmDialog } from "../shared/confirm.svelte";
	import { timeAgo } from "../shared/format";
	import { toast } from "../shared/toast.svelte";
	import AppHeader from "../shared/ui/AppHeader.svelte";
	import Icon from "../shared/ui/Icon.svelte";
	import { createNote, deleteNote, listNotes, noteUrl, updateNote, type NoteSummary } from "./notesApi";

	const { projectId }: { projectId: string } = $props();

	let project = $state<Project | null>(null);
	let notes = $state<NoteSummary[]>([]);
	let canEdit = $state(false);
	let loaded = $state(false);
	let loadFailed = $state(false);
	let creating = $state(false);
	let renamingId = $state<string | null>(null);
	let renameDraft = $state("");

	$effect(() => {
		document.title = project ? `${t("nav.notes")} · ${project.name} — Transcendance` : `${t("nav.notes")} — Transcendance`;
	});

	onMount(() => {
		void getProject(projectId)
			.then((p) => (project = p))
			.catch(() => {});
		void fetchCanEdit(projectId).then((ok) => (canEdit = ok));
		void listNotes(projectId)
			.then((rows) => (notes = rows))
			.catch(() => (loadFailed = true))
			.finally(() => (loaded = true));
	});

	async function onCreate(): Promise<void> {
		creating = true;
		try {
			const note = await createNote(projectId, {});
			window.location.href = noteUrl(projectId, note.id);
		} catch (error) {
			toast(describeDocumentError(error), { kind: "error" });
			creating = false;
		}
	}

	function replace(updated: NoteSummary): void {
		notes = notes.map((note) => (note.id === updated.id ? updated : note));
	}

	async function rename(note: NoteSummary): Promise<void> {
		if (renamingId !== note.id) return;
		const title = renameDraft.trim();
		renamingId = null;
		if (title === "" || title === note.title) return;
		try {
			replace(await updateNote(projectId, note.id, { title }));
		} catch (error) {
			toast(describeDocumentError(error), { kind: "error" });
		}
	}

	async function remove(note: NoteSummary): Promise<void> {
		const ok = await confirmDialog({
			title: t("notes.deleteTitle", { name: note.title }),
			message: t("notes.deleteText"),
			confirmLabel: t("common.delete"),
			danger: true,
		});
		if (!ok) return;
		try {
			await deleteNote(projectId, note.id);
			notes = notes.filter((row) => row.id !== note.id);
		} catch (error) {
			toast(describeDocumentError(error), { kind: "error" });
		}
	}

	function focusOnMount(node: HTMLInputElement): void {
		node.focus();
		node.select();
	}
</script>

<AppHeader project={project ?? undefined} active="notes" />

<main class="page">
	<header class="title">
		<div class="heading">
			<span class="badge"><Icon name="note" size={20} /></span>
			<h1>{t("nav.notes")}</h1>
		</div>
		{#if canEdit}
			<button type="button" class="btn btn-primary btn-sm" disabled={creating} onclick={() => void onCreate()}>
				<Icon name="plus" size={15} /> {creating ? t("signup.busy") : t("notes.new")}
			</button>
		{/if}
	</header>

	{#if loadFailed}
		<p class="empty">{t("notes.loadFailed")}</p>
	{:else if loaded && notes.length === 0}
		<p class="empty">{t("notes.empty")}</p>
	{:else}
		<TileGrid>
			{#each notes as note (note.id)}
				<Tile href={renamingId === note.id ? undefined : noteUrl(projectId, note.id)} label={t("docs.openNote", { name: note.title })}>
					{#if renamingId === note.id}
						<input
							class="rename"
							bind:value={renameDraft}
							maxlength="200"
							aria-label={t("notes.title")}
							use:focusOnMount
							onblur={() => void rename(note)}
							onkeydown={(event) => {
								if (event.key === "Enter") void rename(note);
								if (event.key === "Escape") renamingId = null;
							}}
						/>
					{:else}
						<h2 class="note-title">{note.title}</h2>
					{/if}
					{#if note.preview}
						<p class="preview">{note.preview}</p>
					{:else}
						<p class="preview empty-note">{t("notes.emptyNote")}</p>
					{/if}
					<div class="foot">
						<span class="meta">{timeAgo(note.updatedAt)}</span>
						{#if note.cardIds.length > 0}
							<span class="chip" title={t("notes.linkedCards")}>{note.cardIds.length > 1 ? t("board.cards", { n: note.cardIds.length }) : t("board.card", { n: note.cardIds.length })}</span>
						{/if}
					</div>
					{#snippet actions()}
						{#if canEdit}
							<button type="button" class="icon" title={t("common.rename")} aria-label={t("notes.rename")} onclick={() => ((renamingId = note.id), (renameDraft = note.title))}>
								<Icon name="pencil" size={14} />
							</button>
							<button type="button" class="icon" title={t("common.delete")} aria-label={t("notes.delete")} onclick={() => void remove(note)}>
								<Icon name="trash" size={14} />
							</button>
						{/if}
					{/snippet}
				</Tile>
			{/each}
		</TileGrid>
	{/if}
</main>

<style>
	.page {
		max-width: 64rem;
		margin: 0 auto;
		padding: 2rem 1rem 3rem;
	}

	.title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.heading {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.badge {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: var(--radius);
		background: var(--accent-soft);
		color: var(--accent);
	}

	h1 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 1.6rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.empty {
		padding: 2rem 0;
		text-align: center;
		color: var(--text-faint);
		font-size: 0.9rem;
	}

	.note-title {
		margin: 0;
		overflow-wrap: anywhere;
		color: var(--text);
		font-family: var(--font-serif);
		font-size: 1.05rem;
		font-weight: 600;
		line-height: 1.25;
	}

	.preview {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 9;
		line-clamp: 9;
		margin: 0;
		overflow: hidden;
		overflow-wrap: anywhere;
		color: var(--text-soft);
		font-size: 0.88rem;
		line-height: 1.5;
	}

	.empty-note {
		color: var(--text-faint);
		font-style: italic;
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.meta {
		color: var(--text-faint);
		font-size: 0.78rem;
		white-space: nowrap;
	}

	.icon {
		display: inline-flex;
		padding: 0.3rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-soft);
		cursor: pointer;
	}

	.icon:hover {
		background: var(--bg-sunken);
		color: var(--text);
	}

	.rename {
		position: relative;
		z-index: 2;
		width: 100%;
		box-sizing: border-box;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--text);
		font: inherit;
	}
</style>
