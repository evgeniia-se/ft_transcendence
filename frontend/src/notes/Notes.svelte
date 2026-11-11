<script lang="ts">
  import { t } from "../shared/i18n.svelte";
	// Owner: Track 4 (Whiteboard, notes, and supporting modules)
	// Responsible for: one note with its live collaborative editor
	import { onMount, onDestroy } from "svelte";
	import { Editor } from "@tiptap/core";
	import Collaboration from "@tiptap/extension-collaboration";
	import CollaborationCaret from "@tiptap/extension-collaboration-caret";
	import StarterKit from "@tiptap/starter-kit";
	import { Awareness } from "y-protocols/awareness";
	import * as Y from "yjs";
	import { getProject } from "../api/projectsApi";
	import type { Project } from "../api/types";
	import { getStoredUser } from "../auth/authClient";
	import { describeDocumentError } from "../documents/foldersApi";
	import { toast } from "../shared/toast.svelte";
	import AppHeader from "../shared/ui/AppHeader.svelte";
	import Icon from "../shared/ui/Icon.svelte";
	import { getNote, updateNote } from "./notesApi";
	import { connectNoteCollab } from "./notesCollab";

	const { projectId, noteId }: { projectId: string; noteId: string } = $props();

	let host: HTMLDivElement;
	let editor: Editor | undefined;
	let disconnect: (() => void) | undefined;

	let project = $state<Project | null>(null);
	let title = $state("");
	let savedTitle = "";
	let failure = $state("");
	let readOnly = $state(false);
	let connected = $state(false);
	let synced = $state(false);

	const backUrl = $derived(`/app/${projectId}/notes`);

	$effect(() => {
		document.title = `${title || t("notes.note")} · ${project?.name ?? t("nav.notes")} — Transcendance`;
	});

	onMount(() => {
		void getProject(projectId)
			.then((p) => (project = p))
			.catch(() => {});
		void getNote(projectId, noteId)
			.then((note) => {
				title = savedTitle = note.title;
			})
			.catch(() => (failure = t("notes.notFound")));

		const ydoc = new Y.Doc();
		const awareness = new Awareness(ydoc);
		const me = getStoredUser();

		editor = new Editor({
			element: host,
			// Yjs keeps its own undo history
			extensions: [
				StarterKit.configure({ undoRedo: false }),
				Collaboration.configure({ document: ydoc }),
				CollaborationCaret.configure({
					provider: { awareness },
					user: { name: me?.name ?? t("notes.anonymous"), color: colorFor(me?.id ?? "") },
				}),
			],
			// read only until the first sync so nothing is typed on an empty document
			editable: false,
		});

		disconnect = connectNoteCollab(noteId, ydoc, awareness, {
			onSynced: (canEdit) => {
				synced = true;
				readOnly = !canEdit;
				editor?.setEditable(canEdit);
			},
			onDenied: () => (failure = t("notes.noAccess")),
			onDeleted: () => (failure = t("notes.deleted")),
			onStatus: (isConnected) => {
				connected = isConnected;
				if (!isConnected) {
					synced = false;
					editor?.setEditable(false);
				}
			},
		});
	});

	// same person same colour on every screen
	const CURSOR_COLORS = ["#e5484d", "#d6409f", "#8e4ec6", "#3e63dd", "#0090ff", "#12a594", "#30a46c", "#d9730d"];
	function colorFor(userId: string): string {
		let hash = 0;
		for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
		return CURSOR_COLORS[hash % CURSOR_COLORS.length];
	}

	async function saveTitle(): Promise<void> {
		const next = title.trim();
		if (next === savedTitle) {
			title = savedTitle;
			return;
		}
		try {
			const note = await updateNote(projectId, noteId, { title: next });
			title = savedTitle = note.title;
		} catch (error) {
			title = savedTitle;
			toast(describeDocumentError(error), { kind: "error" });
		}
	}

	onDestroy(() => {
		disconnect?.();
		editor?.destroy();
	});
</script>

<AppHeader project={project ?? undefined} active="notes" />

