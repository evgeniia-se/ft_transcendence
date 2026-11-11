<script lang="ts">
  import { t } from "../shared/i18n.svelte";
	// Owner: Track 4 (Whiteboard, notes, and supporting modules)
	// Responsible for: the project files page
	import { onMount } from "svelte";
	import { ApiError } from "../api/apiClient";
	import { getProject } from "../api/projectsApi";
	import type { Project } from "../api/types";
	import { fetchCanEdit } from "../documents/canEdit";
	import { extensionBadge, humanSize } from "../documents/fileInfo";
	import { childrenOf, pathTo, subtreeIds } from "../documents/folderTree";
	import {
		copyFolder,
		createFolder,
		deleteFolder,
		describeDocumentError,
		listFolders,
		updateFolder,
		type Folder,
		type FolderLimits,
	} from "../documents/foldersApi";
	import PathBar from "../documents/PathBar.svelte";
	import Tile from "../documents/Tile.svelte";
	import TileGrid from "../documents/TileGrid.svelte";
	import { confirmDialog } from "../shared/confirm.svelte";
	import { toast } from "../shared/toast.svelte";
	import AppHeader from "../shared/ui/AppHeader.svelte";
	import Icon from "../shared/ui/Icon.svelte";
	import ImagePreview from "./ImagePreview.svelte";
	import Thumbnail from "./Thumbnail.svelte";
	import {
		copyAttachment,
		deleteAttachment,
		downloadAttachment,
		isImage,
		isPreviewable,
		listAttachments,
		moveAttachment,
		uploadAttachment,
		UploadError,
		UPLOAD_ACCEPT,
		validateUpload,
		type Attachment,
	} from "./attachmentsApi";

	const { projectId }: { projectId: string } = $props();

	type Item = { kind: "file" | "folder"; id: string };

	let project = $state<Project | null>(null);
	let attachments = $state<Attachment[]>([]);
	let folders = $state<Folder[]>([]);
	let limits = $state<FolderLimits>({ maxSubfolders: 60, maxDepth: 8 });
	// mirrored in the folder query param so refresh and back work
	let current = $state<string | null>(null);
	let loaded = $state(false);
	let loadFailed = $state(false);
	let readOnly = $state(false);
	let busy = $state(false);
	let problem = $state("");
	let upload = $state<{ name: string; ratio: number; index: number; count: number } | null>(null);

	let previewId = $state<string | null>(null);
	let selected = $state<Item | null>(null);
	let clipboard = $state<(Item & { mode: "copy" | "cut" }) | null>(null);
	let dragging = $state<Item | null>(null);
	let dropOver = $state<string | null>(null);
	let creating = $state(false);
	let newName = $state("");
	let renamingId = $state<string | null>(null);
	let renameDraft = $state("");

	const path = $derived(pathTo(folders, current));
	const subfolders = $derived(childrenOf(folders, current));
	const visible = $derived(attachments.filter((attachment) => attachment.folderId === current));
	const visiblePreviews = $derived(visible.filter(isPreviewable));
	const atMaxDepth = $derived(path.length >= limits.maxDepth);
	const atMaxChildren = $derived(subfolders.length >= limits.maxSubfolders);

	$effect(() => {
		document.title = project ? `${t("nav.files")} · ${project.name} — Transcendance` : `${t("nav.files")} — Transcendance`;
	});

	onMount(() => {
		const fromUrl = (): string | null => new URL(window.location.href).searchParams.get("folder");
		const onPop = (): void => {
			current = fromUrl();
			selected = null;
		};
		window.addEventListener("popstate", onPop);
		current = fromUrl();

		void getProject(projectId)
			.then((p) => (project = p))
			.catch(() => {});
		void fetchCanEdit(projectId).then((ok) => (readOnly = !ok));
		void refresh();
		return () => window.removeEventListener("popstate", onPop);
	});

	async function refresh(): Promise<void> {
		try {
			const [files, tree] = await Promise.all([listAttachments(projectId), listFolders(projectId)]);
			attachments = files;
			folders = tree.folders;
			limits = tree.limits;
			loadFailed = false;
			if (current !== null && !folders.some((folder) => folder.id === current)) current = null;
		} catch {
			loadFailed = true;
		} finally {
			loaded = true;
		}
	}

	function openFolder(folderId: string | null): void {
		current = folderId;
		selected = null;
		creating = false;
		const url = new URL(window.location.href);
		if (folderId) url.searchParams.set("folder", folderId);
		else url.searchParams.delete("folder");
		window.history.pushState({}, "", url);
	}

	async function onPick(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = "";
		if (files.length === 0) return;

		const invalid = files.map(validateUpload).filter((message): message is string => message !== null);
		const valid = files.filter((file) => validateUpload(file) === null);
		problem = invalid.join(" ");
		if (valid.length === 0) return;

		busy = true;
		const target = current;
		try {
			for (const [index, file] of valid.entries()) {
				upload = { name: file.name, ratio: 0, index: index + 1, count: valid.length };
				try {
					const created = await uploadAttachment(projectId, file, target, (ratio) => {
						if (upload) upload.ratio = ratio;
					});
					attachments = [created, ...attachments];
				} catch (error) {
					if (error instanceof UploadError) {
						if (error.status === 403) readOnly = true;
						problem = [problem, describeUpload(error)].filter(Boolean).join(" ");
						if (error.status === 403) break;
					} else {
						problem = t("files.uploadNetwork");
						break;
					}
				}
			}
		} finally {
			busy = false;
			upload = null;
		}
	}

	function describeUpload(error: UploadError): string {
		if (error.message === "file_too_large" || error.status === 413) return t("files.tooLarge");
		if (error.message === "insufficient_role" || error.status === 403) return t("files.noUploadRight");
		if (error.message === "network_error") return t("files.uploadNetwork");
		if (error.message === "invalid_upload") return t("files.typeRejected");
		return t("files.uploadFailed");
	}

	async function onDownload(attachment: Attachment): Promise<void> {
		problem = "";
		try {
			await downloadAttachment(projectId, attachment);
		} catch {
			problem = t("files.downloadFailed");
		}
	}

	async function onDelete(attachment: Attachment): Promise<void> {
		const ok = await confirmDialog({
			title: t("list.deleteTitle", { name: attachment.fileName }),
			message:
				attachment.cardIds.length > 0
					? t("files.deleteLinked")
					: t("files.deleteText"),
			confirmLabel: t("common.delete"),
			danger: true,
		});
		if (!ok) return;
		problem = "";
		try {
			await deleteAttachment(projectId, attachment.id);
			attachments = attachments.filter((row) => row.id !== attachment.id);
			if (selected?.id === attachment.id) selected = null;
			if (clipboard?.id === attachment.id) clipboard = null;
		} catch (error) {
			if (error instanceof ApiError && error.status === 403) {
				readOnly = true;
				problem = t("files.noDeleteRight");
				return;
			}
			problem = t("files.deleteFailed");
		}
	}

	async function onCreateFolder(): Promise<void> {
		const name = newName.trim();
		if (name === "") {
			creating = false;
			return;
		}
		try {
			const folder = await createFolder(projectId, name, current);
			folders = [...folders, folder];
			creating = false;
			newName = "";
		} catch (error) {
			toast(describeDocumentError(error, limits), { kind: "error" });
		}
	}

	async function onRename(folder: Folder): Promise<void> {
		if (renamingId !== folder.id) return;
		const name = renameDraft.trim();
		renamingId = null;
		if (name === "" || name === folder.name) return;
		try {
			const updated = await updateFolder(projectId, folder.id, { name });
			folders = folders.map((row) => (row.id === folder.id ? updated : row));
		} catch (error) {
			toast(describeDocumentError(error, limits), { kind: "error" });
		}
	}

	async function onDeleteFolder(folder: Folder): Promise<void> {
		const ok = await confirmDialog({
			title: t("files.deleteFolderTitle", { name: folder.name }),
			message: t("files.deleteFolderText"),
			confirmLabel: t("common.delete"),
			danger: true,
		});
		if (!ok) return;
		try {
			await deleteFolder(projectId, folder.id);
			folders = folders.filter((row) => row.id !== folder.id);
			if (selected?.id === folder.id) selected = null;
			if (clipboard?.id === folder.id) clipboard = null;
		} catch (error) {
			toast(describeDocumentError(error, limits), { kind: "error" });
		}
	}

	function parentOf(item: Item): string | null {
		return item.kind === "file"
			? (attachments.find((row) => row.id === item.id)?.folderId ?? null)
			: (folders.find((row) => row.id === item.id)?.parentId ?? null);
	}

	// depth and size limits are checked by the server
	function canMoveTo(item: Item, target: string | null): boolean {
		if (parentOf(item) === target) return false;
		return !(item.kind === "folder" && target !== null && subtreeIds(folders, item.id).has(target));
	}

	function canCopyTo(item: Item, target: string | null): boolean {
		return !(item.kind === "folder" && target !== null && subtreeIds(folders, item.id).has(target));
	}

	async function transfer(item: Item, target: string | null, mode: "copy" | "cut"): Promise<boolean> {
		problem = "";
		try {
			if (mode === "cut") {
				if (item.kind === "file") {
					const moved = await moveAttachment(projectId, item.id, target);
					attachments = attachments.map((row) => (row.id === moved.id ? moved : row));
				} else {
					const moved = await updateFolder(projectId, item.id, { parentId: target });
					folders = folders.map((row) => (row.id === moved.id ? moved : row));
				}
			} else if (item.kind === "file") {
				attachments = [await copyAttachment(projectId, item.id, target), ...attachments];
			} else {
				await copyFolder(projectId, item.id, target);
				await refresh();
			}
			return true;
		} catch (error) {
			toast(describeDocumentError(error, limits), { kind: "error" });
			return false;
		}
	}

	function setClipboard(mode: "copy" | "cut"): void {
		if (readOnly || !selected) return;
		clipboard = { ...selected, mode };
		toast(mode === "copy" ? t("copy.copied") : t("files.cutDone"), { duration: 1600 });
	}

	async function paste(): Promise<void> {
		if (readOnly || !clipboard) return;
		const { mode, ...item } = clipboard;
		if (mode === "cut" ? !canMoveTo(item, current) : !canCopyTo(item, current)) {
			toast(mode === "cut" ? t("files.alreadyHere") : t("files.copyIntoItself"), { kind: "error" });
			return;
		}
		if (await transfer(item, current, mode)) {
			if (mode === "cut") clipboard = null;
			selected = null;
		}
	}

	function onDragStart(event: DragEvent, item: Item): void {
		if (readOnly) {
			event.preventDefault();
			return;
		}
		dragging = item;
		selected = item;
		event.dataTransfer?.setData("text/plain", item.id);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
	}

	function onDragEnd(): void {
		dragging = null;
		dropOver = null;
	}

	function onFolderDragOver(event: DragEvent, folder: Folder): void {
		if (!dragging || !canMoveTo(dragging, folder.id)) return;
		event.preventDefault();
		dropOver = folder.id;
	}

	async function dropOnto(target: string | null): Promise<void> {
		const item = dragging;
		dragging = null;
		dropOver = null;
		if (item && canMoveTo(item, target)) await transfer(item, target, "cut");
	}

	function isTyping(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
	}

	function onKeydown(event: KeyboardEvent): void {
		if (isTyping(event.target)) return;
		if (event.key === "Escape") {
			selected = null;
			return;
		}
		if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
		const key = event.key.toLowerCase();
		if (key === "c" && selected) {
			event.preventDefault();
			setClipboard("copy");
		} else if (key === "x" && selected) {
			event.preventDefault();
			setClipboard("cut");
		} else if (key === "v" && clipboard) {
			event.preventDefault();
			void paste();
		}
	}

	function contents(folder: Folder): string {
		const count = attachments.filter((row) => row.folderId === folder.id).length + folders.filter((row) => row.parentId === folder.id).length;
		return count === 0 ? t("files.emptyFolder") : count > 1 ? t("files.items", { n: count }) : t("files.item");
	}

	function clipboardName(): string {
		if (!clipboard) return "";
		return clipboard.kind === "file"
			? (attachments.find((row) => row.id === clipboard?.id)?.fileName ?? "")
			: (folders.find((row) => row.id === clipboard?.id)?.name ?? "");
	}

	function focusOnMount(node: HTMLInputElement): void {
		node.focus();
		node.select();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<ImagePreview {projectId} images={visiblePreviews} bind:openId={previewId} ondownload={(file) => void onDownload(file)} />

<AppHeader project={project ?? undefined} active="files" />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
<main class="page" onclick={(event) => event.target === event.currentTarget && (selected = null)}>
	<header class="title">
		<div class="heading">
			<span class="badge"><Icon name="folder" size={20} /></span>
			<h1>{t("nav.files")}</h1>
		</div>
		{#if !readOnly}
			<div class="buttons">
				{#if clipboard}
					<button type="button" class="btn btn-ghost btn-sm" title={t("files.pasteHint", { name: clipboardName() })} onclick={() => void paste()}>
						<Icon name="copy" size={15} /> {t("files.paste")}
					</button>
				{/if}
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					disabled={atMaxDepth || atMaxChildren}
					title={atMaxDepth ? t("folders.maxDepth", { n: limits.maxDepth }) : atMaxChildren ? t("files.maxChildren", { n: limits.maxSubfolders }) : ""}
					onclick={() => ((creating = true), (newName = ""))}
				>
					<Icon name="folder" size={15} /> {t("files.newFolder")}
				</button>
				<label class="btn btn-primary btn-sm upload">
					<Icon name="plus" size={15} />
					<span>{busy ? t("files.sending") : t("files.add")}</span>
					<input type="file" multiple accept={UPLOAD_ACCEPT} onchange={onPick} disabled={busy} />
				</label>
			</div>
		{/if}
	</header>

	<PathBar {path} {current} onnavigate={openFolder} canDrop={(folderId) => !!dragging && canMoveTo(dragging, folderId)} ondropitem={(folderId) => void dropOnto(folderId)} />

	{#if upload}
		<div class="progress" role="status">
			<div class="progress-label">
				<span class="progress-name">{t("files.sendingName", { name: upload.name })}{upload.count > 1 ? ` · ${t("files.nOfM", { n: upload.index, m: upload.count })}` : ""}</span>
				<span>{Math.round(upload.ratio * 100)} %</span>
			</div>
			<progress max="100" value={Math.round(upload.ratio * 100)} aria-label={t("files.progress", { name: upload.name })}></progress>
		</div>
	{/if}

	{#if problem}
		<p class="problem" role="alert">{problem}</p>
	{:else if !readOnly && !upload}
		<p class="hint limits">{t("files.limits")}</p>
	{/if}

	{#if loadFailed}
		<p class="empty">{t("files.loadFailed")}</p>
	{:else if loaded && !creating && subfolders.length === 0 && visible.length === 0}
		<p class="empty">{current === null ? t("files.empty") : t("files.folderEmpty")}</p>
	{:else}
		<TileGrid fixed>
			{#if creating}
				<Tile label={t("files.newFolder")}>
					<span class="type folder-type"><Icon name="folder" size={12} /> {t("files.folderBadge")}</span>
					<form class="new" onsubmit={(event) => (event.preventDefault(), void onCreateFolder())}>
						<input
							bind:value={newName}
							maxlength="100"
							placeholder={t("files.folderName")}
							aria-label={t("files.newFolderName")}
							use:focusOnMount
							onblur={() => void onCreateFolder()}
							onkeydown={(event) => event.key === "Escape" && ((newName = ""), (creating = false))}
						/>
					</form>
				</Tile>
			{/if}

			{#each subfolders as folder (folder.id)}
				{@const item = { kind: "folder", id: folder.id } as const}
				<Tile
					label={t("files.folderLabel", { name: folder.name })}
					selected={selected?.id === folder.id}
					faded={clipboard?.mode === "cut" && clipboard.id === folder.id}
					dropActive={dropOver === folder.id}
					onselect={() => (selected = item)}
					onopen={() => openFolder(folder.id)}
					ondragstart={renamingId === folder.id ? undefined : (event) => onDragStart(event, item)}
					ondragend={onDragEnd}
					ondragover={(event) => onFolderDragOver(event, folder)}
					ondragleave={() => (dropOver = null)}
					ondrop={(event) => (event.preventDefault(), void dropOnto(folder.id))}
				>
					<span class="type folder-type"><Icon name="folder" size={12} /> {t("files.folderBadge")}</span>
					{#if renamingId === folder.id}
						<input
							class="rename"
							bind:value={renameDraft}
							maxlength="100"
							aria-label={t("files.folderName")}
							use:focusOnMount
							onblur={() => void onRename(folder)}
							onkeydown={(event) => {
								if (event.key === "Enter") void onRename(folder);
								if (event.key === "Escape") renamingId = null;
							}}
						/>
					{:else}
						<h2 class="file-name">{folder.name}</h2>
					{/if}
					<div class="foot"><span class="meta">{contents(folder)}</span></div>
					{#snippet actions()}
						<button type="button" class="icon" title={t("common.open")} aria-label={t("files.openFolder")} onclick={() => openFolder(folder.id)}><Icon name="arrowRight" size={14} /></button>
						{#if !readOnly}
							<button type="button" class="icon" title={t("common.rename")} aria-label={t("files.renameFolder")} onclick={() => ((renamingId = folder.id), (renameDraft = folder.name))}><Icon name="pencil" size={14} /></button>
							<button type="button" class="icon" title={t("copy.copy")} aria-label={t("files.copyFolder")} onclick={() => ((selected = item), setClipboard("copy"))}><Icon name="copy" size={14} /></button>
							<button type="button" class="icon" title={t("files.cut")} aria-label={t("files.cutFolder")} onclick={() => ((selected = item), setClipboard("cut"))}><Icon name="cut" size={14} /></button>
							<button type="button" class="icon" title={t("common.delete")} aria-label={t("files.deleteFolder")} onclick={() => void onDeleteFolder(folder)}><Icon name="trash" size={14} /></button>
						{/if}
					{/snippet}
				</Tile>
			{/each}

			{#each visible as attachment (attachment.id)}
				{@const item = { kind: "file", id: attachment.id } as const}
				<Tile
					label={isPreviewable(attachment) ? t("docs.previewOf", { name: attachment.fileName }) : t("files.downloadName", { name: attachment.fileName })}
					selected={selected?.id === attachment.id}
					faded={clipboard?.mode === "cut" && clipboard.id === attachment.id}
					onselect={() => (selected = item)}
					onopen={() => (isPreviewable(attachment) ? (previewId = attachment.id) : void onDownload(attachment))}
					ondragstart={(event) => onDragStart(event, item)}
					ondragend={onDragEnd}
				>
					{#if isImage(attachment)}
						<div class="thumb-wrap">
							<Thumbnail {projectId} {attachment} />
							<span class="type overlay">{extensionBadge(attachment)}</span>
						</div>
					{:else}
						<span class="type">{extensionBadge(attachment)}</span>
					{/if}
					<h2 class="file-name" class:one-line={isImage(attachment)}>{attachment.fileName}</h2>
					<div class="foot">
						<span class="meta">{humanSize(attachment.fileSize)}</span>
						{#if attachment.cardIds.length > 0}
							<span class="chip" title={t("notes.linkedCards")}>{attachment.cardIds.length > 1 ? t("board.cards", { n: attachment.cardIds.length }) : t("board.card", { n: attachment.cardIds.length })}</span>
						{/if}
					</div>
					{#snippet actions()}
						{#if isPreviewable(attachment)}
							<button type="button" class="icon" title={t("files.preview")} aria-label={t("files.previewFile")} onclick={() => (previewId = attachment.id)}><Icon name="eye" size={14} /></button>
						{/if}
						<button type="button" class="icon" title={t("files.download")} aria-label={t("files.downloadFile")} onclick={() => void onDownload(attachment)}><Icon name="arrowRight" size={14} /></button>
						{#if !readOnly}
							<button type="button" class="icon" title={t("copy.copy")} aria-label={t("files.copyFile")} onclick={() => ((selected = item), setClipboard("copy"))}><Icon name="copy" size={14} /></button>
							<button type="button" class="icon" title={t("files.cut")} aria-label={t("files.cutFile")} onclick={() => ((selected = item), setClipboard("cut"))}><Icon name="cut" size={14} /></button>
							<button type="button" class="icon" title={t("common.delete")} aria-label={t("files.deleteFile")} onclick={() => void onDelete(attachment)}><Icon name="trash" size={14} /></button>
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
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.heading {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.buttons {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
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

	.upload {
		cursor: pointer;
	}

	.upload {
		position: relative;
	}

	.upload input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.upload:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.progress {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0 0 1rem;
		font-size: 0.85rem;
		color: var(--text-soft);
	}

	.progress-label {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	.progress-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	progress {
		width: 100%;
		height: 6px;
		border: 0;
		border-radius: 999px;
		overflow: hidden;
		appearance: none;
		background: var(--bg-sunken);
	}

	progress::-webkit-progress-bar {
		background: var(--bg-sunken);
	}

	progress::-webkit-progress-value {
		background: var(--accent);
		transition: width 0.2s var(--ease);
	}

	progress::-moz-progress-bar {
		background: var(--accent);
	}

	.limits {
		margin: 0 0 1rem;
	}

	.thumb-wrap {
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.type.overlay {
		position: absolute;
		top: 6px;
		left: 6px;
		background: color-mix(in srgb, var(--surface-raised) 85%, transparent);
	}

	.file-name.one-line {
		-webkit-line-clamp: 1;
		line-clamp: 1;
	}

	.problem {
		margin: 0 0 1rem;
		color: var(--danger);
		font-size: 0.875rem;
	}

	.empty {
		padding: 2rem 0;
		text-align: center;
		color: var(--text-faint);
		font-size: 0.9rem;
	}

	.type {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		background: var(--bg-sunken);
		color: var(--text-soft);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.folder-type {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.file-name {
		flex-shrink: 0;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		margin: 0;
		overflow: hidden;
		overflow-wrap: anywhere;
		color: var(--text);
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.3;
	}

	.foot {
		display: flex;
		margin-top: auto;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.meta {
		color: var(--text-faint);
		font-size: 0.78rem;
		white-space: nowrap;
	}

	.rename,
	.new input {
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
</style>
