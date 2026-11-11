<script lang="ts">
	// Owner: Track 4 (Whiteboard, notes, and supporting modules)
	// Responsible for: the tile layout of the Notes and Files pages
	import type { Snippet } from "svelte";

	const { fixed = false, children }: { fixed?: boolean; children: Snippet } = $props();
</script>

<div class="grid" class:fixed>{@render children()}</div>

<style>
	.grid:not(.fixed) {
		column-width: 16rem;
		column-gap: 0.85rem;
	}

	.grid.fixed {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		grid-auto-flow: row;
		gap: 0.85rem;
	}

	.grid.fixed :global(.tile) {
		height: 10rem;
		margin: 0;
		break-inside: auto;
	}
</style>
