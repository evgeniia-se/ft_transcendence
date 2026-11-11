<script lang="ts">
	// Owner: Track 4 (Whiteboard, notes, and supporting modules)
	// Responsible for: one tile of the Notes and Files pages
	import type { Snippet } from "svelte";

	const {
		href,
		label,
		selected = false,
		faded = false,
		dropActive = false,
		onselect,
		onopen,
		ondragstart,
		ondragend,
		ondragover,
		ondragleave,
		ondrop,
		children,
		actions,
	}: {
		href?: string;
		label: string;
		selected?: boolean;
		faded?: boolean;
		dropActive?: boolean;
		onselect?: () => void;
		onopen?: () => void;
		ondragstart?: (event: DragEvent) => void;
		ondragend?: (event: DragEvent) => void;
		ondragover?: (event: DragEvent) => void;
		ondragleave?: (event: DragEvent) => void;
		ondrop?: (event: DragEvent) => void;
		children: Snippet;
		actions?: Snippet;
	} = $props();

	function onkeydown(event: KeyboardEvent): void {
		if (event.target !== event.currentTarget) return;
		if (event.key === "Enter") {
			event.preventDefault();
			onopen?.();
		} else if (event.key === " ") {
			event.preventDefault();
			onselect?.();
		}
	}
</script>

<article
	class="tile"
	class:selected
	class:faded
	class:drop-active={dropActive}
	draggable={ondragstart ? "true" : undefined}
	{ondragstart}
	{ondragend}
	{ondragover}
	{ondragleave}
	{ondrop}
>
	{#if href}
		<a class="open" {href} aria-label={label}></a>
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="open" role="button" tabindex="0" aria-label={label} aria-pressed={selected} onclick={onselect} ondblclick={onopen} {onkeydown}></div>
	{/if}
	<div class="content">{@render children()}</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</article>

<style>
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		box-sizing: border-box;
		width: 100%;
		margin: 0 0 0.85rem;
		padding: 0.9rem 1rem 0.7rem;
		break-inside: avoid;
		border: 1px solid var(--line);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease), opacity 0.15s var(--ease);
	}

	.tile:hover,
	.tile:focus-within {
		border-color: var(--line-strong);
		box-shadow: var(--shadow-md);
	}

	.tile.selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	.tile.faded {
		opacity: 0.5;
	}

	.tile.drop-active {
		border-color: var(--accent);
		border-style: dashed;
		background: var(--accent-soft);
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
		outline-offset: 2px;
	}

	.content {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.45rem;
		min-width: 0;
		min-height: 0;
	}

	.actions {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 2px;
		min-height: 1.9rem;
		opacity: 0;
		transition: opacity 0.12s var(--ease);
	}

	.tile:hover .actions,
	.tile:focus-within .actions {
		opacity: 1;
	}

	@media (hover: none) {
		.actions {
			opacity: 1;
		}
	}
</style>
