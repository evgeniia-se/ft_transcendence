<script lang="ts">
  import { t } from "../shared/i18n.svelte";
	// Owner: Track 4 (Whiteboard, notes, and supporting modules)
	// Responsible for: the path bar of the Files page
	import Icon from "../shared/ui/Icon.svelte";
	import type { Folder } from "./foldersApi";

	const {
		path,
		current,
		onnavigate,
		canDrop,
		ondropitem,
	}: {
		path: Folder[];
		current: string | null;
		onnavigate: (folderId: string | null) => void;
		canDrop: (folderId: string | null) => boolean;
		ondropitem: (folderId: string | null) => void;
	} = $props();

	// empty string stands for the top level
	let over = $state<string | null>(null);

	function dragOver(event: DragEvent, folderId: string | null): void {
		if (!canDrop(folderId)) return;
		event.preventDefault();
		over = folderId ?? "";
	}

	function drop(event: DragEvent, folderId: string | null): void {
		event.preventDefault();
		over = null;
		if (canDrop(folderId)) ondropitem(folderId);
	}
</script>

<nav class="crumbs" aria-label={t("folders.path")}>
	<button
		type="button"
		class="crumb"
		class:here={current === null}
		class:over={over === ""}
		ondragover={(event) => dragOver(event, null)}
		ondragleave={() => (over = null)}
		ondrop={(event) => drop(event, null)}
		onclick={() => onnavigate(null)}
	>
		<Icon name="folder" size={15} /> {t("nav.files")}
	</button>
	{#each path as folder (folder.id)}
		<Icon name="chevronRight" size={14} />
		<button
			type="button"
			class="crumb"
			class:here={folder.id === current}
			class:over={over === folder.id}
			ondragover={(event) => dragOver(event, folder.id)}
			ondragleave={() => (over = null)}
			ondrop={(event) => drop(event, folder.id)}
			onclick={() => onnavigate(folder.id)}
		>
			{folder.name}
		</button>
	{/each}
</nav>

<style>
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		margin-bottom: 1rem;
		color: var(--text-faint);
	}

	.crumb {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 8px;
		border: 1px dashed transparent;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-soft);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.crumb:hover {
		background: var(--bg-sunken);
	}

	.crumb.here {
		color: var(--text);
		font-weight: 650;
	}

	.crumb.over {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}
</style>