<main class="page">
	{#if failure}
		<p class="failure">{failure} <a href={backUrl}>{t("notes.back")}</a></p>
	{:else}
		<a class="back" href={backUrl}><Icon name="arrowLeft" size={15} /> {t("nav.notes")}</a>
		<header class="title">
			<div class="heading">
				<span class="badge"><Icon name="note" size={20} /></span>
				<div>
					<input
						class="note-title"
						bind:value={title}
						maxlength="200"
						readonly={readOnly}
						aria-label={t("notes.title")}
						onblur={() => void saveTitle()}
						onkeydown={(event) => event.key === "Enter" && event.currentTarget.blur()}
					/>
					{#if project}<p class="project">{project.name}</p>{/if}
				</div>
			</div>
			<span class="status" role="status">
				{#if !connected}
					<span class="spinner" aria-hidden="true"></span>
					{t("notes.reconnecting")}
				{:else if !synced}
					<span class="spinner" aria-hidden="true"></span>
					{t("notes.syncing")}
				{:else if readOnly}
					{t("board.readOnly")}
				{:else}
					<svg class="check" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
					{t("notes.synced")}
				{/if}
			</span>
		</header>
	{/if}

	<div class="card" class:hidden={failure !== ""}>
		<div class="editor" bind:this={host}></div>
	</div>
</main>

<style>
	.page {
		max-width: 52rem;
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

	.note-title {
		width: min(28rem, 62vw);
		margin: 0;
		padding: 2px 6px;
		margin-left: -6px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text);
		font-family: var(--font-serif);
		font-size: 1.6rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		line-height: 1.15;
	}

	.note-title:hover:not([readonly]) {
		border-color: var(--line);
	}

	.note-title:focus {
		border-color: var(--accent);
		outline: none;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-bottom: 0.9rem;
		color: var(--text-soft);
		font-size: 0.85rem;
		text-decoration: none;
	}

	.back:hover {
		color: var(--text);
	}

	.project {
		margin: 2px 0 0;
		font-size: 0.85rem;
		color: var(--text-faint);
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		color: var(--text-faint);
		font-size: 0.82rem;
		font-weight: 550;
		white-space: nowrap;
	}

	.check {
		color: var(--online);
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid var(--line-strong);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.failure {
		padding: 2rem 0;
		text-align: center;
		color: var(--text-soft);
	}

	.hidden {
		display: none;
	}

	.card {
		background: var(--surface-raised);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		overflow: hidden;
		transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease);
	}

	.card:focus-within {
		border-color: var(--accent);
		box-shadow: var(--shadow-md), 0 0 0 3px var(--accent-soft);
	}

	.editor :global(.ProseMirror) {
		min-height: 60vh;
		padding: 1.75rem 2rem;
		outline: none;
		line-height: 1.7;
		color: var(--text);
	}

	.editor :global(.ProseMirror > * + *) {
		margin-top: 0.75em;
	}

	.editor :global(.ProseMirror h1),
	.editor :global(.ProseMirror h2),
	.editor :global(.ProseMirror h3) {
		font-family: var(--font-serif);
		line-height: 1.25;
	}

	.editor :global(.ProseMirror ul),
	.editor :global(.ProseMirror ol) {
		padding-left: 1.5rem;
	}

	.editor :global(.ProseMirror blockquote) {
		margin-left: 0;
		padding-left: 1rem;
		border-left: 3px solid var(--line-strong);
		color: var(--text-soft);
	}

	.editor :global(.ProseMirror code) {
		padding: 0.1em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--bg-sunken);
		font-family: var(--font-mono);
		font-size: 0.9em;
	}

	.editor :global(.ProseMirror pre) {
		padding: 0.85rem 1rem;
		border-radius: var(--radius);
		background: var(--bg-sunken);
		overflow-x: auto;
	}

	.editor :global(.ProseMirror pre code) {
		padding: 0;
		background: none;
	}

	.editor :global(.collaboration-carets__caret) {
		position: relative;
		margin-left: -1px;
		margin-right: -1px;
		border-left: 2px solid;
		word-break: normal;
		pointer-events: none;
	}

	.editor :global(.collaboration-carets__label) {
		position: absolute;
		top: -1.5em;
		left: -2px;
		padding: 1px 6px;
		border-radius: 4px 4px 4px 0;
		color: #fff;
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.3;
		white-space: nowrap;
		user-select: none;
	}

	@media (max-width: 600px) {
		.editor :global(.ProseMirror) {
			padding: 1.15rem 1rem;
		}
	}
</style>
