<script lang="ts">
  import { t } from "../shared/i18n.svelte";
	// Owner: Track 4 (Whiteboard, notes, and supporting modules)
	// Responsible for: the full size preview of images, PDF and text files
	import Icon from "../shared/ui/Icon.svelte";
	import { extensionBadge, humanSize } from "../documents/fileInfo";
	import { fetchAttachmentBlob, isImage, isPdf, type Attachment } from "./attachmentsApi";

	const MAX_TEXT_CHARS = 200_000;

	let {
		projectId,
		images,
		openId = $bindable(null),
		ondownload,
	}: {
		projectId: string;
		images: Attachment[];
		openId: string | null;
		ondownload: (attachment: Attachment) => void;
	} = $props();

	let dialog: HTMLDialogElement;
	let url = $state<string | null>(null);
	let text = $state<string | null>(null);
	let failed = $state(false);

	const index = $derived(images.findIndex((image) => image.id === openId));
	const current = $derived(index >= 0 ? images[index] : null);

	$effect(() => {
		if (current && !dialog.open) dialog.showModal();
		else if (!current && dialog.open) dialog.close();
	});

	$effect(() => {
		const image = current;
		url = null;
		text = null;
		failed = false;
		if (!image) return;
		let cancelled = false;
		let created: string | null = null;
		fetchAttachmentBlob(projectId, image)
			.then(async (blob) => {
				if (cancelled) return;
				if (isImage(image) || isPdf(image)) {
					created = URL.createObjectURL(new Blob([blob], { type: image.fileType }));
					url = created;
					return;
				}
				const content = await blob.text();
				if (!cancelled) text = content.length > MAX_TEXT_CHARS ? `${content.slice(0, MAX_TEXT_CHARS)}\n…` : content;
			})
			.catch(() => {
				if (!cancelled) failed = true;
			});
		return () => {
			cancelled = true;
			if (created) URL.revokeObjectURL(created);
		};
	});

	function go(step: number): void {
		if (images.length < 2 || index < 0) return;
		openId = images[(index + step + images.length) % images.length].id;
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			go(-1);
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			go(1);
		}
	}
</script>

<dialog
	class="modal preview"
	bind:this={dialog}
	aria-label={current ? t("docs.previewOf", { name: current.fileName }) : t("files.preview")}
	onclose={() => (openId = null)}
	onkeydown={onKeydown}
	onclick={(event) => {
		if (event.target === dialog) openId = null;
	}}
>
	{#if current}
		<header>
			<span class="badge">{extensionBadge(current)}</span>
			<div class="info">
				<span class="name" title={current.fileName}>{current.fileName}</span>
				<span class="meta">{humanSize(current.fileSize)}{images.length > 1 ? ` · ${t("files.nOfM", { n: index + 1, m: images.length })}` : ""}</span>
			</div>
			<button type="button" class="icon-btn" title={t("preview.closeHint")} aria-label={t("preview.close")} onclick={() => (openId = null)}><Icon name="x" size={18} /></button>
		</header>

		<div class="stage">
			{#if images.length > 1}
				<button type="button" class="nav prev" title={t("preview.prevHint")} aria-label={t("preview.prev")} onclick={() => go(-1)}><Icon name="chevronLeft" size={22} /></button>
			{/if}
			{#key current.id}
				{#if url && isImage(current)}
					<img src={url} alt={current.fileName} />
				{:else if url}
					<iframe src={url} title={t("docs.previewOf", { name: current.fileName })}></iframe>
				{:else if text !== null}
					<pre class="text selectable">{text}</pre>
				{:else if failed}
					<p class="state"><Icon name="alert" size={22} />{t("preview.loadFailed")}</p>
				{:else}
					<p class="state"><span class="spinner" aria-hidden="true"></span>{t("common.loading")}</p>
				{/if}
			{/key}
			{#if images.length > 1}
				<button type="button" class="nav next" title={t("preview.nextHint")} aria-label={t("preview.next")} onclick={() => go(1)}><Icon name="chevronRight" size={22} /></button>
			{/if}
		</div>

		<footer>
			<span class="hint">{images.length > 1 ? `${t("preview.browse")} · ` : ""}{t("preview.escClose")}</span>
			<button type="button" class="btn btn-primary btn-sm" onclick={() => ondownload(current)}><Icon name="arrowRight" size={15} /> {t("files.download")}</button>
		</footer>
	{/if}
</dialog>

<style>
	dialog {
		display: flex;
		flex-direction: column;
		width: min(1080px, calc(100vw - 24px));
		max-height: calc(100vh - 24px);
		overflow: hidden;
	}

	dialog:not([open]) {
		display: none;
	}

	header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 12px 12px 20px;
	}

	.badge {
		flex: none;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.info {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		overflow: hidden;
		color: var(--text);
		font-family: var(--font-serif);
		font-size: 1.05rem;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		color: var(--text-faint);
		font-size: 0.78rem;
	}

	.stage {
		position: relative;
		display: grid;
		flex: 1;
		min-height: 260px;
		place-items: center;
		padding: 20px 64px;
		overflow: auto;
		border-block: 1px solid var(--line);
		background-color: var(--bg-sunken);
		background-image:
			linear-gradient(45deg, color-mix(in srgb, var(--text) 5%, transparent) 25%, transparent 25%, transparent 75%, color-mix(in srgb, var(--text) 5%, transparent) 75%),
			linear-gradient(45deg, color-mix(in srgb, var(--text) 5%, transparent) 25%, transparent 25%, transparent 75%, color-mix(in srgb, var(--text) 5%, transparent) 75%);
		background-position: 0 0, 10px 10px;
		background-size: 20px 20px;
	}

	iframe {
		width: 100%;
		height: calc(100vh - 230px);
		border: 0;
		border-radius: var(--radius);
		background: var(--surface-raised);
	}

	.text {
		align-self: stretch;
		justify-self: stretch;
		max-height: calc(100vh - 230px);
		margin: 0;
		padding: 16px 18px;
		overflow: auto;
		border-radius: var(--radius);
		background: var(--surface-raised);
		color: var(--text);
		font-size: 0.85rem;
		line-height: 1.55;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	img {
		display: block;
		max-width: 100%;
		max-height: calc(100vh - 230px);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		object-fit: contain;
		animation: show 0.25s var(--ease);
	}

	@keyframes show {
		from {
			opacity: 0;
			transform: scale(0.985);
		}
	}

	.state {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		padding: 2rem;
		color: var(--text-faint);
		font-size: 0.9rem;
	}

	.spinner {
		width: 16px;
		height: 16px;
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

	.nav {
		position: absolute;
		top: 50%;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
		background: color-mix(in srgb, var(--surface-raised) 88%, transparent);
		backdrop-filter: blur(6px);
		color: var(--text);
		box-shadow: var(--shadow-md);
		transform: translateY(-50%);
		cursor: pointer;
		transition: border-color 0.15s var(--ease), color 0.15s var(--ease), transform 0.15s var(--ease);
	}

	.nav:hover {
		border-color: var(--accent);
		color: var(--accent);
		transform: translateY(-50%) scale(1.06);
	}

	.nav:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.prev {
		left: 14px;
	}

	.next {
		right: 14px;
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 16px 12px 20px;
	}

	.hint {
		color: var(--text-faint);
		font-size: 0.78rem;
	}

	@media (max-width: 600px) {
		.stage {
			padding: 14px 12px;
		}

		.nav {
			top: auto;
			bottom: 10px;
			transform: none;
		}

		.nav:hover {
			transform: scale(1.06);
		}

		.hint {
			display: none;
		}
	}
</style>
