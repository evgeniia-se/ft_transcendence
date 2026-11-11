<script module lang="ts">
	const MAX_CACHED = 200;
	const cache = new Map<string, Promise<string>>();

	// keep the cache bounded: drop the oldest entry and free its blob
	function evictOldest(): void {
		const oldest = cache.keys().next();
		if (oldest.done) return;
		const pending = cache.get(oldest.value);
		cache.delete(oldest.value);
		pending?.then((objectUrl) => URL.revokeObjectURL(objectUrl)).catch(() => {});
	}
</script>

<script lang="ts">
	import { fetchAttachmentBlob, type Attachment } from "./attachmentsApi";

	const { projectId, attachment }: { projectId: string; attachment: Attachment } = $props();

	let node: HTMLDivElement;
	let url = $state<string | null>(null);
	let failed = $state(false);

	function load(): void {
		let pending = cache.get(attachment.id);
		if (!pending) {
			pending = fetchAttachmentBlob(projectId, attachment).then((blob) => URL.createObjectURL(blob));
			pending.catch(() => cache.delete(attachment.id));
			cache.set(attachment.id, pending);
			if (cache.size > MAX_CACHED) evictOldest();
		}
		pending.then((value) => (url = value)).catch(() => (failed = true));
	}

	// only fetch when the tile scrolls into view
	$effect(() => {
		if (typeof IntersectionObserver === "undefined") {
			load();
			return;
		}
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				observer.disconnect();
				load();
			}
		}, { rootMargin: "200px" });
		observer.observe(node);
		return () => observer.disconnect();
	});
</script>

<div class="thumb" class:ready={!!url} bind:this={node} aria-hidden="true">
	{#if url}
		<img src={url} alt="" loading="lazy" draggable="false" />
	{:else if !failed}
		<span class="skeleton"></span>
	{/if}
</div>

<style>
	.thumb {
		position: relative;
		flex: none;
		height: 64px;
		overflow: hidden;
		border-radius: var(--radius);
		background: var(--bg-sunken);
	}

	.skeleton {
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: fade 0.2s var(--ease);
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
